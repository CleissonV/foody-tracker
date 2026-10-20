package com.foody.tracker;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foody.tracker.auth.application.AuthService;
import com.foody.tracker.shared.api.ApiException;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProfileIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AuthService authService;

    private String email() { return UUID.randomUUID() + "@example.com"; }
    private String body(Object value) throws Exception { return json.writeValueAsString(value); }

    private MockHttpSession account(String email) throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("name", "Ana Teste", "email", email, "password", "SenhaForte123!"))))
            .andExpect(status().isCreated());
        return login(email, "SenhaForte123!");
    }

    private MockHttpSession login(String email, String password) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("email", email, "password", password)))).andExpect(status().isOk())
            .andReturn().getRequest().getSession(false);
    }

    private JsonNode me(MockHttpSession session) throws Exception {
        return json.readTree(mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
    }

    @Test
    void updatesNameAndReturnsFreshDataInAnotherSession() throws Exception {
        var email = email();
        var session = account(email);
        var second = login(email, "SenhaForte123!");
        mvc.perform(patch("/api/profile").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("name", "Ana Oliveira", "email", email, "expectedVersion", 0))))
            .andExpect(status().isOk()).andExpect(jsonPath("name").value("Ana Oliveira"))
            .andExpect(jsonPath("version").value(1)).andExpect(jsonPath("avatarUrl").isEmpty());
        assertThat(me(second).get("name").asText()).isEqualTo("Ana Oliveira");
        mvc.perform(patch("/api/profile").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("name", "Nome antigo", "email", email, "expectedVersion", 0))))
            .andExpect(status().isConflict()).andExpect(jsonPath("code").value("PROFILE_CONFLICT"));
        assertThat(me(session).get("name").asText()).isEqualTo("Ana Oliveira");
    }

    @Test
    void requiresCurrentPasswordForEmailChangeAndRevokesOtherSessions() throws Exception {
        var email = email();
        var session = account(email);
        var second = login(email, "SenhaForte123!");
        var newEmail = email();
        mvc.perform(patch("/api/profile").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("name", "Ana", "email", newEmail, "expectedVersion", 0))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_CURRENT_PASSWORD"));
        mvc.perform(patch("/api/profile").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("name", "Ana", "email", newEmail.toUpperCase(), "currentPassword", "SenhaForte123!", "expectedVersion", 0))))
            .andExpect(status().isOk()).andExpect(jsonPath("email").value(newEmail));
        assertThat(me(session).get("email").asText()).isEqualTo(newEmail);
        mvc.perform(get("/api/orders").session(second)).andExpect(status().isUnauthorized()).andExpect(jsonPath("code").value("SESSION_REVOKED"));
        assertThat(second.isInvalid()).isTrue();
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("email", email, "password", "SenhaForte123!")))).andExpect(status().isUnauthorized());
        login(newEmail, "SenhaForte123!");
    }

    @Test
    void rejectsEmailAlreadyOwnedByAnotherAccount() throws Exception {
        var email = email();
        var session = account(email);
        var existing = email();
        account(existing);
        mvc.perform(patch("/api/profile").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("name", "Ana", "email", existing, "currentPassword", "SenhaForte123!", "expectedVersion", 0))))
            .andExpect(status().isConflict()).andExpect(jsonPath("code").value("EMAIL_ALREADY_EXISTS"));
        assertThat(me(session).get("email").asText()).isEqualTo(email);
    }

    @Test
    void changesPasswordPreservesCurrentSessionAndRevokesOthers() throws Exception {
        var email = email();
        var session = account(email);
        var second = login(email, "SenhaForte123!");
        var oldId = session.getId();
        mvc.perform(put("/api/profile/password").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("currentPassword", "Errada123!", "newPassword", "NovaSenha123!", "expectedVersion", 0))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_CURRENT_PASSWORD"));
        mvc.perform(put("/api/profile/password").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("currentPassword", "SenhaForte123!", "newPassword", "NovaSenha123!", "expectedVersion", 0))))
            .andExpect(status().isOk()).andExpect(jsonPath("version").value(1));
        assertThat(session.getId()).isNotEqualTo(oldId);
        var currentUser = me(session);
        assertThatThrownBy(() -> authService.refreshedPrincipal(UUID.fromString(currentUser.get("id").asText()), 0))
            .isInstanceOfSatisfying(ApiException.class, exception -> assertThat(exception.code()).isEqualTo("SESSION_REVOKED"));
        mvc.perform(get("/api/auth/me").session(second)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body(Map.of("email", email, "password", "SenhaForte123!")))).andExpect(status().isUnauthorized());
        login(email, "NovaSenha123!");
    }

    @Test
    void uploadsReencodesAndRemovesOnlyOwnAvatar() throws Exception {
        var owner = account(email());
        var outsider = account(email());
        var image = new BufferedImage(80, 40, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        graphics.setColor(Color.RED); graphics.fillRect(0, 0, 80, 40); graphics.dispose();
        var output = new ByteArrayOutputStream(); ImageIO.write(image, "jpg", output);
        var file = new MockMultipartFile("file", "picture.jpg", "image/jpeg", output.toByteArray());
        mvc.perform(multipart("/api/profile/avatar").file(file).with(request -> { request.setMethod("PUT"); return request; }).session(owner).with(csrf()))
            .andExpect(status().isOk()).andExpect(jsonPath("avatarUrl").value("/api/profile/avatar?v=1"));
        var response = mvc.perform(get("/api/profile/avatar").session(owner)).andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.IMAGE_PNG)).andReturn().getResponse();
        var processed = ImageIO.read(new ByteArrayInputStream(response.getContentAsByteArray()));
        assertThat(processed.getWidth()).isEqualTo(256); assertThat(processed.getHeight()).isEqualTo(256);
        mvc.perform(get("/api/profile/avatar").session(outsider)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/profile/avatar").session(owner).with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("avatarUrl").isEmpty());
        mvc.perform(get("/api/profile/avatar").session(owner)).andExpect(status().isNotFound());
    }

    @Test
    void rejectsDisguisedFilesOversizedFilesAndMissingCsrf() throws Exception {
        var session = account(email());
        var invalid = new MockMultipartFile("file", "fake.png", "image/png", "<svg xmlns='http://www.w3.org/2000/svg'></svg>".getBytes());
        mvc.perform(multipart("/api/profile/avatar").file(invalid).with(request -> { request.setMethod("PUT"); return request; }).session(session).with(csrf()))
            .andExpect(status().isUnsupportedMediaType());
        var huge = new MockMultipartFile("file", "huge.png", "image/png", new byte[2 * 1024 * 1024 + 1]);
        mvc.perform(multipart("/api/profile/avatar").file(huge).with(request -> { request.setMethod("PUT"); return request; }).session(session).with(csrf()))
            .andExpect(status().isPayloadTooLarge());
        mvc.perform(patch("/api/profile").session(session).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden());
    }

    @Test
    void rejectsSameShortAndOversizedUtf8Passwords() throws Exception {
        var session = account(email());
        for (var next : new String[] {"SenhaForte123!", "short", "á".repeat(40)}) {
            mvc.perform(put("/api/profile/password").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("currentPassword", "SenhaForte123!", "newPassword", next, "expectedVersion", 0))))
                .andExpect(status().isBadRequest());
        }
    }
}
