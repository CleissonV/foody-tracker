package com.foody.tracker.orders.infra;

import com.foody.tracker.orders.domain.DeliveryOrder;
import com.foody.tracker.orders.domain.OrderStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface OrderRepository extends JpaRepository<DeliveryOrder, UUID> {
    Optional<DeliveryOrder> findByIdAndOwnerId(UUID id, UUID ownerId);

    Page<DeliveryOrder> findByOwnerId(UUID ownerId, Pageable pageable);
    Page<DeliveryOrder> findByOwnerIdAndStatus(UUID ownerId, OrderStatus status, Pageable pageable);

    @Query("select o from DeliveryOrder o where o.ownerId = :ownerId "
        + "and lower(replace(cast(o.id as string), '-', '')) like concat(:idPrefix, '%')")
    Page<DeliveryOrder> findByOwnerAndPrefix(UUID ownerId, String idPrefix, Pageable pageable);

    @Query("select o from DeliveryOrder o where o.ownerId = :ownerId and o.status = :status "
        + "and lower(replace(cast(o.id as string), '-', '')) like concat(:idPrefix, '%')")
    Page<DeliveryOrder> findByOwnerAndStatusAndPrefix(UUID ownerId, OrderStatus status, String idPrefix, Pageable pageable);

    default Page<DeliveryOrder> findOrders(UUID ownerId, OrderStatus status, String idPrefix, Pageable pageable) {
        // Omit absent predicates instead of sending untyped NULL parameters to PostgreSQL.
        if (idPrefix == null) return status == null
            ? findByOwnerId(ownerId, pageable) : findByOwnerIdAndStatus(ownerId, status, pageable);
        return status == null ? findByOwnerAndPrefix(ownerId, idPrefix, pageable)
            : findByOwnerAndStatusAndPrefix(ownerId, status, idPrefix, pageable);
    }

    @Query("select o.status as status, count(o) as count from DeliveryOrder o where o.ownerId = :ownerId group by o.status")
    List<StatusCount> countByStatus(UUID ownerId);

    interface StatusCount {
        OrderStatus getStatus();
        long getCount();
    }
}
