import { HOME_LATEST_PRODUCTS, HOME_TRENDING_PRODUCTS } from '../../home/mocks/home-products.mock';
import { ProductDetailViewModel } from '../models/product-detail.model';
import { CATALOG_PRODUCTS } from './catalog-products.mock';

/**
 * Isolated visual fixtures. No API calls, stock checks, price calculations, or order rules.
 *
 * No product here has a real photo — `images` is always empty, and `ProductGalleryComponent`
 * renders its placeholder state for every product. An earlier version of this file pointed the
 * "orange keyring" fixture at two real downloaded photos (`public/images/product-detail/
 * orange-keyring-*.png`) of an actual KTM-branded keychain — real third-party trademarked
 * product photography, the exact thing every other mock dataset in this project (Home, Catalog
 * grid) deliberately avoids. Both files were deleted and the special-casing removed; every
 * product now gets the same generic, brand-neutral treatment. Replace with real data once the
 * API contract exists.
 *
 * Related-products are editorial fixture choices, not a recommendation engine.
 */
const PRODUCTS = [...CATALOG_PRODUCTS, ...HOME_TRENDING_PRODUCTS, ...HOME_LATEST_PRODUCTS];

export const PRODUCT_DETAILS: readonly ProductDetailViewModel[] = PRODUCTS.map((product) => ({
  product,
  images: [],
  description: `${product.title}. Explora los detalles de esta pieza de nuestra colección de ${product.subcategory.toLowerCase()}.`,
  characteristics: [],
  specifications: [
    { label: 'Categoría', value: product.category },
    { label: 'Colección', value: product.subcategory },
  ],
  relatedProducts: CATALOG_PRODUCTS.filter((related) => related.id !== product.id).slice(0, 4),
}));
