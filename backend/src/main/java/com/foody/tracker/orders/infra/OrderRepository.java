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

    @Query("select o from DeliveryOrder o where o.ownerId = :ownerId and (:status is null or o.status = :status) "
        + "and (:idPrefix is null or lower(replace(cast(o.id as string), '-', '')) like concat(:idPrefix, '%'))")
    Page<DeliveryOrder> findOrders(UUID ownerId, OrderStatus status, String idPrefix, Pageable pageable);

    @Query("select o.status as status, count(o) as count from DeliveryOrder o where o.ownerId = :ownerId group by o.status")
    List<StatusCount> countByStatus(UUID ownerId);

    interface StatusCount {
        OrderStatus getStatus();
        long getCount();
    }
}
