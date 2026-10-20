package com.foody.tracker.auth.api;

import com.foody.tracker.auth.application.AuthService;
import com.foody.tracker.auth.application.AuthenticatedUser;
import com.foody.tracker.auth.application.UserProfile;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contexts;
    private final SessionAuthenticationStrategy sessionStrategy;

    public AuthController(AuthService service, AuthenticationManager authenticationManager,
            SecurityContextRepository contexts, SessionAuthenticationStrategy sessionStrategy) {
        this.service = service;
        this.authenticationManager = authenticationManager;
        this.contexts = contexts;
        this.sessionStrategy = sessionStrategy;
    }

    @GetMapping("/csrf")
    @Operation(summary = "Obter token CSRF da sessão atual")
    CsrfResponse csrf(CsrfToken token) { return new CsrfResponse(token.getHeaderName(), token.getToken()); }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cadastrar usuário; não autentica automaticamente")
    UserProfile register(@Valid @RequestBody RegisterRequest request) {
        var user = service.register(request.name(), request.email(), request.password());
        return UserProfile.from(user);
    }

    @PostMapping("/login")
    @Operation(summary = "Autenticar e iniciar sessão em cookie HttpOnly")
    UserProfile login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        var authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(AuthService.normalizeEmail(body.email()), body.password()));
        sessionStrategy.onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        return service.profile(((AuthenticatedUser) authentication.getPrincipal()).id());
    }

    @GetMapping("/me")
    @Operation(summary = "Consultar usuário autenticado")
    UserProfile me(@AuthenticationPrincipal AuthenticatedUser user) { return service.profile(user.id()); }

    public record RegisterRequest(
        @NotBlank @Size(min = 2, max = 100) String name,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 72) String password) {}
    public record LoginRequest(@NotBlank @Email @Size(max = 254) String email,
                               @NotBlank @Size(max = 72) String password) {}
    public record CsrfResponse(String headerName, String token) {}
}
