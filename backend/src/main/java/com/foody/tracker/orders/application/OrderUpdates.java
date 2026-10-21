package com.foody.tracker.orders.application;

import java.util.UUID;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/** Ephemeral invalidations for one application instance; reconnects reload the authoritative REST data. */
@Component
public class OrderUpdates {
    private static final Logger log = LoggerFactory.getLogger(OrderUpdates.class);
    private final ConcurrentHashMap<UUID, Subscription> subscriptions = new ConcurrentHashMap<>();

    public Runnable subscribe(UUID ownerId, Consumer<OrderChanged> consumer) {
        var id = UUID.randomUUID();
        subscriptions.put(id, new Subscription(ownerId, consumer));
        return () -> subscriptions.remove(id);
    }

    @TransactionalEventListener
    public void committed(OrderChanged event) {
        publish(event);
    }

    public Set<UUID> activeOwners() {
        return subscriptions.values().stream().map(Subscription::ownerId).collect(Collectors.toUnmodifiableSet());
    }

    /** A null order ID means reload all order projections; no order data travels in this signal. */
    public void refresh(UUID ownerId) { publish(new OrderChanged(ownerId, null)); }

    private void publish(OrderChanged event) {
        subscriptions.values().forEach(subscription -> {
            if (subscription.ownerId().equals(event.ownerId())) {
                try { subscription.consumer().accept(event); }
                catch (RuntimeException failure) {
                    // A disconnected client must never turn a committed write into an HTTP error.
                    log.debug("Order update subscriber failed", failure);
                }
            }
        });
    }

    private record Subscription(UUID ownerId, Consumer<OrderChanged> consumer) {}
}
