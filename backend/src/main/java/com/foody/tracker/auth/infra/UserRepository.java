package com.foody.tracker.auth.infra;

import com.foody.tracker.auth.domain.AppUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<AppUser, UUID> {
    Optional<AppUser> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByEmailAndIdNot(String email, UUID id);

    @Query("select u.credentialsVersion from AppUser u where u.id = :id")
    Optional<Long> findCredentialsVersion(UUID id);
}
