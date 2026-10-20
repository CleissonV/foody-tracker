package com.foody.tracker.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
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
            .description("Sessão HttpOnly. Obtenha o token em GET /api/auth/csrf e informe em Authorize (csrf). O navegador mantém o cookie de sessão. Após login/logout, obtenha e autorize um novo token. Leituras não exigem CSRF."))
            .components(new Components().addSecuritySchemes("csrf", new SecurityScheme()
                .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.HEADER).name("X-CSRF-TOKEN")))
            .addSecurityItem(new SecurityRequirement().addList("csrf"))
            .path("/api/auth/logout", new PathItem().post(new Operation().summary("Encerrar sessão")
                .responses(new ApiResponses().addApiResponse("204", new ApiResponse().description("Sessão encerrada")))));
    }
}
