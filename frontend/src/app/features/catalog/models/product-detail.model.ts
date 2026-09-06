import { CatalogProduct } from '../../../shared/models/catalog-product.model';

/** Presentation-only mock shape, not a backend DTO or business contract. */
export interface ProductImageViewModel {
  readonly src: string;
  readonly alt: string;
}

export interface ProductDetailViewModel {
  readonly product: CatalogProduct;
  readonly images: readonly ProductImageViewModel[];
  readonly description: string;
  readonly characteristics: readonly string[];
  readonly specifications: readonly { label: string; value: string }[];
  readonly relatedProducts: readonly CatalogProduct[];
}
