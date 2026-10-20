package com.foody.tracker.orders.application;

import java.util.UUID;

public record OrderChanged(UUID ownerId, UUID orderId) {}
