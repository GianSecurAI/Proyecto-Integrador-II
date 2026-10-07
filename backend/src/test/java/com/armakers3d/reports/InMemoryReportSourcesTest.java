package com.armakers3d.reports;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.infrastructure.inmemory.InMemoryIncidentRepository;
import com.armakers3d.incidents.service.IncidentReportFeed;
import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.infrastructure.inmemory.InMemoryOrderRepository;
import com.armakers3d.orders.service.OrderReportFeed;
import com.armakers3d.reports.infrastructure.inmemory.InMemoryIncidentReportSource;
import com.armakers3d.reports.infrastructure.inmemory.InMemoryOrderReportSource;
import com.armakers3d.reports.repository.IncidentReportSource;
import com.armakers3d.reports.repository.OrderReportSource;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Port contract of the in-memory adapters, over the in-memory repositories (no Spring context). */
class InMemoryReportSourcesTest {

    private static final Instant T0 = Instant.parse("2022-01-10T12:00:00Z");

    private final InMemoryOrderRepository orders = new InMemoryOrderRepository();
    private final InMemoryIncidentRepository incidents = new InMemoryIncidentRepository();
    private final OrderReportSource orderSource = new InMemoryOrderReportSource(new OrderReportFeed(orders));
    private final IncidentReportSource incidentSource =
            new InMemoryIncidentReportSource(new IncidentReportFeed(incidents));

    private Order standard(String price, int qty, Instant at) {
        return orders.save(Order.placeStandard(orders.nextOrderNumber(), 1L,
                List.of(new OrderLine(1L, "Pieza", new BigDecimal(price), qty)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana", "999888777"), at));
    }

    @Test
    void emptyStoreYieldsEveryKeyAtZero() {
        var agg = orderSource.aggregate(new OrderReportSource.Query(null, null, null));
        assertThat(agg.countByStatus()).hasSize(OrderStatus.values().length).containsValue(0L).doesNotContainValue(1L);
        assertThat(agg.countByKind()).hasSize(2);
        assertThat(agg.amountByKind().get(OrderKind.ESTANDAR)).isEqualByComparingTo("0.00");
        var inc = incidentSource.aggregate(new IncidentReportSource.Query(null, null, null));
        assertThat(inc.countByStatus()).hasSize(IncidentStatus.values().length);
        assertThat(inc.countByPriority()).hasSize(IncidentPriority.values().length);
    }

    @Test
    void windowIsInclusiveAtFromAndExclusiveAtTo() {
        standard("10.00", 1, T0);
        standard("20.00", 1, T0.plusSeconds(60));
        var agg = orderSource.aggregate(new OrderReportSource.Query(T0, T0.plusSeconds(60), null));
        assertThat(agg.countByKind().get(OrderKind.ESTANDAR)).isEqualTo(1);
        assertThat(agg.amountByKind().get(OrderKind.ESTANDAR)).isEqualByComparingTo("10.00");
    }

    @Test
    void cancelledOrdersCountButAreNotSummed() {
        standard("10.00", 2, T0);
        Order cancelled = standard("500.00", 1, T0);
        orders.save(cancelled.transitionTo(OrderStatus.CANCELADO, 9L, Rol.ASESOR, null, T0));
        var agg = orderSource.aggregate(new OrderReportSource.Query(null, null, null));
        assertThat(agg.countByStatus().get(OrderStatus.CANCELADO)).isEqualTo(1);
        assertThat(agg.countByKind().get(OrderKind.ESTANDAR)).isEqualTo(2);
        assertThat(agg.amountByKind().get(OrderKind.ESTANDAR)).isEqualByComparingTo("20.00");
    }

    @Test
    void moreThanOnePageOfOrdersIsFullyAggregated() {
        for (int i = 0; i < 250; i++) {
            standard("1.00", 1, T0.plusSeconds(i));
        }
        var agg = orderSource.aggregate(new OrderReportSource.Query(null, null, null));
        assertThat(agg.countByKind().get(OrderKind.ESTANDAR)).isEqualTo(250);
        assertThat(agg.amountByKind().get(OrderKind.ESTANDAR)).isEqualByComparingTo("250.00");
    }

    @Test
    void incidentWindowStatusFilterAndPriorityCounts() {
        incidents.save(Incident.open(incidents.nextIncidentNumber(), "PED-000001", 1L, "descripcion uno", T0));
        var second = Incident.open(incidents.nextIncidentNumber(), "PED-000001", 1L, "descripcion dos", T0.plusSeconds(60))
                .triage(IncidentStatus.EN_REVISION, IncidentPriority.ALTA, T0.plusSeconds(61));
        incidents.save(second);

        var all = incidentSource.aggregate(new IncidentReportSource.Query(null, null, null));
        assertThat(all.countByStatus().get(IncidentStatus.ABIERTA)).isEqualTo(1);
        assertThat(all.countByStatus().get(IncidentStatus.EN_REVISION)).isEqualTo(1);
        assertThat(all.countByPriority().get(IncidentPriority.ALTA)).isEqualTo(1);
        assertThat(all.countByPriority().get(IncidentPriority.MEDIA)).isEqualTo(1);

        var windowed = incidentSource.aggregate(new IncidentReportSource.Query(T0, T0.plusSeconds(60), null));
        assertThat(windowed.countByStatus().get(IncidentStatus.ABIERTA)).isEqualTo(1);
        assertThat(windowed.countByStatus().get(IncidentStatus.EN_REVISION)).isZero();

        var filtered = incidentSource.aggregate(new IncidentReportSource.Query(null, null, IncidentStatus.EN_REVISION));
        assertThat(filtered.countByStatus().get(IncidentStatus.ABIERTA)).isZero();
        assertThat(filtered.countByStatus().get(IncidentStatus.EN_REVISION)).isEqualTo(1);
    }
}
