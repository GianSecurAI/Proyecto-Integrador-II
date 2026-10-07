package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.service.OrderEventPublisher;
import com.armakers3d.orders.service.OrderStatusChanged;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

class OrderEventPublisherTest {

    private static final OrderStatusChanged EVENT = new OrderStatusChanged(
            "PED-000001", 7L, OrderKind.ESTANDAR, null, OrderStatus.CONFIRMADO, 5L, Rol.ASESOR, Instant.EPOCH);

    @Test
    void aFailingListenerNeverBreaksTheOrderOperation() {
        ApplicationEventPublisher spring = mock(ApplicationEventPublisher.class);
        doThrow(new IllegalStateException("smtp down")).when(spring).publishEvent(any(Object.class));

        assertThatCode(() -> new OrderEventPublisher(spring).publish(EVENT)).doesNotThrowAnyException();
        verify(spring).publishEvent(EVENT);
    }
}
