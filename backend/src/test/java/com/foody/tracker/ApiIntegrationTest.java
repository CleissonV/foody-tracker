package com.foody.tracker;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foody.tracker.auth.infra.UserRepository;
import jakarta.persistence.EntityManagerFactory;
import java.util.Map;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired EntityManagerFactory entityManagerFactory;

    private String email() { return UUID.randomUUID() + "@example.com"; }
    private String body(Object value) throws Exception { return json.writeValueAsString(value); }
    private String credentials(String email) throws Exception { return body(Map.of("email", email, "password", "SenhaForte123!")); }

    private void register(String email) throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("name", "Ana Teste", "email", email, "password", "SenhaForte123!"))))
            .andExpect(status().isCreated()).andExpect(jsonPath("password").doesNotExist()).andExpect(jsonPath("passwordHash").doesNotExist());
    }

    private MockHttpSession login() throws Exception {
        String email = email();
        register(email);
        return (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(credentials(email))).andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }

    private JsonNode create(MockHttpSession session) throws Exception {
        return json.readTree(mvc.perform(post("/api/orders").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(validOrder())).andExpect(status().isCreated()).andExpect(header().exists("Location"))
            .andExpect(jsonPath("status").value("RECEBIDO")).andExpect(jsonPath("total").value(59.8))
            .andReturn().getResponse().getContentAsString());
    }

    private String validOrder() {
        return """
            {"customerName":"Maria Silva","deliveryAddress":{"street":"Rua das Flores","number":"42",
            "complement":"Casa","neighborhood":"Centro","city":"Bauru","state":"SP","postalCode":"17010-000"},
            "items":[{"name":"Pizza","quantity":2,"unitPrice":29.90}]}
            """;
    }

    @Test
    void blocksAnonymousAccessAndRequiresCsrfEvenForLogin() throws Exception {
        mvc.perform(get("/api/orders")).andExpect(status().isUnauthorized()).andExpect(jsonPath("code").value("UNAUTHORIZED"));
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(credentials(email())))
            .andExpect(status().isForbidden());
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("status").value("UP"));
    }

    @Test
    void registersNormalizesEmailHashesPasswordAndRejectsDuplicates() throws Exception {
        String email = email();
        register(email.toUpperCase());
        var user = users.findByEmail(email).orElseThrow();
        assertThat(user.getPasswordHash()).startsWith("$2a$12$").doesNotContain("SenhaForte");
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("name", "Outra pessoa", "email", email, "password", "SenhaForte123!"))))
            .andExpect(status().isConflict()).andExpect(jsonPath("code").value("EMAIL_ALREADY_EXISTS"));
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(credentials(email)))
            .andExpect(status().isOk());
    }

    @Test
    void invalidCredentialsHaveSameResponseForUnknownEmailAndWrongPassword() throws Exception {
        var email = email();
        register(email);
        for (var candidate : new String[] {email, email()}) {
            mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", candidate, "password", "Errada123!"))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("detail").value("E-mail ou senha inválidos."));
        }
    }

    @Test
    void actualCsrfTokenWorksAcrossLoginAndLogoutAndSessionIdRotates() throws Exception {
        var email = email();
        register(email);
        var csrfResult = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        var session = (MockHttpSession) csrfResult.getRequest().getSession(false);
        var token = json.readTree(csrfResult.getResponse().getContentAsString());
        var oldId = session.getId();
        mvc.perform(post("/api/auth/login").session(session).header(token.get("headerName").asText(), token.get("token").asText())
            .contentType(MediaType.APPLICATION_JSON).content(credentials(email))).andExpect(status().isOk());
        assertThat(session.getId()).isNotEqualTo(oldId);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("email").value(email));
        var fresh = json.readTree(mvc.perform(get("/api/auth/csrf").session(session)).andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/auth/logout").session(session).header(fresh.get("headerName").asText(), fresh.get("token").asText()))
            .andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/orders")).andExpect(status().isUnauthorized());
    }

    @Test
    void completesLifecycleWithHistoryAndRejectsTerminalTransitions() throws Exception {
        var session = login();
        var order = create(session);
        String id = order.get("id").asText();
        long version = 0;
        for (String next : new String[] {"EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE"}) {
            var result = mvc.perform(patch("/api/orders/" + id + "/status").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("status", next, "expectedVersion", version))))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value(next))
                .andExpect(jsonPath("version").value(++version)).andReturn();
            order = json.readTree(result.getResponse().getContentAsString());
        }
        assertThat(order.get("history")).hasSize(4);
        mvc.perform(get("/api/orders/" + id).session(session)).andExpect(status().isOk()).andExpect(jsonPath("history.length()").value(4));
        mvc.perform(patch("/api/orders/" + id + "/status").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("status", "CANCELADO", "expectedVersion", version))))
            .andExpect(status().isConflict()).andExpect(jsonPath("code").value("INVALID_STATUS_TRANSITION"));
        mvc.perform(get("/api/orders").param("status", "ENTREGUE").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("totalElements").value(1));
        mvc.perform(get("/api/orders/stats").session(session)).andExpect(status().isOk())
            .andExpect(jsonPath("counts.ENTREGUE").value(1)).andExpect(jsonPath("total").value(1));
    }

    @Test
    void preventsStaleUpdatesAndPreservesHistoryOnConflict() throws Exception {
        var session = login();
        var id = create(session).get("id").asText();
        mvc.perform(patch("/api/orders/" + id + "/status").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"EM_PREPARO\",\"expectedVersion\":0}")).andExpect(status().isOk());
        mvc.perform(patch("/api/orders/" + id + "/status").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"CANCELADO\",\"expectedVersion\":0}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("code").value("ORDER_CONFLICT"));
        mvc.perform(get("/api/orders/" + id).session(session)).andExpect(jsonPath("status").value("EM_PREPARO"))
            .andExpect(jsonPath("history.length()").value(2));
    }

    @Test
    void isolatesOrdersBetweenUsersIncludingStatsAndUpdates() throws Exception {
        var owner = login();
        var outsider = login();
        var id = create(owner).get("id").asText();
        mvc.perform(get("/api/orders/" + id).session(outsider)).andExpect(status().isNotFound());
        mvc.perform(get("/api/orders").session(outsider)).andExpect(jsonPath("totalElements").value(0));
        mvc.perform(get("/api/orders/stats").session(outsider)).andExpect(jsonPath("total").value(0));
        mvc.perform(patch("/api/orders/" + id + "/status").session(outsider).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"CANCELADO\",\"expectedVersion\":0}")).andExpect(status().isNotFound());
    }

    @Test
    void validatesNestedInputEnumsPaginationAndUnknownFields() throws Exception {
        var session = login();
        for (var invalid : new String[] {validOrder().replace("\"quantity\":2", "\"quantity\":0"),
            validOrder().replace("\"state\":\"SP\"", "\"state\":\"XX\""),
            validOrder().replace("29.90", "-1"), validOrder().replace("29.90", "1.001"),
            validOrder().replace("\"customerName\":", "\"unknown\":true,\"customerName\":"),
            "{\"customerName\":\"Ana\",\"deliveryAddress\":null,\"items\":[]}"}) {
            mvc.perform(post("/api/orders").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/orders").session(session).param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/orders").session(session).param("page", "-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/orders").session(session).param("status", "INVALID")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/orders/not-a-uuid").session(session)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/orders/" + UUID.randomUUID()).session(session)).andExpect(status().isNotFound());
    }

    @Test
    void validatesSignupIncludingBcryptUtf8ByteLimit() throws Exception {
        for (var password : new String[] {"123", "á".repeat(40)}) {
            mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("name", "Ana", "email", email(), "password", password))))
                .andExpect(status().isBadRequest());
        }
    }

    @Test
    void listingUsesBoundedQueriesRatherThanOneQueryPerOrder() throws Exception {
        var session = login();
        for (int i = 0; i < 8; i++) create(session);
        var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        mvc.perform(get("/api/orders").session(session)).andExpect(status().isOk()).andExpect(jsonPath("content.length()").value(8));
        // Main page + optional count + a batched items query; history isn't loaded for summaries.
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
    }
}
