package com.armakers3d.incidents;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentRules;
import com.armakers3d.incidents.domain.IncidentSort;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.domain.InvalidIncidentTransitionException;
import com.armakers3d.shared.error.ApiError;
import com.armakers3d.shared.error.MalformedRequestException;
import com.armakers3d.shared.error.ValidationFailedException;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/** Domain rules without Spring: the transition table (every from-to pair), triage, resolution, text rules, sort. */
class IncidentDomainTest {

    private static final Instant T0 = Instant.parse("2026-10-06T10:00:00Z");
    private static final Instant T1 = T0.plusSeconds(60);

    private static Incident inStatus(IncidentStatus target) {
        Incident i = Incident.open("INC-000001", "PED-000001", 7L, "Una descripcion suficientemente larga", T0);
        if (target == IncidentStatus.ABIERTA) {
            return i;
        }
        i = i.triage(IncidentStatus.EN_REVISION, null, T0);
        return switch (target) {
            case EN_REVISION -> i;
            case RESUELTA -> i.resolve("Resuelto", T0);
            case RECHAZADA -> i.triage(IncidentStatus.RECHAZADA, null, T0);
            default -> throw new IllegalStateException();
        };
    }

    @Test
    void aNewIncidentIsAbiertaMediaWithoutResolution() {
        Incident i = Incident.open("INC-000009", "PED-000002", 3L, "Descripcion valida y larga", T0);
        assertThat(i.status()).isEqualTo(IncidentStatus.ABIERTA);
        assertThat(i.priority()).isEqualTo(IncidentPriority.MEDIA);
        assertThat(i.resolution()).isNull();
        assertThat(i.resolvedAt()).isNull();
        assertThat(i.createdAt()).isEqualTo(T0).isEqualTo(i.updatedAt());
        assertThat(i.belongsTo(3L)).isTrue();
        assertThat(i.belongsTo(4L)).isFalse();
    }

