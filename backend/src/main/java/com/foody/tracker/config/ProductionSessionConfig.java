package com.foody.tracker.config;

import com.foody.tracker.auth.application.AuthenticatedUser;
import com.foody.tracker.auth.application.StreamSessionAccess;
import jakarta.servlet.http.HttpSession;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.session.jdbc.config.annotation.web.http.EnableJdbcHttpSession;
import org.springframework.session.config.SessionRepositoryCustomizer;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
@Profile("production")
@EnableJdbcHttpSession(maxInactiveIntervalInSeconds = 1800)
public class ProductionSessionConfig {
    @Bean
    CookieSerializer cookieSerializer() {
        var cookie = new DefaultCookieSerializer();
        cookie.setCookieName("FOODY_SESSION");
        cookie.setCookiePath("/");
        cookie.setUseHttpOnlyCookie(true);
        cookie.setUseSecureCookie(true);
        cookie.setSameSite("Lax");
        return cookie;
    }

    @Bean
    SessionRepositoryCustomizer<JdbcIndexedSessionRepository> sessionUpsert() {
        return repository -> repository.setCreateSessionAttributeQuery("""
            INSERT INTO %TABLE_NAME%_ATTRIBUTES (SESSION_PRIMARY_ID, ATTRIBUTE_NAME, ATTRIBUTE_BYTES)
            VALUES (?, ?, ?)
            ON CONFLICT (SESSION_PRIMARY_ID, ATTRIBUTE_NAME)
            DO UPDATE SET ATTRIBUTE_BYTES = EXCLUDED.ATTRIBUTE_BYTES
            """);
    }

    @Bean
    StreamSessionAccess persistentStreamSessions(JdbcIndexedSessionRepository repository) {
        return new StreamSessionAccess() {
            @Override
            public AuthenticatedUser current(HttpSession session) {
                org.springframework.session.Session stored = repository.findById(session.getId());
                if (stored == null) return null;
                var context = stored.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
                var authentication = context instanceof SecurityContext security ? security.getAuthentication() : null;
                return authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser principal
                    ? principal : null;
            }
            @Override public boolean reconnectWhenMissing() { return true; }
        };
    }
}
