package com.foody.tracker.auth.application;

import java.io.Serial;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

public class AuthenticatedUser extends User {
    @Serial
    private static final long serialVersionUID = 1L;
    private final UUID id;
    private final String name;
    private final long credentialsVersion;

    public AuthenticatedUser(UUID id, String name, String email, String passwordHash, long credentialsVersion) {
        super(email, passwordHash, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        this.id = id;
        this.name = name;
        this.credentialsVersion = credentialsVersion;
    }

    public UUID id() { return id; }
    public String name() { return name; }
    public long credentialsVersion() { return credentialsVersion; }
}
