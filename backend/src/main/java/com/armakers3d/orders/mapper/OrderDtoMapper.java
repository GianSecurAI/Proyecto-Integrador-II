package com.armakers3d.orders.mapper;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.StatusHistoryEntry;
import com.armakers3d.orders.dto.AdminOrderDetailDto;
import com.armakers3d.orders.dto.AdminOrderSummaryDto;
import com.armakers3d.orders.dto.OrderHistoryEntryDto;
import com.armakers3d.orders.dto.OrderResponseDto;
import com.armakers3d.orders.dto.OrderSummaryDto;
import com.armakers3d.orders.service.OrderQueryService.StaffOrderView;
import com.armakers3d.orders.service.RegisteredPersonalizedOrder;
import java.util.List;
import java.util.Map;

/** Wire shape to use-case command and domain order to response. Only contract fields are copied. */
public final class OrderDtoMapper {

    /** Responsible label for system or customer-originated entries (contract 4.6). */
    static final String SYSTEM = "Sistema";
    /** Responsible label shown to customers for staff-originated entries: no staff identity (contract E21). */
    static final String TEAM = "Equipo Ar Makers 3D";

    private OrderDtoMapper() {}

    /** Customer-facing detail (E21): staff identity is never exposed. */
    public static OrderResponseDto toResponse(Order o) {
        var delivery = o.delivery() == null
                ? null
                : new OrderResponseDto.Delivery(o.delivery().address(), o.delivery().district(), o.delivery().notes());
        List<OrderHistoryEntryDto> history = o.history().stream().map(h -> toHistory(h, customerLabel(h))).toList();
        return new OrderResponseDto(
                o.id(), o.createdAt(), o.status(), o.kind(), summary(o), o.total(), items(o), delivery, history);
    }

    public static OrderSummaryDto toSummary(Order o) {
        return new OrderSummaryDto(o.id(), o.createdAt(), o.status(), o.kind(), summary(o), o.total());
    }

    public static AdminOrderSummaryDto toAdminSummary(StaffOrderView v) {
        Order o = v.order();
        var c = v.customer();
        return new AdminOrderSummaryDto(
                o.id(), o.createdAt(), o.status(), o.kind(), summary(o), o.total(),
                c == null ? null : c.email(), c == null ? null : c.name(), c == null ? null : c.phone());
    }

    /** Staff detail (E25, E26): history shows the staff email as responsible. */
    public static AdminOrderDetailDto toAdminDetail(StaffOrderView v) {
        Order o = v.order();
        var c = v.customer();
        return adminDetail(o, c == null ? null : c.email(), c == null ? null : c.name(), c == null ? null : c.phone(),
                v.actorEmails());
    }

    /** Staff response for a registered personalized order (E27): same shape as the detail. */
    public static AdminOrderDetailDto toPersonalizedResponse(RegisteredPersonalizedOrder r) {
        Order o = r.order();
        return adminDetail(o, r.customerEmail(), null, null, Map.of(o.registeredBy(), r.staffEmail()));
    }

    private static AdminOrderDetailDto adminDetail(
            Order o, String customerEmail, String name, String phone, Map<Long, String> actorEmails) {
        boolean personalized = o.registeredBy() != null;
        var line = o.lines().get(0);
        var delivery = o.delivery() == null
                ? null
                : new OrderResponseDto.Delivery(o.delivery().address(), o.delivery().district(), o.delivery().notes());
        List<OrderHistoryEntryDto> history = o.history().stream().map(h -> toHistory(h, adminLabel(h, actorEmails))).toList();
        return new AdminOrderDetailDto(
                o.id(), o.createdAt(), o.status(), o.kind(), summary(o), o.total(),
                personalized ? line.unitPrice() : null, personalized ? line.title() : null, items(o), delivery,
                customerEmail, name, phone,
                personalized ? actorEmails.get(o.registeredBy()) : null,
                history, o.status().allowedNext(), o.paymentReference());
    }

    private static List<OrderResponseDto.Item> items(Order o) {
        return o.lines().stream()
                .map(l -> new OrderResponseDto.Item(l.productId(), l.title(), l.unitPrice(), l.quantity(), l.lineTotal()))
                .toList();
    }

    private static OrderHistoryEntryDto toHistory(StatusHistoryEntry h, String responsible) {
        return new OrderHistoryEntryDto(h.fromStatus(), h.toStatus(), h.at(), responsible, h.note());
    }

    private static boolean isStaff(Rol role) {
        return role == Rol.ASESOR || role == Rol.ADMINISTRADOR;
    }

    private static String customerLabel(StatusHistoryEntry h) {
        return isStaff(h.actorRole()) ? TEAM : SYSTEM;
    }

    private static String adminLabel(StatusHistoryEntry h, Map<Long, String> actorEmails) {
        if (!isStaff(h.actorRole())) {
            return SYSTEM;
        }
        return actorEmails.getOrDefault(h.actorId(), TEAM);
    }

    /** Short presentation string (same wording as the SPA confirmation mock): "3 unidades: Title y 1 producto mas". */
    public static String summary(Order o) {
        if (o.kind() == com.armakers3d.orders.domain.OrderKind.PERSONALIZADO) {
            String text = o.lines().get(0).title().replaceAll("\\s+", " ");
            return "Pedido personalizado: " + (text.length() > 80 ? text.substring(0, 77) + "..." : text);
        }
        int units = o.totalUnits();
        int extra = o.lines().size() - 1;
        String more = extra > 0 ? " y " + extra + " producto" + (extra == 1 ? "" : "s") + " más" : "";
        return units + " unidad" + (units == 1 ? "" : "es") + ": " + o.lines().get(0).title() + more;
    }
}
