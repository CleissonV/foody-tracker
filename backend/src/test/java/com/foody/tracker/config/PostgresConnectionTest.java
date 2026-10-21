package com.foody.tracker.config;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class PostgresConnectionTest {
    @Test
    void decodesCredentialsAndRequiresVerifiedTlsWithoutLeakingPassword() {
        var connection = PostgresConnection.parse("postgresql://user%40example:p%40ss%3Aword+suffix@db.example.com/test?sslmode=require");
        assertEquals("user@example", connection.username());
        assertEquals("p@ss:word+suffix", connection.password());
        assertTrue(connection.jdbcUrl().startsWith("jdbc:postgresql://db.example.com:5432/test?"));
        assertTrue(connection.jdbcUrl().contains("sslmode=verify-full"));
        assertFalse(connection.jdbcUrl().contains("p@ss"));
        assertFalse(connection.toString().contains("p@ss"));
    }

    @Test
    void invalidUriErrorsDoNotContainCredentials() {
        var error = assertThrows(IllegalArgumentException.class,
            () -> PostgresConnection.parse("postgresql://user:secret@bad host/db"));
        assertFalse(error.getMessage().contains("secret"));
        assertNull(error.getCause());
        assertThrows(IllegalArgumentException.class, () -> PostgresConnection.parse(null));
        assertThrows(IllegalArgumentException.class, () -> PostgresConnection.parse("jdbc:h2:mem:test"));
    }
}
