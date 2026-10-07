package com.armakers3d.catalog;

import com.armakers3d.catalog.infrastructure.inmemory.InMemoryProductRepository;
import com.armakers3d.catalog.repository.ProductRepository;

/** Runs the shared port contract against the in-memory adapter. */
class InMemoryProductRepositoryTest extends ProductRepositoryContractTest {

    @Override
    protected ProductRepository createRepository() {
        return new InMemoryProductRepository();
    }
}
