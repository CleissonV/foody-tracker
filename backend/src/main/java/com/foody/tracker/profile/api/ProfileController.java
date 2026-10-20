package com.foody.tracker.profile.api;

import com.foody.tracker.auth.application.AuthService;
import com.foody.tracker.auth.application.AuthenticatedUser;
import com.foody.tracker.auth.application.UserProfile;
import com.foody.tracker.profile.application.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    private final ProfileService profiles;
    private final AuthService auth;
    private final SecurityContextRepository contexts;
    private final SessionAuthenticationStrategy sessions;

    public ProfileController(ProfileService profiles, AuthService auth, SecurityContextRepository contexts,
                             SessionAuthenticationStrategy sessions) {
        this.profiles = profiles; this.auth = auth; this.contexts = contexts; this.sessions = sessions;
    }

    @PatchMapping
    @Operation(summary = "Atualizar nome/e-mail; trocar e-mail exige senha atual")
    UserProfile update(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody UpdateRequest body,
                       HttpServletRequest request, HttpServletResponse response) {
        var profile = profiles.update(user.id(), body.name(), body.email(), body.currentPassword(), body.expectedVersion());
        long expectedCredentials = user.credentialsVersion() + (profile.email().equals(user.getUsername()) ? 0 : 1);
        refreshSession(user, expectedCredentials, request, response);
        return profile;
    }

    @PutMapping("/password")
    @Operation(summary = "Trocar senha e revogar outras sessões")
    UserProfile password(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody PasswordRequest body,
                         HttpServletRequest request, HttpServletResponse response) {
        var profile = profiles.changePassword(user.id(), body.currentPassword(), body.newPassword(), body.expectedVersion());
        refreshSession(user, user.credentialsVersion() + 1, request, response);
        return profile;
    }

    @PutMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Enviar foto PNG/JPEG de até 2 MB")
    UserProfile upload(@AuthenticationPrincipal AuthenticatedUser user, @RequestPart("file") MultipartFile file) throws IOException {
        return profiles.setAvatar(user.id(), file.getBytes());
    }

    @DeleteMapping("/avatar")
    @Operation(summary = "Remover foto de perfil")
    UserProfile remove(@AuthenticationPrincipal AuthenticatedUser user) { return profiles.removeAvatar(user.id()); }

    @GetMapping(value = "/avatar", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "Consultar foto do usuário autenticado")
    ResponseEntity<byte[]> avatar(@AuthenticationPrincipal AuthenticatedUser user) {
        byte[] data = profiles.avatar(user.id());
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).contentLength(data.length).body(data);
    }

    private void refreshSession(AuthenticatedUser user, long expectedCredentialsVersion, HttpServletRequest request, HttpServletResponse response) {
        // A concurrent credential change must not revive the session we are refreshing.
        var principal = auth.refreshedPrincipal(user.id(), expectedCredentialsVersion);
        var authentication = UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
        authentication.eraseCredentials();
        sessions.onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
    }

    public record UpdateRequest(@NotBlank @Size(min = 2, max = 100) String name,
                                @NotBlank @Email @Size(max = 254) String email,
                                @Size(max = 72) String currentPassword,
                                @NotNull @Min(0) Long expectedVersion) {}
    public record PasswordRequest(@NotBlank @Size(max = 72) String currentPassword,
                                  @NotBlank @Size(min = 8, max = 72) String newPassword,
                                  @NotNull @Min(0) Long expectedVersion) {}
}
