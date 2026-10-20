package com.foody.tracker.auth.infra;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.foody.tracker.auth.application.AuthService;
import com.foody.tracker.auth.application.AuthenticatedUser;
import com.foody.tracker.shared.api.ProblemResponses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class SessionVersionFilter extends OncePerRequestFilter {
    private final AuthService service;
    private final ObjectMapper mapper;

    public SessionVersionFilter(AuthService service, ObjectMapper mapper) { this.service = service; this.mapper = mapper; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user
                && !service.sessionIsCurrent(user)) {
            SecurityContextHolder.clearContext();
            var session = request.getSession(false);
            if (session != null) session.invalidate();
            ProblemResponses.write(mapper, request, response, HttpStatus.UNAUTHORIZED, "SESSION_REVOKED",
                "Os dados de acesso foram alterados. Entre novamente.");
            return;
        }
        chain.doFilter(request, response);
    }
}
