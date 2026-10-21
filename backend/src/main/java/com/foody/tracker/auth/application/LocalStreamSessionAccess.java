package com.foody.tracker.auth.application;

import jakarta.servlet.http.HttpSession;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Component;

@Component
@Profile("!production")
public class LocalStreamSessionAccess implements StreamSessionAccess {
    @Override
    public AuthenticatedUser current(HttpSession session) {
        var context = session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        var authentication = context instanceof SecurityContext security ? security.getAuthentication() : null;
        return authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser principal
            ? principal : null;
    }
}
