package com.armakers3d.orders;

import com.armakers3d.orders.infrastructure.inmemory.InMemoryOrderRepository;
import com.armakers3d.orders.repository.OrderRepository;

class InMemoryOrderRepositoryTest extends OrderRepositoryContractTest {

    @Override
    protected OrderRepository createRepository() {
        return new InMemoryOrderRepository();
    }
}
