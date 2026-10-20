package com.foody.tracker;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foody.tracker.auth.infra.UserRepository;
import com.foody.tracker.orders.infra.OrderRepository;
import com.foody.tracker.orders.domain.OrderStatus;
import jakarta.persistence.EntityManagerFactory;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.dao.DataIntegrityViolationException;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired OrderRepository orderRepository;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired com.foody.tracker.orders.application.OrderUpdates updates;
    @Autowired org.springframework.context.ApplicationEventPublisher events;

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
    void emitsOnlyCommittedChangesToTheOwner() throws Exception {
        var session = login();
        var owner = ((com.foody.tracker.auth.application.AuthenticatedUser)
            ((org.springframework.security.core.context.SecurityContext) session.getAttribute("SPRING_SECURITY_CONTEXT"))
                .getAuthentication().getPrincipal()).id();
        var received = new java.util.ArrayList<com.foody.tracker.orders.application.OrderChanged>();
        var outsiders = new java.util.ArrayList<com.foody.tracker.orders.application.OrderChanged>();
        var unsubscribe = updates.subscribe(owner, received::add);
        var unsubscribeOutsider = updates.subscribe(UUID.randomUUID(), outsiders::add);
        try {
            var id = create(session).get("id").asText();
            assertThat(received).hasSize(1);
            assertThat(received.getFirst().orderId()).isEqualTo(UUID.fromString(id));
            mvc.perform(patch("/api/orders/" + id + "/status").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"EM_PREPARO\",\"expectedVersion\":0}")).andExpect(status().isOk());
            assertThat(received).hasSize(2);
            new TransactionTemplate(transactionManager).executeWithoutResult(transaction -> {
                events.publishEvent(new com.foody.tracker.orders.application.OrderChanged(owner, UUID.randomUUID()));
                transaction.setRollbackOnly();
            });
            assertThat(received).hasSize(2);
            assertThat(outsiders).isEmpty();
        } finally { unsubscribe.run(); unsubscribeOutsider.run(); }
    }

    @Test
    void streamRequiresAuthenticationAndFlushesReadyEvent() throws Exception {
        mvc.perform(get("/api/orders/events")).andExpect(status().isUnauthorized());
        var session = login();
        var stream = mvc.perform(get("/api/orders/events").session(session))
            .andExpect(status().isOk()).andExpect(request().asyncStarted())
            .andExpect(header().string("X-Accel-Buffering", "no")).andReturn();
        assertThat(stream.getResponse().getContentAsString()).contains("event:ready");
        mvc.perform(put("/api/profile/password").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"currentPassword\":\"SenhaForte123!\",\"newPassword\":\"OutraSenha123!\",\"expectedVersion\":0}"))
            .andExpect(status().isOk());
        create(session);
        assertThat(stream.getResponse().getContentAsString()).contains("event:orders-changed").doesNotContain("event:session-expired");
        stream.getRequest().getAsyncContext().complete();
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
    void twoSimultaneousTransactionsCannotBothCommitAStatusChange() throws Exception {
        var session = login();
        var id = UUID.fromString(create(session).get("id").asText());
        var transactions = new TransactionTemplate(transactionManager);
        var bothLoaded = new CountDownLatch(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> prepare = () -> concurrentChange(transactions, bothLoaded, id, OrderStatus.EM_PREPARO);
            Callable<Boolean> cancel = () -> concurrentChange(transactions, bothLoaded, id, OrderStatus.CANCELADO);
            var results = executor.invokeAll(List.of(prepare, cancel), 15, TimeUnit.SECONDS);
            assertThat(results.stream().filter(result -> {
                try { return result.get(); } catch (Exception exception) { throw new AssertionError(exception); }
            }).count()).isEqualTo(1);
        }
        mvc.perform(get("/api/orders/" + id).session(session)).andExpect(status().isOk())
            .andExpect(jsonPath("version").value(1)).andExpect(jsonPath("history.length()").value(2));
    }

    private boolean concurrentChange(TransactionTemplate transactions, CountDownLatch loaded, UUID id, OrderStatus next) {
        try {
            return Boolean.TRUE.equals(transactions.execute(transaction -> {
                var order = orderRepository.findById(id).orElseThrow();
                // Force both transactions to observe the same version before either writes.
                order.getHistory();
                loaded.countDown();
                try {
                    if (!loaded.await(10, TimeUnit.SECONDS)) throw new AssertionError("Concurrent transaction did not start");
                } catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new AssertionError(exception); }
                order.changeStatus(next, order.getOwnerId(), Instant.now());
                orderRepository.flush();
                return true;
            }));
        } catch (ObjectOptimisticLockingFailureException | DataIntegrityViolationException conflict) {
            return false;
        }
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
