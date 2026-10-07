package com.armakers3d.catalog.infrastructure.inmemory;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.domain.ProductRules;
import com.armakers3d.catalog.repository.ProductRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Dev/test product seed, derived from the frontend mock products (catalog and admin fixtures) with
 * server-generated ids. Active ONLY under the {@code nodb} and {@code test} profiles and only when
 * the in-memory adapter is selected; never in local, default or prod. Obviously fake, brand-neutral
 * data. Digital-download products from the mocks are dropped (D-10), and so are
 * {@code compareAtPrice}, {@code badge} and {@code personalizable} (D-08, D-09). Two products are
 * unavailable so the admin/public visibility difference can be exercised.
 */
@Component
@Profile({"nodb", "test"})
@ConditionalOnProperty(name = "app.persistence.catalog", havingValue = "memory", matchIfMissing = true)
public class CatalogDevSeed implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CatalogDevSeed.class);

    private record Seed(
            ProductCategory category,
            String subcategory,
            String title,
            String price,
            String description,
            List<String> characteristics,
            boolean available) {}

    private static final List<Seed> SEEDS = List.of(
            new Seed(ProductCategory.LLAVERO, "Llaveros personalizados", "Llavero con silueta de mascota", "21.90",
                    "Llavero impreso en PLA con la silueta de tu mascota, acabado mate.",
                    List.of("Material: PLA", "Alto impacto a la caida", "Incluye argolla metalica"), true),
            new Seed(ProductCategory.LLAVERO, "Llaveros grabados", "Llavero con iniciales grabadas", "17.90",
                    "Llavero rectangular con iniciales o texto corto grabado en relieve.",
                    List.of("Material: PETG", "Texto de hasta 8 caracteres"), true),
            new Seed(ProductCategory.LLAVERO, "Llaveros geometricos", "Llavero geometrico minimalista", "14.50",
                    "Diseno geometrico minimalista en una sola pieza, sin ensamblaje.", List.of(), false),
            new Seed(ProductCategory.LLAVERO, "Llaveros retro", "Llavero con diseno retro", "19.90",
                    "Llavero con estetica retro impreso en dos colores.", List.of("Material: PLA"), true),
            new Seed(ProductCategory.LLAVERO, "Llaveros a doble cara", "Llavero de doble cara", "26.90",
                    "Llavero con un diseno distinto en cada cara.", List.of("Material: PLA", "Doble cara"), true),
            new Seed(ProductCategory.PEGATINAS, "Pegatinas personalizadas", "Set de pegatinas con forma personalizada",
                    "14.50", "Set de 6 pegatinas troqueladas con la forma y el diseno acordados.",
                    List.of("Vinilo resistente al agua", "Set de 6 unidades"), true),
            new Seed(ProductCategory.PEGATINAS, "Pegatinas holográficas", "Set de pegatinas holográficas surtidas",
                    "9.90", "Set surtido de 10 pegatinas holográficas de disenos decorativos.", List.of(), true),
            new Seed(ProductCategory.PEGATINAS, "Mini pegatinas", "Set de mini pegatinas de iconos", "7.90",
                    "Mini pegatinas de iconos en vinilo.", List.of(), true),
            new Seed(ProductCategory.PEGATINAS, "Pegatinas resistentes", "Pegatinas resistentes al agua", "11.50",
                    "Pegatinas de vinilo laminado, resistentes al agua y a la luz solar directa.",
                    List.of("Vinilo laminado", "Resistente a rayos UV"), false),
            new Seed(ProductCategory.PEGATINAS, "Pegatinas a medida", "Pegatinas con nombre y diseno a medida",
                    "12.90", "Pegatinas con nombre y diseno a medida.", List.of("Vinilo resistente al agua"), true));

    private final ProductRepository repository;
    private final Clock clock;

    public CatalogDevSeed(ProductRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Override
    public void run(String... args) {
        Instant base = clock.instant();
        int n = SEEDS.size();
        for (int i = 0; i < n; i++) {
            Seed s = SEEDS.get(i);
            var data = ProductRules.normalize(
                    s.title(), s.category(), s.subcategory(), s.description(), new BigDecimal(s.price()), s.characteristics());
            // Staggered creation times: the first seed is the oldest, so createdAt,desc lists the last first.
            Instant created = base.minusSeconds(3600L * (n - i));
            Product product = Product.create(data, created).withAvailability(s.available(), created);
            repository.save(product);
        }
        log.info("catalog.devseed.created count={}", n);
    }
}