    static Stream<Arguments> allStatusPairs() {
        List<Arguments> pairs = new java.util.ArrayList<>();
        for (IncidentStatus from : IncidentStatus.values()) {
            for (IncidentStatus to : IncidentStatus.values()) {
                pairs.add(Arguments.of(from, to));
            }
        }
        return pairs.stream();
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @MethodSource("allStatusPairs")
    void theTransitionTableAllowsExactlyTheRecommendedPairs(IncidentStatus from, IncidentStatus to) {
        Set<String> allowed = Set.of("ABIERTA>EN_REVISION", "EN_REVISION>RESUELTA", "EN_REVISION>RECHAZADA");
        assertThat(from.canTransitionTo(to)).isEqualTo(allowed.contains(from + ">" + to));
    }

    @ParameterizedTest(name = "triage {0} -> {1}")
    @MethodSource("allStatusPairs")
    void triageAppliesOnlyTheNonResolutionTransitions(IncidentStatus from, IncidentStatus to) {
        Incident start = inStatus(from);
        boolean ok = (from == IncidentStatus.ABIERTA && to == IncidentStatus.EN_REVISION)
                || (from == IncidentStatus.EN_REVISION && to == IncidentStatus.RECHAZADA);
        if (ok) {
            Incident moved = start.triage(to, null, T1);
            assertThat(moved.status()).isEqualTo(to);
            assertThat(moved.updatedAt()).isEqualTo(T1);
            assertThat(moved.createdAt()).isEqualTo(start.createdAt());
            assertThat(moved.resolution()).isNull();
            assertThat(moved.resolvedAt()).isNull();
        } else {
            assertThatThrownBy(() -> start.triage(to, null, T1)).isInstanceOf(InvalidIncidentTransitionException.class)
                    .extracting("errorCode").isEqualTo("INVALID_STATUS_TRANSITION");
        }
    }

    @ParameterizedTest
    @MethodSource("statuses")
    void resolveWorksOnlyFromEnRevision(IncidentStatus from) {
        Incident start = inStatus(from);
        if (from == IncidentStatus.EN_REVISION) {
            Incident done = start.resolve("Texto", T1);
            assertThat(done.status()).isEqualTo(IncidentStatus.RESUELTA);
            assertThat(done.resolution()).isEqualTo("Texto");
            assertThat(done.resolvedAt()).isEqualTo(T1).isEqualTo(done.updatedAt());
        } else {
            assertThatThrownBy(() -> start.resolve("Texto", T1)).isInstanceOf(InvalidIncidentTransitionException.class);
        }
    }

    static Stream<IncidentStatus> statuses() {
        return Stream.of(IncidentStatus.values());
    }

    @Test
    void priorityAndStatusAreAppliedTogetherOrNotAtAll() {
        Incident open = inStatus(IncidentStatus.ABIERTA);
        assertThatThrownBy(() -> open.triage(IncidentStatus.RECHAZADA, IncidentPriority.ALTA, T1))
                .isInstanceOf(InvalidIncidentTransitionException.class);
        Incident both = open.triage(IncidentStatus.EN_REVISION, IncidentPriority.ALTA, T1);
        assertThat(both.status()).isEqualTo(IncidentStatus.EN_REVISION);
        assertThat(both.priority()).isEqualTo(IncidentPriority.ALTA);
        assertThat(open.priority()).isEqualTo(IncidentPriority.MEDIA); // immutable
    }

    @Test
    void theSamePriorityOrNothingReturnsTheSameInstance() {
        Incident open = inStatus(IncidentStatus.ABIERTA);
        assertThat(open.triage(null, IncidentPriority.MEDIA, T1)).isSameAs(open);
        assertThat(open.triage(null, null, T1)).isSameAs(open);
    }

    @Test
    void resolvedAndRejectedAreTerminal() {
        assertThat(IncidentStatus.RESUELTA.isTerminal()).isTrue();
        assertThat(IncidentStatus.RECHAZADA.isTerminal()).isTrue();
        assertThat(IncidentStatus.ABIERTA.isTerminal()).isFalse();
        assertThat(IncidentStatus.EN_REVISION.isTerminal()).isFalse();
    }

    // ---------- rules ----------

    @Test
    void validateNewTrimsAndAcceptsTheBoundaries() {
        var ok = IncidentRules.validateNew("  PED-000001 ", "  " + "a".repeat(20) + "  ");
        assertThat(ok.orderId()).isEqualTo("PED-000001");
        assertThat(ok.description()).isEqualTo("a".repeat(20));
        assertThatCode(() -> IncidentRules.validateNew("PED-000001", "a".repeat(1000))).doesNotThrowAnyException();
        assertThatCode(() -> IncidentRules.validateNew("PED-000001", "uno de la pieza\r\ndos de la pieza"))
                .doesNotThrowAnyException();
    }

    @Test
    void validateNewCollectsEveryFieldError() {
        assertThatThrownBy(() -> IncidentRules.validateNew(null, "corto"))
                .isInstanceOfSatisfying(ValidationFailedException.class, ex -> assertThat(ex.getFieldErrors())
                        .extracting(ApiError.FieldError::field).containsExactly("orderId", "description"));
        assertThatThrownBy(() -> IncidentRules.validateNew("PED-1", "a".repeat(1001)))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> IncidentRules.validateNew("PED-\n1", "a".repeat(30)))
                .isInstanceOfSatisfying(ValidationFailedException.class, ex -> assertThat(ex.getFieldErrors())
                        .extracting(ApiError.FieldError::field).containsExactly("orderId")); // no line breaks in the id
    }

    @Test
    void validateResolutionTrimsAndEnforcesLimits() {
        assertThat(IncidentRules.validateResolution("  hecho  ")).isEqualTo("hecho");
        assertThatThrownBy(() -> IncidentRules.validateResolution("   ")).isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> IncidentRules.validateResolution(null)).isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> IncidentRules.validateResolution("x".repeat(1001)))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> IncidentRules.validateResolution("a\u0007b")).isInstanceOf(ValidationFailedException.class);
        assertThat(IncidentRules.validateResolution("x".repeat(1000))).hasSize(1000);
    }

    @Test
    void sortAcceptsOnlyReportedAtWithAnOptionalDirection() {
        assertThat(IncidentSort.parse(null).descending()).isTrue();
        assertThat(IncidentSort.parse("").descending()).isTrue();
        assertThat(IncidentSort.parse("reportedAt").descending()).isTrue();
        assertThat(IncidentSort.parse("reportedAt,asc").descending()).isFalse();
        assertThat(IncidentSort.parse("reportedAt,DESC").descending()).isTrue();
        for (String bad : List.of("priority", "reportedAt,up", "reportedAt,asc,x", "createdAt")) {
            assertThatThrownBy(() -> IncidentSort.parse(bad)).isInstanceOf(MalformedRequestException.class);
        }
    }
}
