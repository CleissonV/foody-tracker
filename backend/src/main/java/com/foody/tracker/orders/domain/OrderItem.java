package com.foody.tracker.orders.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "order_items")
public class OrderItem {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private DeliveryOrder order;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(nullable = false)
    private int quantity;
    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    protected OrderItem() {}

    public OrderItem(String name, int quantity, BigDecimal unitPrice) {
        if (name == null || name.isBlank() || name.strip().length() > 120 || quantity < 1 || quantity > 999
                || unitPrice == null || unitPrice.signum() < 0 || unitPrice.scale() > 2
                || unitPrice.compareTo(new BigDecimal("999999.99")) > 0) {
            throw new IllegalArgumentException("Item inválido.");
        }
        this.id = UUID.randomUUID();
        this.name = name.strip();
        this.quantity = quantity;
        this.unitPrice = unitPrice.setScale(2);
    }

    void attachTo(DeliveryOrder order) { this.order = order; }
    public UUID getId() { return id; }
    public String getName() { return name; }
    public int getQuantity() { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public BigDecimal subtotal() { return unitPrice.multiply(BigDecimal.valueOf(quantity)); }
}
