package com.foody.tracker.orders.application;

import com.foody.tracker.orders.domain.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;

public final class OrderViews {
    private OrderViews() {}

    public record AddressResponse(String street, String number, String complement, String neighborhood, String city, String state, String postalCode) {
        public static AddressResponse from(DeliveryAddress a) { return new AddressResponse(a.getStreet(), a.getNumber(), a.getComplement(), a.getNeighborhood(), a.getCity(), a.getState(), a.getPostalCode()); }
    }
    public record ItemResponse(UUID id, String name, int quantity, BigDecimal unitPrice, BigDecimal subtotal) {}
    public record HistoryResponse(OrderStatus status, Instant changedAt, UUID changedBy) {}
    public record OrderSummary(UUID id, String customerName, AddressResponse deliveryAddress, OrderStatus status,
                               int itemCount, BigDecimal total, Instant createdAt, Instant updatedAt, long version,
                               List<OrderStatus> allowedNextStatuses) {
        public static OrderSummary from(DeliveryOrder order) {
            return new OrderSummary(order.getId(), order.getCustomerName(), AddressResponse.from(order.getDeliveryAddress()),
                order.getStatus(), order.getItems().stream().mapToInt(OrderItem::getQuantity).sum(), order.total(),
                order.getCreatedAt(), order.getUpdatedAt(), order.getVersion(), nextStatuses(order));
        }
    }
    public record OrderResponse(UUID id, String customerName, AddressResponse deliveryAddress, OrderStatus status,
                                List<ItemResponse> items, BigDecimal total, List<HistoryResponse> history,
                                Instant createdAt, Instant updatedAt, long version, List<OrderStatus> allowedNextStatuses) {
        public static OrderResponse from(DeliveryOrder order) {
            return new OrderResponse(order.getId(), order.getCustomerName(), AddressResponse.from(order.getDeliveryAddress()),
                order.getStatus(), order.getItems().stream().map(item -> new ItemResponse(item.getId(), item.getName(),
                    item.getQuantity(), item.getUnitPrice(), item.subtotal())).toList(), order.total(),
                order.getHistory().stream().map(change -> new HistoryResponse(change.getStatus(), change.getChangedAt(), change.getChangedBy())).toList(),
                order.getCreatedAt(), order.getUpdatedAt(), order.getVersion(), nextStatuses(order));
        }
    }
    private static List<OrderStatus> nextStatuses(DeliveryOrder order) { return order.getStatus().nextStatuses().stream().sorted(Comparator.naturalOrder()).toList(); }

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
        public static <T> PageResponse<T> from(Page<T> page) { return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()); }
    }
    public record StatsResponse(Map<OrderStatus, Long> counts, long total) {}
}
