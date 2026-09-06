import { CatalogProduct } from '../../../shared/models/catalog-product.model';

/**
 * MOCK DATA — not backed by any API. RF-07/RF-08 (catalog browsing) is
 * `SUPPORTED_BY_REQUIREMENTS` per docs/discovery/05-figma-analysis.md §1, but the real domain
 * model and REST contract are still being finalized (direct Product Owner instruction, this
 * session) — so this file stands in for a future `CatalogService` HTTP call (see
 * `services/catalog.service.ts`).
 *
 * Product names and prices are original/brand-neutral, same rule as
 * `features/home/mocks/home-products.mock.ts`: the equivalent Figma Catalogo cards show a
 * different company's real product photography and copy, none of which belongs to this project.
 * Prices are invented, plausible Peruvian soles amounts (Ar Makers 3D is a Peru-based business
 * per project requirements).
 *
 * `category` deliberately uses the same three-value vocabulary as `CatalogCategory`
 * ('descarga-digital' | 'llavero' | 'pegatinas') instead of the freeform categories Home's mock
 * uses, so the toolbar pills / sidebar radio list can filter directly on this field without a
 * separate category-mapping layer. `subcategory` stays a human-readable descriptor, same as Home.
 *
 * Deliberately includes:
 * - on-sale items (`compareAtPrice` set) in every category, for "Solo en oferta".
 * - personalizable items in "llavero" and "pegatinas" but NONE in "descarga-digital" (a digital
 *   file has nothing physical to personalize) — this is the intentional zero-result combination
 *   used by the empty-state test (category=descarga-digital + personalizableOnly=true).
 * - a price spread from S/ 7.90 to S/ 59.90 so min/max price filtering is meaningfully testable.
 */
export const CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: 'llavero-diseno-naranja',
    category: 'llavero',
    subcategory: 'Llaveros impresos en 3D',
    title: 'Llavero impreso en 3D — diseño naranja',
    price: 19.9,
    personalizable: true,
  },
  {
    id: 'llavero-1',
    category: 'llavero',
    subcategory: 'Llaveros personalizados',
    title: 'Llavero con silueta de mascota',
    price: 21.9,
    personalizable: true,
  },
  {
    id: 'llavero-2',
    category: 'llavero',
    subcategory: 'Llaveros grabados',
    title: 'Llavero con iniciales grabadas',
    price: 17.9,
    compareAtPrice: 22.0,
    personalizable: true,
  },
  {
    id: 'llavero-3',
    category: 'llavero',
    subcategory: 'Llaveros geométricos',
    title: 'Llavero geométrico minimalista',
    price: 14.5,
  },
  {
    id: 'llavero-4',
    category: 'llavero',
    subcategory: 'Llaveros retro',
    title: 'Llavero con diseño retro',
    price: 19.9,
    badge: 'Popular',
  },
  {
    id: 'llavero-5',
    category: 'llavero',
    subcategory: 'Llaveros a doble cara',
    title: 'Llavero de doble cara personalizado',
    price: 26.9,
    compareAtPrice: 32.0,
    personalizable: true,
  },
  {
    id: 'pegatinas-1',
    category: 'pegatinas',
    subcategory: 'Pegatinas personalizadas',
    title: 'Set de pegatinas con forma personalizada',
    price: 14.5,
    compareAtPrice: 18.0,
    personalizable: true,
  },
  {
    id: 'pegatinas-2',
    category: 'pegatinas',
    subcategory: 'Pegatinas holográficas',
    title: 'Set de pegatinas holográficas surtidas',
    price: 9.9,
  },
  {
    id: 'pegatinas-3',
    category: 'pegatinas',
    subcategory: 'Pegatinas a medida',
    title: 'Pegatinas con nombre y diseño a medida',
    price: 12.9,
    personalizable: true,
  },
  {
    id: 'pegatinas-4',
    category: 'pegatinas',
    subcategory: 'Mini pegatinas',
    title: 'Set de mini pegatinas de íconos',
    price: 7.9,
  },
  {
    id: 'pegatinas-5',
    category: 'pegatinas',
    subcategory: 'Pegatinas resistentes',
    title: 'Pegatinas resistentes al agua',
    price: 11.5,
    badge: 'Nuevo',
  },
  {
    id: 'digital-1',
    category: 'descarga-digital',
    subcategory: 'Modelos 3D descargables',
    title: 'Modelo 3D descargable de figura decorativa',
    price: 15.0,
  },
  {
    id: 'digital-2',
    category: 'descarga-digital',
    subcategory: 'Archivos STL',
    title: 'Set de archivos STL de organizador modular',
    price: 29.9,
    compareAtPrice: 39.9,
  },
  {
    id: 'digital-3',
    category: 'descarga-digital',
    subcategory: 'Plantillas imprimibles',
    title: 'Plantilla imprimible de letras decorativas',
    price: 8.5,
  },
  {
    id: 'digital-4',
    category: 'descarga-digital',
    subcategory: 'Archivos STL',
    title: 'Paquete de archivos STL de macetas geométricas',
    price: 34.9,
  },
  {
    id: 'digital-5',
    category: 'descarga-digital',
    subcategory: 'Colecciones de archivos',
    title: 'Colección completa de archivos STL de decoración',
    price: 59.9,
  },
];
