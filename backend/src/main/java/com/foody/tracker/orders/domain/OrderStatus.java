package com.foody.tracker.orders.domain;

import java.util.Set;

public enum OrderStatus {
    RECEBIDO, EM_PREPARO, SAIU_PARA_ENTREGA, ENTREGUE, CANCELADO;

    public Set<OrderStatus> nextStatuses() {
        return switch (this) {
            case RECEBIDO -> Set.of(EM_PREPARO, CANCELADO);
            case EM_PREPARO -> Set.of(SAIU_PARA_ENTREGA, CANCELADO);
            case SAIU_PARA_ENTREGA -> Set.of(ENTREGUE, CANCELADO);
            case ENTREGUE, CANCELADO -> Set.of();
        };
    }

    public boolean canTransitionTo(OrderStatus next) { return nextStatuses().contains(next); }
}
