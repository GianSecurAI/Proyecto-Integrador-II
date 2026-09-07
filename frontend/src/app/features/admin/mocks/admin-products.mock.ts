import { CatalogCategory } from '../../catalog/models/catalog-filters.model';

/**
 * Seed fixture for the real RF-07 admin product-management screens
 * (`pages/product-list/`, `pages/product-detail/`, `pages/product-create/`). Replaces the
 * TEMPORARY, 5-row `ADMIN_PRODUCTS_MOCK_ROWS` fixture that only ever backed
 * `admin-products-placeholder.page.ts` (now retired) — that placeholder's own doc comment said it
 * "MUST be deleted (not adapted/extended) once a real ... endpoint and DTO are defined"; no real
 * endpoint exists yet either, but a real *frontend feature* now does, so this fixture backs
 * `AdminProductsMockService` instead of a throwaway demo table.
 *
 * `category`/`subcategory` reuse the exact vocabulary and tone established by
 * `features/catalog/mocks/catalog-products.mock.ts` (brand-neutral names, plausible Peru soles
 * pricing, the same three-value `CatalogCategory` minus `'todo'`) — this is the admin side of the
 * same `Producto` concept the storefront already renders read-only, not a parallel product list.
 *
 * Deliberately includes:
 * - all three real categories (descarga-digital, llavero, pegatinas).
 * - at least one inactive product (`available: false`) so the list's status filter/badge and the
 *   confirm-dialog-gated reactivation path are both exercised.
 * - a price spread (S/ 8.50 to S/ 149.90).
 * - a couple of products with no `characteristics` at all, to exercise the optional/empty case.
 */
export interface AdminProductSeed {
  readonly id: string;
  readonly category: CatalogCategory;
  readonly subcategory: string;
  readonly title: string;
  readonly price: number;
  readonly compareAtPrice?: number;
  readonly badge?: string;
  readonly personalizable?: boolean;
  readonly description: string;
  readonly available: boolean;
  readonly characteristics: readonly string[];
}

export const ADMIN_PRODUCTS_SEED: readonly AdminProductSeed[] = [
  {
    id: 'adm-llavero-1',
    category: 'llavero',
    subcategory: 'Llaveros personalizados',
    title: 'Llavero con silueta de mascota',
    price: 21.9,
    personalizable: true,
    description:
      'Llavero impreso en PLA con la silueta de tu mascota, disponible en varios colores de acabado mate.',
    available: true,
    characteristics: ['Material: PLA', 'Alto impacto a la caída', 'Incluye argolla metálica'],
  },
  {
    id: 'adm-llavero-2',
    category: 'llavero',
    subcategory: 'Llaveros grabados',
    title: 'Llavero con iniciales grabadas',
    price: 17.9,
    compareAtPrice: 22.0,
    personalizable: true,
    description: 'Llavero rectangular con iniciales o texto corto grabado en relieve.',
    available: true,
    characteristics: ['Material: PETG', 'Texto de hasta 8 caracteres'],
  },
  {
    id: 'adm-llavero-3',
    category: 'llavero',
    subcategory: 'Llaveros geométricos',
    title: 'Llavero geométrico minimalista',
    price: 14.5,
    description: 'Diseño geométrico minimalista en una sola pieza, sin ensamblaje.',
    available: false,
    characteristics: [],
  },
  {
    id: 'adm-pegatinas-1',
    category: 'pegatinas',
    subcategory: 'Pegatinas personalizadas',
    title: 'Set de pegatinas con forma personalizada',
    price: 14.5,
    compareAtPrice: 18.0,
    personalizable: true,
    description: 'Set de 6 pegatinas troqueladas con la forma y el diseño que envíe el cliente.',
    available: true,
    characteristics: ['Vinilo resistente al agua', 'Set de 6 unidades'],
  },
  {
    id: 'adm-pegatinas-2',
    category: 'pegatinas',
    subcategory: 'Pegatinas holográficas',
    title: 'Set de pegatinas holográficas surtidas',
    price: 9.9,
    badge: 'Nuevo',
    description: 'Set surtido de 10 pegatinas holográficas de diseños decorativos.',
    available: true,
    characteristics: [],
  },
  {
    id: 'adm-pegatinas-3',
    category: 'pegatinas',
    subcategory: 'Pegatinas resistentes',
    title: 'Pegatinas resistentes al agua',
    price: 11.5,
    description: 'Pegatinas de vinilo laminado, resistentes al agua y a la luz solar directa.',
    available: false,
    characteristics: ['Vinilo laminado', 'Resistente a rayos UV'],
  },
  {
    id: 'adm-digital-1',
    category: 'descarga-digital',
    subcategory: 'Archivos STL',
    title: 'Set de archivos STL de organizador modular',
    price: 29.9,
    compareAtPrice: 39.9,
    description: 'Paquete de archivos STL listos para imprimir de un organizador modular apilable.',
    available: true,
    characteristics: ['Formato STL', 'Incluye 4 piezas modulares'],
  },
  {
    id: 'adm-digital-2',
    category: 'descarga-digital',
    subcategory: 'Colecciones de archivos',
    title: 'Colección completa de archivos STL de decoración',
    price: 149.9,
    badge: 'Popular',
    description: 'Colección de 25 modelos decorativos en formato STL, licencia de uso personal.',
    available: true,
    characteristics: ['Formato STL', '25 modelos incluidos', 'Licencia de uso personal'],
  },
  {
    id: 'adm-digital-3',
    category: 'descarga-digital',
    subcategory: 'Plantillas imprimibles',
    title: 'Plantilla imprimible de letras decorativas',
    price: 8.5,
    description: 'Plantilla imprimible de un alfabeto decorativo completo en formato STL.',
    available: true,
    characteristics: [],
  },
];

/** Explicit empty fixture — used by `AdminProductsMockService`'s `?mockState=empty` preview path,
 * same convention as `CUSTOMER_ORDERS_EMPTY`/`CUSTOMER_INCIDENTS_EMPTY`. */
export const ADMIN_PRODUCTS_EMPTY: readonly AdminProductSeed[] = [];
