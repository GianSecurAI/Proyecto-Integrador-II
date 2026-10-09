package com.armakers3d.payments.infrastructure.jpa;

import com.armakers3d.payments.storage.ProofStorage;
import com.armakers3d.payments.storage.ProofStorageException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * PostgreSQL-backed {@link ProofStorage} over {@code comprobante_imagen}: the bytes of each proof live in the database
 * next to the {@code comprobante_pago} row that references them, so they are covered by the same backups. Selected by
 * {@code app.persistence.proofs=jpa}. The in-memory capacity caps do not apply: the size of every image is bounded by
 * the upload limits and the volume by the database, not by the JVM heap.
 */
@Component
@ConditionalOnProperty(name = "app.persistence.proofs", havingValue = "jpa")
public class JpaProofStorage implements ProofStorage {

    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional
    public void store(String checkoutId, String key, byte[] content) {
        if (em.find(ComprobanteImagenEntity.class, key) != null) {
            throw new ProofStorageException(ProofStorageException.Reason.DUPLICATE_KEY);
        }
        em.persist(new ComprobanteImagenEntity(key, content.clone()));
        em.flush();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<byte[]> load(String key) {
        ComprobanteImagenEntity entity = em.find(ComprobanteImagenEntity.class, key);
        return entity == null ? Optional.empty() : Optional.of(entity.getContent().clone());
    }

    @Override
    @Transactional
    public void delete(String key) {
        ComprobanteImagenEntity entity = em.find(ComprobanteImagenEntity.class, key);
        if (entity != null) {
            em.remove(entity);
        }
    }
}
