import { CatalogProduct } from '../../../shared/models/catalog-product.model';

/**
 * MOCK DATA — not backed by any API. The Home page is a design-system extension
 * (POSSIBLE_EXTENSION per docs/discovery/05-figma-analysis.md §1, confirmed by direct Product
 * Owner instruction; see home.page.ts), not a catalog feature, so there is no `/catalog`
 * endpoint to call yet. These arrays exist only so the two showcase sections have something to
 * render; swap this file for a real `CatalogService` call once RF-07/RF-08 catalog browsing is
 * specified and implemented.
 *
 * Product names and prices are deliberately original/brand-neutral: the equivalent Figma nodes
 * (1:54-1:77 and similar) show a different company's real product photography and copy,
 * including several licensed third-party franchises/team logos, none of which belong to this
 * project or may be reproduced (see product-card.component.ts doc-comment). Prices are invented,
 * plausible Peruvian soles amounts (Ar Makers 3D is a Peru-based business per project requirements).
 */
export const HOME_TRENDING_PRODUCTS: CatalogProduct[] = [
  {
    id: 'trend-1',
    category: 'Llaveros',
    subcategory: 'Llaveros personalizados',
    title: 'Llavero personalizado con placa 3D',
    price: 19.9,
  },
  {
    id: 'trend-2',
    category: 'Pegatinas',
    subcategory: 'Pegatinas personalizadas',
    title: 'Set de pegatinas con forma personalizada',
    price: 14.5,
    compareAtPrice: 18.0,
  },
  {
    id: 'trend-3',
    category: 'Decoración',
    subcategory: 'Imanes decorativos',
    title: 'Set de imanes decorativos a medida',
    price: 24.9,
  },
  {
    id: 'trend-4',
    category: 'Llaveros',
    subcategory: 'Llaveros grabados',
    title: 'Llavero con iniciales grabadas',
    price: 17.9,
    badge: 'Popular',
  },
];

export const HOME_LATEST_PRODUCTS: CatalogProduct[] = [
  {
    id: 'latest-1',
    category: 'Figuras',
    subcategory: 'Figuras decorativas',
    title: 'Figura decorativa personalizada de escritorio',
    price: 39.9,
  },
  {
    id: 'latest-2',
    category: 'Organizadores',
    subcategory: 'Organizadores de escritorio',
    title: 'Organizador de escritorio modular',
    price: 34.9,
  },
  {
    id: 'latest-3',
    category: 'Regalos',
    subcategory: 'Regalos personalizados',
    title: 'Portarretrato personalizado con nombre',
    price: 22.5,
  },
  {
    id: 'latest-4',
    category: 'Llaveros',
    subcategory: 'Llaveros personalizados',
    title: 'Llavero con silueta de mascota',
    price: 21.9,
  },
  {
    id: 'latest-5',
    category: 'Decoración',
    subcategory: 'Macetas decorativas',
    title: 'Maceta geométrica personalizada',
    price: 27.9,
  },
  {
    id: 'latest-6',
    category: 'Pegatinas',
    subcategory: 'Pegatinas personalizadas',
    title: 'Pegatinas con nombre y diseño a medida',
    price: 12.9,
  },
  {
    id: 'latest-7',
    category: 'Accesorios',
    subcategory: 'Soportes personalizados',
    title: 'Soporte para celular personalizado',
    price: 18.9,
    compareAtPrice: 23.0,
  },
  {
    id: 'latest-8',
    category: 'Regalos',
    subcategory: 'Regalos para eventos',
    title: 'Recuerdo personalizado para eventos',
    price: 9.9,
    badge: 'Nuevo',
  },
];
