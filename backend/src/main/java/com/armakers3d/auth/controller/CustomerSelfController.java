package com.armakers3d.auth.controller;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.dto.ClienteResponseDto;
import com.armakers3d.auth.security.RequireRole;
import com.armakers3d.auth.security.SessionAuthenticationFilter;
import com.armakers3d.auth.service.ClienteService;
import com.armakers3d.shared.error.ForbiddenException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Minimal protected sample endpoints (T051) demonstrating this feature's authorization boundary
 * (FR-016, User Story 4) for the {@code security-reviewer} agent and this feature's own security
 * tests — not a full customer-profile feature (that is RF-04, out of scope here).
 */
@RestController
@RequestMapping("/api/customers")
public class CustomerSelfController {

    private final ClienteService clienteService;

    public CustomerSelfController(ClienteService clienteService) {
        this.clienteService = clienteService;
    }

    /** Always returns the caller's own data, taken from the session — no path parameter to trust. */
    @GetMapping("/me")
    @RequireRole(Rol.CLIENTE)
    public ClienteResponseDto me(HttpServletRequest request) {
        Long clienteId = currentClienteId(request);
        return toDto(clienteService.getById(clienteId));
    }

    /**
     * Object-level check (Constitution Principle VII): a CLIENTE session may only read its own
     * row, matched against the session's clienteId, never the path variable alone.
     */
    @GetMapping("/{id}")
    @RequireRole(Rol.CLIENTE)
    public ClienteResponseDto byId(@PathVariable Long id, HttpServletRequest request) {
        Long clienteId = currentClienteId(request);
        if (!id.equals(clienteId)) {
            throw new ForbiddenException("You may only access your own account data.");
        }
        return toDto(clienteService.getById(id));
    }

    /** Administrator-only capability, used to prove a CLIENTE session is denied (FR-016). */
    @GetMapping
    @RequireRole(Rol.ADMINISTRADOR)
    public List<ClienteResponseDto> list() {
        return clienteService.listAll().stream().map(this::toDto).toList();
    }

    private Long currentClienteId(HttpServletRequest request) {
        return (Long) request.getAttribute(SessionAuthenticationFilter.ATTR_CLIENTE_ID);
    }

    private ClienteResponseDto toDto(Cliente cliente) {
        return new ClienteResponseDto(cliente.getId(), cliente.getEmail(), cliente.getRol(), cliente.getCreatedAt());
    }
}
