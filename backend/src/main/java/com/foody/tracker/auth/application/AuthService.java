package com.foody.tracker.auth.application;

import com.foody.tracker.auth.domain.AppUser;
import com.foody.tracker.auth.infra.UserRepository;
import com.foody.tracker.shared.api.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService implements UserDetailsService {
    private final UserRepository users;
    private final PasswordEncoder passwords;

    public AuthService(UserRepository users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    @Transactional
    public AppUser register(String name, String email, String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_TOO_LONG", "A senha deve ter no máximo 72 bytes UTF-8.");
        }
        String normalizedEmail = normalizeEmail(email);
        if (users.existsByEmail(normalizedEmail)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "Já existe uma conta com este e-mail.");
        }
        return users.saveAndFlush(new AppUser(name, normalizedEmail, passwords.encode(password)));
    }

    @Override
    @Transactional(readOnly = true)
    public AuthenticatedUser loadUserByUsername(String email) {
        var user = users.findByEmail(normalizeEmail(email))
            .orElseThrow(() -> new UsernameNotFoundException("Credenciais inválidas."));
        return new AuthenticatedUser(user.getId(), user.getName(), user.getEmail(), user.getPasswordHash(), user.getCredentialsVersion());
    }

    @Transactional(readOnly = true)
    public UserProfile profile(UUID id) { return UserProfile.from(requiredUser(id)); }

    @Transactional(readOnly = true)
    public AuthenticatedUser refreshedPrincipal(UUID id, long expectedCredentialsVersion) {
        var user = requiredUser(id);
        if (user.getCredentialsVersion() != expectedCredentialsVersion) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_REVOKED", "Os dados de acesso foram alterados. Entre novamente.");
        }
        return new AuthenticatedUser(user.getId(), user.getName(), user.getEmail(), "", user.getCredentialsVersion());
    }

    @Transactional(readOnly = true)
    public boolean sessionIsCurrent(AuthenticatedUser user) {
        return users.findCredentialsVersion(user.id()).map(version -> version == user.credentialsVersion()).orElse(false);
    }

    private AppUser requiredUser(UUID id) {
        return users.findById(id).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Entre novamente na sua conta."));
    }

    public static String normalizeEmail(String email) { return email.strip().toLowerCase(Locale.ROOT); }
}
