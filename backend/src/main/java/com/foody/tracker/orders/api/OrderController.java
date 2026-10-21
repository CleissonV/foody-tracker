package com.foody.tracker.orders.api;

import com.foody.tracker.auth.application.AuthenticatedUser;
import com.foody.tracker.orders.application.OrderService;
import com.foody.tracker.orders.domain.OrderStatus;
import com.foody.tracker.orders.api.OrderContracts.*;
import com.foody.tracker.orders.application.OrderViews.*;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService service;
    public OrderController(OrderService service) { this.service = service; }

    @PostMapping
    @Operation(summary = "Criar pedido no status RECEBIDO")
    ResponseEntity<OrderResponse> create(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody CreateOrderRequest body) {
        var order = service.create(user.id(), body.customerName(), body.deliveryAddress().toDomain(),
            body.items().stream().map(ItemRequest::toDomain).toList());
        return ResponseEntity.created(URI.create("/api/orders/" + order.id())).body(order);
    }

    @GetMapping
    @Operation(summary = "Listar pedidos do usuário com paginação, status e busca por ID")
    PageResponse<OrderSummary> list(@AuthenticationPrincipal AuthenticatedUser user,
        @RequestParam(required = false) OrderStatus status,
        @RequestParam(required = false) @Size(max = 37) String orderId,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "12") @Min(1) @Max(100) int size) {
        return PageResponse.from(service.list(user.id(), status, orderId, page, size));
    }

    @GetMapping("/stats")
    @Operation(summary = "Contagem por status de todos os pedidos do usuário")
    StatsResponse stats(@AuthenticationPrincipal AuthenticatedUser user) {
        var counts = service.stats(user.id());
        return new StatsResponse(counts, counts.values().stream().mapToLong(Long::longValue).sum());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar pedido com itens e histórico")
    OrderResponse find(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return service.find(user.id(), id);
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Atualizar status com controle de concorrência")
    OrderResponse changeStatus(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id,
                                @Valid @RequestBody ChangeStatusRequest body) {
        return service.changeStatus(user.id(), id, body.status(), body.expectedVersion());
    }
}
