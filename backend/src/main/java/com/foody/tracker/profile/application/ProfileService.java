package com.foody.tracker.profile.application;

import com.foody.tracker.auth.application.AuthService;
import com.foody.tracker.auth.application.UserProfile;
import com.foody.tracker.auth.domain.AppUser;
import com.foody.tracker.auth.infra.UserRepository;
import com.foody.tracker.shared.api.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProfileService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AvatarProcessor avatars;

    public ProfileService(UserRepository users, PasswordEncoder passwords, AvatarProcessor avatars) {
        this.users = users; this.passwords = passwords; this.avatars = avatars;
    }

    @Transactional
    public UserProfile update(UUID id, String name, String email, String currentPassword, long expectedVersion) {
        var user = requiredUser(id);
        requireVersion(user, expectedVersion);
        String normalized = AuthService.normalizeEmail(email);
        if (!user.getEmail().equals(normalized)) {
            requirePassword(user, currentPassword);
            if (users.existsByEmailAndIdNot(normalized, id)) {
                throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "Já existe uma conta com este e-mail.");
            }
        }
        if (name.strip().length() < 2) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_NAME", "Informe um nome com pelo menos 2 caracteres.");
        user.updateProfile(name, normalized);
        users.flush();
        return UserProfile.from(user);
    }

    @Transactional
    public UserProfile changePassword(UUID id, String currentPassword, String newPassword, long expectedVersion) {
        var user = requiredUser(id);
        requireVersion(user, expectedVersion);
        requirePassword(user, currentPassword);
        if (newPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_TOO_LONG", "A senha deve ter no máximo 72 bytes UTF-8.");
        }
        if (passwords.matches(newPassword, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_UNCHANGED", "Escolha uma senha diferente da atual.");
        }
        user.changePassword(passwords.encode(newPassword));
        users.flush();
        return UserProfile.from(user);
    }

    @Transactional
    public UserProfile setAvatar(UUID id, byte[] input) {
        byte[] processed = avatars.process(input);
        var user = requiredUser(id);
        user.updateAvatar(processed);
        users.flush();
        return UserProfile.from(user);
    }

    @Transactional
    public UserProfile removeAvatar(UUID id) {
        var user = requiredUser(id);
        if (user.hasAvatar()) { user.updateAvatar(null); users.flush(); }
        return UserProfile.from(user);
    }

    public byte[] avatar(UUID id) {
        var data = requiredUser(id).getAvatarData();
        if (data == null) throw new ApiException(HttpStatus.NOT_FOUND, "AVATAR_NOT_FOUND", "Foto de perfil não encontrada.");
        return data;
    }

    private AppUser requiredUser(UUID id) {
        return users.findById(id).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Entre novamente na sua conta."));
    }

    private void requirePassword(AppUser user, String password) {
        if (password == null || password.getBytes(StandardCharsets.UTF_8).length > 72 || !passwords.matches(password, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CURRENT_PASSWORD", "A senha atual está incorreta.");
        }
    }

    private void requireVersion(AppUser user, long expected) {
        if (user.getVersion() != expected) throw new ApiException(HttpStatus.CONFLICT, "PROFILE_CONFLICT", "Seu perfil foi alterado em outra sessão. Recarregue antes de salvar.");
    }
}
