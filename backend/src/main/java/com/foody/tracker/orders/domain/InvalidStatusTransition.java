package com.foody.tracker.orders.domain;

public class InvalidStatusTransition extends RuntimeException {
    public InvalidStatusTransition(OrderStatus current, OrderStatus next) {
        super("Transição de " + current + " para " + next + " não permitida.");
    }
}
