package com.foody.tracker.orders.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "delivery_orders")
public class DeliveryOrder {
    @Id
    private UUID id;
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;
    @Column(name = "customer_name", nullable = false, length = 100)
    private String customerName;
    @Embedded
    private DeliveryAddress deliveryAddress;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrderStatus status;
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<OrderItem> items = new ArrayList<>();
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequenceNumber ASC")
    private List<StatusChange> history = new ArrayList<>();
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version
    private Long version;

    protected DeliveryOrder() {}

    public DeliveryOrder(UUID ownerId, String customerName, DeliveryAddress address, List<OrderItem> items, Instant now) {
        if (customerName == null || customerName.isBlank() || customerName.strip().length() > 100
                || items == null || items.isEmpty() || items.size() > 50) {
            throw new IllegalArgumentException("O pedido precisa de cliente e de 1 a 50 itens.");
        }
        this.id = UUID.randomUUID();
        this.ownerId = Objects.requireNonNull(ownerId);
        this.customerName = customerName.strip();
        this.deliveryAddress = Objects.requireNonNull(address);
        this.createdAt = Objects.requireNonNull(now);
        this.updatedAt = now;
        this.status = OrderStatus.RECEBIDO;
        this.items.addAll(items);
        this.items.forEach(item -> item.attachTo(this));
        this.history.add(new StatusChange(this, status, now, ownerId, 0));
    }

    public void changeStatus(OrderStatus next, UUID actor, Instant now) {
        Objects.requireNonNull(next);
        Objects.requireNonNull(actor);
        Objects.requireNonNull(now);
        if (!status.canTransitionTo(next)) throw new InvalidStatusTransition(status, next);
        this.status = next;
        this.updatedAt = now;
        this.history.add(new StatusChange(this, next, now, actor, history.size()));
    }

    public BigDecimal total() { return items.stream().map(OrderItem::subtotal).reduce(new BigDecimal("0.00"), BigDecimal::add); }
    public UUID getId() { return id; }
    public UUID getOwnerId() { return ownerId; }
    public String getCustomerName() { return customerName; }
    public DeliveryAddress getDeliveryAddress() { return deliveryAddress; }
    public OrderStatus getStatus() { return status; }
    public List<OrderItem> getItems() { return List.copyOf(items); }
    public List<StatusChange> getHistory() { return List.copyOf(history); }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
