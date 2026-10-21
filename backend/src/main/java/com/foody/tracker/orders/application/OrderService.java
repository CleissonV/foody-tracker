package com.foody.tracker.orders.application;

import com.foody.tracker.orders.domain.DeliveryAddress;
import com.foody.tracker.orders.domain.DeliveryOrder;
import com.foody.tracker.orders.domain.OrderItem;
import com.foody.tracker.orders.domain.OrderStatus;
import com.foody.tracker.orders.infra.OrderRepository;
import com.foody.tracker.shared.api.ApiException;
import java.time.Clock;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import com.foody.tracker.orders.application.OrderViews.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class OrderService {
    private final OrderRepository orders;
    private final Clock clock;
    private final ApplicationEventPublisher events;

    public OrderService(OrderRepository orders, Clock clock, ApplicationEventPublisher events) {
        this.orders = orders; this.clock = clock; this.events = events;
    }

    @Transactional
    public OrderResponse create(UUID ownerId, String customerName, DeliveryAddress address, List<OrderItem> items) {
        var order = orders.saveAndFlush(new DeliveryOrder(ownerId, customerName, address, items, clock.instant()));
        events.publishEvent(new OrderChanged(ownerId, order.getId()));
        return OrderResponse.from(order);
    }

    public Page<OrderSummary> list(UUID ownerId, OrderStatus status, String orderId, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        return orders.findOrders(ownerId, status, normalizeIdPrefix(orderId), pageable).map(OrderSummary::from);
    }

    public OrderResponse find(UUID ownerId, UUID id) { return OrderResponse.from(ownedOrder(ownerId, id)); }

    @Transactional
    public OrderResponse changeStatus(UUID ownerId, UUID id, OrderStatus next, long expectedVersion) {
        var order = ownedOrder(ownerId, id);
        if (order.getVersion() != expectedVersion) {
            throw new ApiException(HttpStatus.CONFLICT, "ORDER_CONFLICT", "O pedido foi alterado em outra sessão. Atualize e tente novamente.");
        }
        order.changeStatus(next, ownerId, clock.instant());
        orders.flush(); // Detect optimistic conflict before mapping the new version.
        events.publishEvent(new OrderChanged(ownerId, order.getId()));
        return OrderResponse.from(order);
    }

    public Map<OrderStatus, Long> stats(UUID ownerId) {
        var result = new EnumMap<OrderStatus, Long>(OrderStatus.class);
        for (var status : OrderStatus.values()) result.put(status, 0L);
        orders.countByStatus(ownerId).forEach(row -> result.put(row.getStatus(), row.getCount()));
        return result;
    }

    private String normalizeIdPrefix(String value) {
        if (value == null || value.isBlank()) return null;
        var input = value.trim();
        if (input.startsWith("#")) input = input.substring(1);
        var prefix = input.replace("-", "").toLowerCase(Locale.ROOT);
        if (input.length() > 36 || !prefix.matches("[0-9a-f]{1,32}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ORDER_ID", "Use o ID completo ou o início do ID exibido na tabela.");
        }
        return prefix;
    }

    private DeliveryOrder ownedOrder(UUID ownerId, UUID id) {
        return orders.findByIdAndOwnerId(id, ownerId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Pedido não encontrado."));
    }
}
