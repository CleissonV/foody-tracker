package com.foody.tracker.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ApplicationConfig {
    @Bean
    Clock clock() { return Clock.systemUTC(); }

    @Bean
    OpenAPI openAPI() {
        return new OpenAPI().info(new Info().title("Foody Mini Tracker API").version("1.0.0")
            .description("Sessão HttpOnly. Obtenha o token em GET /api/auth/csrf e envie no header retornado em toda escrita, inclusive login e cadastro. Após login/logout, obtenha um novo token."));
    }
}
