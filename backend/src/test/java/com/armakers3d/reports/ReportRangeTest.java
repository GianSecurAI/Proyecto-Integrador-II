package com.armakers3d.reports;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.reports.domain.ReportRange;
import com.armakers3d.shared.error.ValidationFailedException;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class ReportRangeTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 6);

    @Test
    void absentBoundsDefaultToThirtyDaysEndingToday() {
        var r = ReportRange.resolve(null, null, TODAY);
        assertThat(r.to()).isEqualTo(TODAY);
        assertThat(r.from()).isEqualTo(TODAY.minusDays(29));
    }

    @Test
    void absentFromIsThirtyDaysBeforeAnExplicitTo() {
        var r = ReportRange.resolve(null, LocalDate.of(2021, 6, 30), TODAY);
        assertThat(r.from()).isEqualTo(LocalDate.of(2021, 6, 1));
    }

    @Test
    void sameDayRangeIsValid() {
        assertThat(ReportRange.resolve(TODAY, TODAY, TODAY)).isEqualTo(new ReportRange(TODAY, TODAY));
    }

    @Test
    void fromAfterToIsRejected() {
        assertThatThrownBy(() -> ReportRange.resolve(TODAY, TODAY.minusDays(1), TODAY))
                .isInstanceOf(ValidationFailedException.class);
        // an explicit future from with no to is also from > to (to defaults to today)
        assertThatThrownBy(() -> ReportRange.resolve(TODAY.plusDays(1), null, TODAY))
                .isInstanceOf(ValidationFailedException.class);
    }

    @Test
    void capIs366DaysInclusive() {
        LocalDate from = LocalDate.of(2020, 1, 1);
        assertThat(ReportRange.resolve(from, from.plusDays(365), TODAY)).isNotNull();
        assertThatThrownBy(() -> ReportRange.resolve(from, from.plusDays(366), TODAY))
                .isInstanceOf(ValidationFailedException.class);
    }

    @Test
    void instantsAreLimaMidnightsWithAnExclusiveEnd() {
        var r = new ReportRange(LocalDate.of(2020, 3, 1), LocalDate.of(2020, 3, 31));
        assertThat(r.fromInstant()).isEqualTo(Instant.parse("2020-03-01T05:00:00Z"));
        assertThat(r.toExclusiveInstant()).isEqualTo(Instant.parse("2020-04-01T05:00:00Z"));
    }
}
