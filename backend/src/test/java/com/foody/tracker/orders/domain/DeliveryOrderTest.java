package com.foody.tracker.orders.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

class DeliveryOrderTest {
    private final UUID owner = UUID.randomUUID();
    private final Instant now = Instant.parse("2026-10-20T12:00:00Z");

    private DeliveryAddress address() { return new DeliveryAddress("Rua das Flores", "42", null, "Centro", "Bauru", "SP", "17010000"); }
    private DeliveryOrder order() {
        return new DeliveryOrder(owner, "Ana", address(), List.of(new OrderItem("Pizza", 2, new BigDecimal("29.90"))), now);
    }

    @Test
    void createsReceivedOrderWithExactMonetaryTotalAndInitialHistory() {
        var order = order();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.RECEBIDO);
        assertThat(order.total()).isEqualByComparingTo("59.80");
        assertThat(order.getHistory()).singleElement().satisfies(change -> {
            assertThat(change.getStatus()).isEqualTo(OrderStatus.RECEBIDO);
            assertThat(change.getChangedBy()).isEqualTo(owner);
            assertThat(change.getChangedAt()).isEqualTo(now);
        });
        assertThatThrownBy(() -> order.getItems().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void advancesThroughEntireLifecycleAndRecordsHistory() {
        var order = order();
        order.changeStatus(OrderStatus.EM_PREPARO, owner, now.plusSeconds(1));
        order.changeStatus(OrderStatus.SAIU_PARA_ENTREGA, owner, now.plusSeconds(2));
        order.changeStatus(OrderStatus.ENTREGUE, owner, now.plusSeconds(3));
        assertThat(order.getHistory()).extracting(StatusChange::getStatus)
            .containsExactly(OrderStatus.RECEBIDO, OrderStatus.EM_PREPARO, OrderStatus.SAIU_PARA_ENTREGA, OrderStatus.ENTREGUE);
        assertThat(order.getUpdatedAt()).isEqualTo(now.plusSeconds(3));
        assertThat(order.getCreatedAt()).isEqualTo(now);
        assertThatThrownBy(() -> order.changeStatus(OrderStatus.CANCELADO, owner, now)).isInstanceOf(InvalidStatusTransition.class);
    }

    static Stream<Arguments> transitionMatrix() {
        return Stream.of(OrderStatus.values()).flatMap(from -> Stream.of(OrderStatus.values()).map(to -> {
            boolean allowed = switch (from) {
                case RECEBIDO -> to == OrderStatus.EM_PREPARO || to == OrderStatus.CANCELADO;
                case EM_PREPARO -> to == OrderStatus.SAIU_PARA_ENTREGA || to == OrderStatus.CANCELADO;
                case SAIU_PARA_ENTREGA -> to == OrderStatus.ENTREGUE || to == OrderStatus.CANCELADO;
                case ENTREGUE, CANCELADO -> false;
            };
            return Arguments.of(from, to, allowed);
        }));
    }

    @ParameterizedTest
    @MethodSource("transitionMatrix")
    void validatesAllTwentyFiveStatusTransitions(OrderStatus from, OrderStatus to, boolean expected) {
        assertThat(from.canTransitionTo(to)).isEqualTo(expected);
    }

    @Test
    void rejectedTransitionDoesNotMutateAggregate() {
        var order = order();
        assertThatThrownBy(() -> order.changeStatus(OrderStatus.ENTREGUE, owner, now.plusSeconds(1)))
            .isInstanceOf(InvalidStatusTransition.class);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.RECEBIDO);
        assertThat(order.getHistory()).hasSize(1);
        assertThat(order.getUpdatedAt()).isEqualTo(now);
    }

    @Test
    void cancellationIsTerminal() {
        var order = order();
        order.changeStatus(OrderStatus.CANCELADO, owner, now);
        for (var next : OrderStatus.values()) {
            assertThatThrownBy(() -> order.changeStatus(next, owner, now)).isInstanceOf(InvalidStatusTransition.class);
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0, 1000})
    void refusesInvalidQuantities(int quantity) {
        assertThatThrownBy(() -> new OrderItem("Pizza", quantity, BigDecimal.ONE)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void refusesNegativePricesAndEmptyOrders() {
        assertThatThrownBy(() -> new OrderItem("Pizza", 1, new BigDecimal("-0.01"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new OrderItem("Pizza", 1, new BigDecimal("1.001"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DeliveryOrder(owner, "Ana", address(), List.of(), now)).isInstanceOf(IllegalArgumentException.class);
    }
}
