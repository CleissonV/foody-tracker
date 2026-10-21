package com.foody.tracker.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

@Configuration
@Profile("production")
public class ProductionPersistenceConfig {
    @Bean
    @ConfigurationProperties("spring.datasource.hikari")
    HikariDataSource dataSource(Environment environment) {
        var connection = PostgresConnection.parse(environment.getProperty("DATABASE_URL"));
        var pool = new HikariDataSource();
        pool.setJdbcUrl(connection.jdbcUrl());
        pool.setUsername(connection.username());
        pool.setPassword(connection.password());
        return pool;
    }

    @Bean
    FlywayConfigurationCustomizer productionMigrations(Environment environment) {
        // Direct connection for migrations; application traffic uses Neon's pooled endpoint.
        var connection = PostgresConnection.parse(environment.getProperty("DATABASE_URL_UNPOOLED",
            environment.getProperty("DATABASE_URL")));
        return configuration -> configuration.dataSource(connection.jdbcUrl(), connection.username(), connection.password());
    }
}
