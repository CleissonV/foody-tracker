package com.foody.tracker.orders.infra;

import com.foody.tracker.orders.application.OrderUpdates;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Bounded polling for this mini tracker: only owners with a connected SSE stream are queried. */
@Component
@Profile("production")
public class PostgresOrderSync {
    private static final Logger log = LoggerFactory.getLogger(PostgresOrderSync.class);
    private final JdbcTemplate jdbc;
    private final OrderUpdates updates;
    private final ConcurrentHashMap<UUID, Revision> observed = new ConcurrentHashMap<>();

    public PostgresOrderSync(JdbcTemplate jdbc, OrderUpdates updates) { this.jdbc = jdbc; this.updates = updates; }

    @Scheduled(fixedDelay = 2000, initialDelay = 2000)
    public void synchronizeOwners() {
        var owners = updates.activeOwners();
        observed.keySet().retainAll(owners);
        for (var owner : owners) {
            try {
                var revision = jdbc.queryForObject("""
                    SELECT COUNT(*) AS orders_count, COALESCE(SUM(version), 0) AS versions_sum
                    FROM delivery_orders WHERE owner_id = ?
                    """, (row, number) -> new Revision(row.getLong("orders_count"), row.getLong("versions_sum")), owner);
                var previous = observed.put(owner, revision);
                // Initial refresh also covers a commit between stream readiness and the first poll.
                if (!revision.equals(previous)) updates.refresh(owner);
            } catch (DataAccessException unavailable) {
                log.warn("Order synchronization temporarily unavailable; retrying on next poll");
            }
        }
    }

    private record Revision(long orders, long versions) {}
}
