package com.armakers3d.auth.service;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.repository.ClienteRepository;
import com.armakers3d.shared.error.NotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Backs the sample protected customer endpoints (T051) used to prove this feature's
 * authorization boundary. Kept intentionally minimal — full customer-profile management is a
 * separate, not-yet-specified feature (RF-04); this exists only so controllers never call
 * {@link ClienteRepository} directly (Prohibited Practices #4).
 */
@Service
public class ClienteService {

    private final ClienteRepository clienteRepository;

    public ClienteService(ClienteRepository clienteRepository) {
        this.clienteRepository = clienteRepository;
    }

    @Transactional(readOnly = true)
    public Cliente getById(Long id) {
        return clienteRepository.findById(id).orElseThrow(() -> new NotFoundException("Customer not found."));
    }

    @Transactional(readOnly = true)
    public List<Cliente> listAll() {
        return clienteRepository.findAll();
    }
}
