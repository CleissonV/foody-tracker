package com.foody.tracker.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/** Converts the provider URI without putting credentials in the JDBC URL or log output. */
final class PostgresConnection {
    private final String jdbcUrl;
    private final String username;
    private final String password;

    private PostgresConnection(String jdbcUrl, String username, String password) {
        this.jdbcUrl = jdbcUrl; this.username = username; this.password = password;
    }

    static PostgresConnection parse(String value) {
        try {
            if (value == null) throw new IllegalArgumentException();
            var uri = URI.create(value);
            if (!("postgres".equals(uri.getScheme()) || "postgresql".equals(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() == null
                    || uri.getPath() == null || uri.getPath().length() < 2) throw new IllegalArgumentException();
            var credentials = uri.getRawUserInfo().split(":", 2);
            if (credentials.length != 2) throw new IllegalArgumentException();
            var host = uri.getHost().contains(":") ? "[" + uri.getHost() + "]" : uri.getHost();
            var port = uri.getPort() < 0 ? 5432 : uri.getPort();
            var jdbc = "jdbc:postgresql://" + host + ":" + port + uri.getRawPath()
                + "?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory"
                + "&connectTimeout=15&socketTimeout=30&tcpKeepAlive=true&prepareThreshold=0";
            return new PostgresConnection(jdbc, decode(credentials[0]), decode(credentials[1]));
        } catch (IllegalArgumentException invalid) {
            // Do not include the source URI or its parse exception: both may contain a password.
            throw new IllegalArgumentException("Configure uma DATABASE_URL PostgreSQL válida para produção.");
        }
    }

    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }

    String jdbcUrl() { return jdbcUrl; }
    String username() { return username; }
    String password() { return password; }
    @Override public String toString() { return "PostgresConnection[credentials=redacted]"; }
}
