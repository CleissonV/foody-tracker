package com.foody.tracker.orders.api;

import com.foody.tracker.orders.domain.DeliveryAddress;
import com.foody.tracker.orders.domain.OrderItem;
import com.foody.tracker.orders.domain.OrderStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public final class OrderContracts {
    private OrderContracts() {}

    public record CreateOrderRequest(
        @NotBlank @Size(max = 100) String customerName,
        @NotNull @Valid AddressRequest deliveryAddress,
        @NotNull @Size(min = 1, max = 50) List<@NotNull @Valid ItemRequest> items) {}

    public record AddressRequest(
        @NotBlank @Size(max = 150) String street,
        @NotBlank @Size(max = 20) String number,
        @Size(max = 100) String complement,
        @NotBlank @Size(max = 100) String neighborhood,
        @NotBlank @Size(max = 100) String city,
        @NotBlank @Pattern(regexp = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO") String state,
        @NotBlank @Pattern(regexp = "\\d{5}-?\\d{3}") String postalCode) {
        DeliveryAddress toDomain() { return new DeliveryAddress(street, number, complement, neighborhood, city, state, postalCode); }
    }

    public record ItemRequest(
        @NotBlank @Size(max = 120) String name,
        @NotNull @Min(1) @Max(999) Integer quantity,
        @NotNull @DecimalMin("0.00") @DecimalMax("999999.99") @Digits(integer = 6, fraction = 2) BigDecimal unitPrice) {
        OrderItem toDomain() { return new OrderItem(name, quantity, unitPrice); }
    }

    public record ChangeStatusRequest(@NotNull OrderStatus status, @NotNull @Min(0) Long expectedVersion) {}
}
