import { ProductCategory } from './wire-enums';

/**
 * Product as returned by the public catalog list (`GET /api/catalog/products`, backend
 * `ProductSummaryDto`): exactly these fields — no discount/compare-at price, badge,
 * personalizable flag, digital-download category or images (backend decisions D-08..D-12). `id`
 * is a numeric surrogate; `price` is soles as a JSON number (backend BigDecimal, 2 decimals).
 * Display-only: orders are always priced by the server.
 */
export interface CatalogProduct {
  id: number;
  title: string;
  category: ProductCategory;
  subcategory: string;
  price: number;
}

/** Backend `ProductImageDto` (read-only; the backend currently returns an empty list). */
export interface ProductImage {
  url: string;
  alt: string;
}

/** `GET /api/catalog/products/{id}` (backend `ProductDetailDto`). */
export interface ProductDetail extends CatalogProduct {
  description: string;
  characteristics: string[];
  images: ProductImage[];
}
