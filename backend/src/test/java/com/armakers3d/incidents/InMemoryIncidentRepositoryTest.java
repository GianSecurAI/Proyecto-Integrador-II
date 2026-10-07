package com.armakers3d.incidents;

import com.armakers3d.incidents.infrastructure.inmemory.InMemoryIncidentRepository;
import com.armakers3d.incidents.repository.IncidentRepository;

class InMemoryIncidentRepositoryTest extends IncidentRepositoryContractTest {

    @Override
    protected IncidentRepository createRepository() {
        return new InMemoryIncidentRepository();
    }
}
