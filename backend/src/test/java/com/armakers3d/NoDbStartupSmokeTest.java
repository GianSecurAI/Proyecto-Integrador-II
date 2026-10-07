package com.armakers3d;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Foundation smoke test: the app boots with no database (profile {@code nodb}). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("nodb")
class NoDbStartupSmokeTest {

    @Autowired private MockMvc mockMvc;

    @Test
    void healthEndpointIsUp() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void unknownEndpointIsDeniedByDefaultWithTheStandardErrorEnvelope() throws Exception {
        // Default-deny: an unmapped /api route is 401 for anonymous callers (not 404), so route
        // existence is not enumerable without a session.
        mockMvc.perform(get("/api/does-not-exist"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void otherActuatorEndpointsAreNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
    }

    @Test
    void corsPreflightAllowsAngularDevOrigin() throws Exception {
        mockMvc.perform(
                        options("/api/x")
                                .header("Origin", "http://localhost:4200")
                                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk());
    }
}
