package com.foody.tracker.orders.api;

import com.foody.tracker.auth.application.AuthService;
import com.foody.tracker.auth.application.AuthenticatedUser;
import com.foody.tracker.auth.application.StreamSessionAccess;
import com.foody.tracker.orders.application.OrderUpdates;
import com.foody.tracker.shared.api.ApiException;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.util.WebUtils;

@RestController
public class OrderStreamController {
    private final OrderUpdates updates;
    private final AuthService auth;
    private final StreamSessionAccess sessions;
    private final ConcurrentHashMap<UUID, Connection> connections = new ConcurrentHashMap<>();

    public OrderStreamController(OrderUpdates updates, AuthService auth, StreamSessionAccess sessions) {
        this.updates = updates; this.auth = auth; this.sessions = sessions;
    }

    @GetMapping(value = "/api/orders/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public synchronized ResponseEntity<SseEmitter> events(@AuthenticationPrincipal AuthenticatedUser user, HttpSession session) {
        if (connections.size() >= 200 || connections.values().stream().filter(c -> c.user.id().equals(user.id())).count() >= 8) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "STREAM_LIMIT", "Há muitas conexões abertas. Feche outras abas e tente novamente.");
        }
        var id = UUID.randomUUID();
        var connection = new Connection(id, user, session);
        connections.put(id, connection);
        connection.unsubscribe = updates.subscribe(user.id(), event -> connection.send("orders-changed",
            event.orderId() == null ? Map.of("refresh", true) : Map.of("orderId", event.orderId())));
        if (!connections.containsKey(id)) connection.unsubscribe.run();
        connection.emitter.onCompletion(connection::remove);
        connection.emitter.onTimeout(connection::close);
        connection.emitter.onError(error -> connection.remove());
        connection.send("ready", Map.of());
        return ResponseEntity.ok().header("Cache-Control", "no-cache, no-store")
            .header("X-Accel-Buffering", "no").body(connection.emitter);
    }

    @Scheduled(fixedDelay = 15000)
    public void heartbeat() {
        connections.values().forEach(connection -> connection.send("heartbeat", Map.of()));
    }

    @PreDestroy
    public void shutdown() { connections.values().forEach(Connection::close); }

    private final class Connection {
        private final UUID id;
        private final AuthenticatedUser user;
        private final HttpSession session;
        // Periodic reconnect also re-enters the normal security filter chain.
        private final SseEmitter emitter = new SseEmitter(300000L);
        private volatile Runnable unsubscribe = () -> {};

        private Connection(UUID id, AuthenticatedUser user, HttpSession session) {
            this.id = id; this.user = user; this.session = session;
        }

        private synchronized void send(String name, Object data) {
            if (!connections.containsKey(id)) return;
            try {
                synchronized (WebUtils.getSessionMutex(session)) {
                    // Follow the current context after a legitimate profile/password change rotates this session.
                    var principal = sessions.current(session);
                    if (principal == null && sessions.reconnectWhenMissing()) {
                        // Rotation may have replaced the stored ID. Reconnect using the browser's current cookie.
                        close();
                        return;
                    }
                    if (principal == null || !principal.id().equals(user.id()) || !auth.sessionIsCurrent(principal)) {
                        emitter.send(SseEmitter.event().name("session-expired").data(Map.of()));
                        close();
                        return;
                    }
                }
                emitter.send(SseEmitter.event().name(name).data(data).reconnectTime(3000));
            } catch (IOException | IllegalStateException disconnected) {
                close();
            }
        }

        private void remove() { connections.remove(id); unsubscribe.run(); }
        private void close() { remove(); emitter.complete(); }
    }
}
