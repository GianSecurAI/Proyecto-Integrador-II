package com.armakers3d.notifications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.notifications.service.OrderNotificationService;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.service.OrderEventPublisher;
import com.armakers3d.orders.service.OrderStatusChanged;
import com.armakers3d.testsupport.CapturingEmailSender;
import com.armakers3d.users.service.CustomerDirectoryService;
import com.armakers3d.users.service.CustomerDirectoryService.ContactView;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;

class OrderNotificationServiceTest {

    private final CapturingEmailSender sender = new CapturingEmailSender();
    private final CustomerDirectoryService directory = mock(CustomerDirectoryService.class);
    private final OrderNotificationService service =
            new OrderNotificationService(sender, directory, "https://app.example");
    private ListAppender<ILoggingEvent> logs;
    private Logger logger;

    @BeforeEach
    void setUp() {
        when(directory.contactsByIds(any())).thenReturn(
                Map.of(7L, new ContactView(7L, "cliente@example.test", "Ana Perez", "999888777")));
        logger = (Logger) LoggerFactory.getLogger("com.armakers3d.audit.notifications");
        logs = new ListAppender<>();
        logs.start();
        logger.addAppender(logs);
        logger.setLevel(Level.INFO);
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(logs);
    }

    private static OrderStatusChanged event(OrderStatus from, OrderStatus to) {
        return new OrderStatusChanged("PED-000001", 7L, OrderKind.ESTANDAR, from, to, 99L, Rol.ASESOR, Instant.now());
    }

    @ParameterizedTest
    @EnumSource(value = OrderStatus.class, names = {"CONFIRMADO", "EN_PRODUCCION", "ENVIADO", "ENTREGADO"})
    void notifyingStatusSendsOneEmailToTheOrdersCustomer(OrderStatus status) {
        service.onOrderStatusChanged(event(OrderStatus.PENDIENTE, status));

        assertThat(sender.getSent()).hasSize(1);
        assertThat(sender.getSent().get(0).to()).isEqualTo("cliente@example.test");
        assertThat(sender.getSent().get(0).body()).contains("PED-000001");
        assertThat(logs.list).extracting(ILoggingEvent::getFormattedMessage)
                .containsExactly("notification.sent order=PED-000001 status=" + status);
    }

    @ParameterizedTest
    @EnumSource(value = OrderStatus.class, names = {"PENDIENTE", "CANCELADO"})
    void nonNotifyingStatusSendsNothingAndDoesNotEvenLookUpTheCustomer(OrderStatus status) {
        service.onOrderStatusChanged(event(null, status));

        assertThat(sender.getSent()).isEmpty();
        assertThat(logs.list).isEmpty();
        verifyNoInteractions(directory);
    }

    @Test
    void senderFailureIsSwallowedAndAuditedWithoutAddressOrBody() {
        sender.setFailing(true);

        service.onOrderStatusChanged(event(OrderStatus.CONFIRMADO, OrderStatus.EN_PRODUCCION));

        assertThat(sender.getSent()).isEmpty();
        assertThat(logs.list).hasSize(1);
        String msg = logs.list.get(0).getFormattedMessage();
        assertThat(msg).isEqualTo("notification.failed order=PED-000001 status=EN_PRODUCCION cause=EmailDeliveryException");
        assertThat(msg).doesNotContain("example.test").doesNotContain("Ana");
    }

    @Test
    void missingRecipientIsAuditedNotThrown() {
        when(directory.contactsByIds(any())).thenReturn(Map.of());

        service.onOrderStatusChanged(event(OrderStatus.CONFIRMADO, OrderStatus.ENVIADO));

        assertThat(sender.getSent()).isEmpty();
        assertThat(logs.list.get(0).getFormattedMessage()).contains("notification.failed").contains("RecipientNotFound");
    }

    @Test
    void directoryFailureIsSwallowed() {
        when(directory.contactsByIds(any())).thenThrow(new IllegalStateException("db down"));

        service.onOrderStatusChanged(event(OrderStatus.CONFIRMADO, OrderStatus.ENVIADO));

        assertThat(sender.getSent()).isEmpty();
        assertThat(logs.list.get(0).getFormattedMessage()).contains("IllegalStateException").doesNotContain("db down");
    }

    @Test
    void failingListenerBehindThePublisherNeverReachesTheCaller() {
        sender.setFailing(true);
        ApplicationEventPublisher direct = e -> service.onOrderStatusChanged((OrderStatusChanged) e);
        new OrderEventPublisher(direct).publish(event(OrderStatus.CONFIRMADO, OrderStatus.EN_PRODUCCION));
        assertThat(sender.getSent()).isEmpty();
    }

    @Test
    void blankBaseUrlFailsFast() {
        assertThatThrownBy(() -> new OrderNotificationService(sender, directory, " "))
                .isInstanceOf(IllegalStateException.class);
    }
}
