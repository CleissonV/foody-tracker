package com.foody.tracker.orders.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_status_history")
public class StatusChange {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private DeliveryOrder order;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrderStatus status;
    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;
    @Column(name = "changed_by", nullable = false)
    private UUID changedBy;
    @Column(name = "sequence_number", nullable = false)
    private int sequenceNumber;

    protected StatusChange() {}

    StatusChange(DeliveryOrder order, OrderStatus status, Instant changedAt, UUID changedBy, int sequenceNumber) {
        this.id = UUID.randomUUID();
        this.order = order;
        this.status = status;
        this.changedAt = changedAt;
        this.changedBy = changedBy;
        this.sequenceNumber = sequenceNumber;
    }

    public OrderStatus getStatus() { return status; }
    public Instant getChangedAt() { return changedAt; }
    public UUID getChangedBy() { return changedBy; }
}
