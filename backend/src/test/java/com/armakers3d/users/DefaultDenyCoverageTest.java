package com.armakers3d.users;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.security.AccessMatrix;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.PathContainer;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.util.pattern.PathPatternParser;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Architecture-style default-deny guard (Principle VII): enumerates every Spring MVC mapping and
 * proves each {@code /api/**} endpoint is covered by an explicit rule of the central
 * {@link AccessMatrix}. A new controller without a rule fails this test (and is unreachable at
 * runtime: unmatched requests are denied). It also exercises each endpoint anonymously.
 */
class DefaultDenyCoverageTest extends AbstractNoDbRbacTest {

    /** Non-/api mappings that legitimately exist: the error page and the springdoc documentation. */
    private static final Set<String> NON_API_PREFIXES = Set.of("/error", "/api-docs", "/swagger-ui");

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;

    private record Endpoint(String method, String pattern, HandlerMethod handler) {
        String concretePath() {
            return pattern.replaceAll("\\{[^/}]+}", "1");
        }
    }

    private List<Endpoint> apiEndpoints() {
        List<Endpoint> endpoints = new ArrayList<>();
        handlerMapping.getHandlerMethods().forEach((info, handler) -> {
            Set<String> patterns = info.getPathPatternsCondition().getPatternValues();
            Set<org.springframework.web.bind.annotation.RequestMethod> methods = info.getMethodsCondition().getMethods();
            for (String pattern : patterns) {
                if (methods.isEmpty()) {
                    endpoints.add(new Endpoint("GET", pattern, handler));
                }
                methods.forEach(m -> endpoints.add(new Endpoint(m.name(), pattern, handler)));
            }
        });
        return endpoints;
    }

    private static Optional<AccessMatrix.Rule> ruleFor(String path) {
        return AccessMatrix.RULES.stream()
                .filter(r -> PathPatternParser.defaultInstance.parse(r.pattern()).matches(PathContainer.parsePath(path)))
                .findFirst();
    }

    @Test
    void everyApiEndpointIsCoveredByAnExplicitAccessRule() {
        List<Endpoint> api = apiEndpoints().stream().filter(e -> e.pattern().startsWith("/api/")).toList();

        assertThat(api).as("controller mappings under /api").isNotEmpty();
        List<String> uncovered = api.stream()
                .filter(e -> ruleFor(e.concretePath()).isEmpty())
                .map(e -> e.method() + " " + e.pattern() + " (" + e.handler().getBeanType().getSimpleName() + ")")
                .toList();
        assertThat(uncovered).as("endpoints with no rule in AccessMatrix.RULES (they would be denied)").isEmpty();
    }

    @Test
    void noMappingExistsOutsideApiExceptTheKnownInfrastructureOnes() {
        List<String> unexpected = apiEndpoints().stream()
                .map(Endpoint::pattern)
                .filter(p -> !p.startsWith("/api/"))
                .filter(p -> NON_API_PREFIXES.stream().noneMatch(p::startsWith))
                .toList();
        assertThat(unexpected).isEmpty();
    }

    @Test
    void everyRestControllerLivesInAFeatureControllerPackageAndIsMapped() {
        // Guards against a controller whose mappings escape the enumeration above.
        List<Class<?>> controllers = apiEndpoints().stream()
                .<Class<?>>map(e -> e.handler().getBeanType())
                .filter(c -> c.isAnnotationPresent(RestController.class))
                .filter(c -> c.getName().startsWith("com.armakers3d."))
                .distinct()
                .toList();
        assertThat(controllers).isNotEmpty().allSatisfy(c -> assertThat(c.getPackageName()).endsWith(".controller"));
    }

    @Test
    void anonymousCallersGet401OnEveryNonPublicEndpoint() throws Exception {
        for (Endpoint e : apiEndpoints()) {
            if (!e.pattern().startsWith("/api/")) {
                continue;
            }
            AccessMatrix.Rule rule = ruleFor(e.concretePath()).orElseThrow();
            var response = mockMvc.perform(request(HttpMethod.valueOf(e.method()), e.concretePath())
                    .contentType("application/json")
                    .content("{}"));
            if (rule.access().isPublic()) {
                int status = response.andReturn().getResponse().getStatus();
                assertThat(status).as(e.method() + " " + e.pattern()).isNotIn(401, 403);
            } else {
                response.andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
            }
        }
    }

    @Test
    void theMatrixItselfHasNoDeadOrShadowedCatchAlls() {
        // No rule may be a bare catch-all that would silently open new controllers.
        assertThat(AccessMatrix.RULES).noneMatch(r -> r.pattern().equals("/**") || r.pattern().equals("/api/**"));
        // A path under /api that no rule names is denied.
        assertThat(ruleFor("/api/some/new/feature")).isEmpty();
    }

    @Test
    void customerOrderEndpointsAreCustomerOnlyOnExplicitPaths() {
        assertThat(ruleFor("/api/orders")).get().extracting(AccessMatrix.Rule::access).isEqualTo(AccessMatrix.Access.CLIENTE);
        assertThat(ruleFor("/api/orders/PED-000001")).get().extracting(AccessMatrix.Rule::access)
                .isEqualTo(AccessMatrix.Access.CLIENTE);
        // No public tracking and no deeper or wildcard customer path exists (D-07).
        assertThat(ruleFor("/api/orders/PED-000001/tracking")).isEmpty();
        assertThat(ruleFor("/api/orders/PED-000001/status")).isEmpty();
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("POST") && e.pattern().equals("/api/orders"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/orders"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/orders/{orderId}"));
    }

    @Test
    void staffOrderEndpointsAreStaffOnlyOnExplicitPaths() {
        for (String path : List.of("/api/admin/orders", "/api/admin/orders/personalized", "/api/admin/orders/PED-000001",
                "/api/admin/orders/PED-000001/status")) {
            assertThat(ruleFor(path)).as(path).get().extracting(AccessMatrix.Rule::access)
                    .isEqualTo(AccessMatrix.Access.STAFF);
        }
        assertThat(ruleFor("/api/admin/orders/PED-000001/other")).isEmpty();
        assertThat(ruleFor("/api/admin/orders/PED-000001/status/extra")).isEmpty();
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("POST") && e.pattern().equals("/api/admin/orders/personalized"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/admin/orders"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/admin/orders/{orderId}"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("PATCH") && e.pattern().equals("/api/admin/orders/{orderId}/status"));
    }

    @Test
    void customerIncidentEndpointsAreCustomerOnlyOnExplicitPaths() {
        assertThat(ruleFor("/api/incidents")).get().extracting(AccessMatrix.Rule::access).isEqualTo(AccessMatrix.Access.CLIENTE);
        assertThat(ruleFor("/api/incidents/INC-000001")).get().extracting(AccessMatrix.Rule::access)
                .isEqualTo(AccessMatrix.Access.CLIENTE);
        assertThat(ruleFor("/api/incidents/INC-000001/resolution")).isEmpty();
        assertThat(ruleFor("/api/incidents/INC-000001/status")).isEmpty();
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("POST") && e.pattern().equals("/api/incidents"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/incidents"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/incidents/{incidentId}"));
        // the customer surface has no write other than the registration
        assertThat(apiEndpoints()).noneMatch(e -> e.pattern().startsWith("/api/incidents/")
                && !e.method().equals("GET"));
    }

    @Test
    void staffIncidentEndpointsAreStaffOnlyOnExplicitPaths() {
        for (String path : List.of("/api/admin/incidents", "/api/admin/incidents/INC-000001",
                "/api/admin/incidents/INC-000001/resolution")) {
            assertThat(ruleFor(path)).as(path).get().extracting(AccessMatrix.Rule::access)
                    .isEqualTo(AccessMatrix.Access.STAFF);
        }
        assertThat(ruleFor("/api/admin/incidents/INC-000001/other")).isEmpty();
        assertThat(ruleFor("/api/admin/incidents/INC-000001/resolution/extra")).isEmpty();
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/admin/incidents"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/admin/incidents/{incidentId}"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("PATCH") && e.pattern().equals("/api/admin/incidents/{incidentId}"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("POST") && e.pattern().equals("/api/admin/incidents/{incidentId}/resolution"));
    }

    @Test
    void reportEndpointsAreAdminOnlyOnExactPathsAndReadOnly() {
        for (String path : List.of("/api/admin/reports/orders", "/api/admin/reports/incidents")) {
            assertThat(ruleFor(path)).as(path).get().extracting(AccessMatrix.Rule::access)
                    .isEqualTo(AccessMatrix.Access.ADMIN);
        }
        assertThat(ruleFor("/api/admin/reports")).isEmpty();
        assertThat(ruleFor("/api/admin/reports/quotations")).isEmpty();
        assertThat(ruleFor("/api/admin/reports/orders/export")).isEmpty();
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/admin/reports/orders"));
        assertThat(apiEndpoints()).anyMatch(e -> e.method().equals("GET") && e.pattern().equals("/api/admin/reports/incidents"));
        assertThat(apiEndpoints()).noneMatch(e -> e.pattern().startsWith("/api/admin/reports") && !e.method().equals("GET"));
    }

    @Test
    void unlistedOrderPathsAreDeniedToEveryRole() throws Exception {
        var customer = signInAs(com.armakers3d.auth.domain.Rol.CLIENTE);
        var admin = signInAs(com.armakers3d.auth.domain.Rol.ADMINISTRADOR);
        mockMvc.perform(request(HttpMethod.GET, "/api/orders/PED-000001/tracking").cookie(customer)).andExpect(status().isForbidden());
        mockMvc.perform(request(HttpMethod.GET, "/api/admin/orders/PED-000001/history").cookie(admin)).andExpect(status().isForbidden());
        mockMvc.perform(request(HttpMethod.GET, "/api/admin/orders/PED-000001/history").cookie(customer)).andExpect(status().isForbidden());
    }
}
