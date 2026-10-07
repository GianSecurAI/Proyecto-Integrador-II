import { CatalogProduct, ProductImage } from '../../../shared/models/catalog-product.model';
import { PRODUCT_CATEGORIES, ProductCategory } from '../../../shared/models/wire-enums';

/** Backend `AdminProductDto` (admin view of a product, including unavailable ones). */
export interface AdminProductDto {
  id: number;
  title: string;
  category: ProductCategory;
  subcategory: string;
  price: number;
  description: string;
  characteristics: string[];
  images: ProductImage[];
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Backend `ProductWriteRequestDto` — the body of `POST /api/admin/products` and
 * `PUT /api/admin/products/{id}`. Availability is changed through its own endpoint, and images are
 * read-only (empty) in this version. There is no discount, badge or personalizable flag. */
export interface ProductWriteRequest {
  title: string;
  category: ProductCategory;
  subcategory: string;
  description: string;
  price: number;
  characteristics: string[];
}

export interface AdminProductViewModel extends CatalogProduct {
  readonly description: string;
  readonly available: boolean;
  readonly characteristics: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Form value of the product form. `characteristics` is one item per line (textarea). */
export interface ProductFormValue {
  readonly title: string;
  readonly category: ProductCategory;
  readonly subcategory: string;
  readonly description: string;
  readonly price: number;
  readonly characteristics: string;
}

export const PRODUCT_FORM_CATEGORIES: readonly ProductCategory[] = PRODUCT_CATEGORIES;

/** Backend limits (`ProductRules`) mirrored for UX validation only. */
export const PRODUCT_LIMITS = {
  titleMax: 120,
  subcategoryMax: 80,
  descriptionMax: 2000,
  characteristicsMaxItems: 20,
  characteristicMax: 200,
  priceMax: 99999.99,
} as const;

export const EMPTY_PRODUCT_FORM_VALUE: ProductFormValue = {
  title: '',
  category: 'LLAVERO',
  subcategory: '',
  description: '',
  price: 0,
  characteristics: '',
};

export function toAdminProductViewModel(dto: AdminProductDto): AdminProductViewModel {
  return {
    id: dto.id,
    title: dto.title,
    category: dto.category,
    subcategory: dto.subcategory,
    price: dto.price,
    description: dto.description,
    available: dto.available,
    characteristics: dto.characteristics ?? [],
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function toProductFormValue(product: AdminProductViewModel): ProductFormValue {
  return {
    title: product.title,
    category: product.category,
    subcategory: product.subcategory,
    description: product.description,
    price: product.price,
    characteristics: product.characteristics.join('\n'),
  };
}

export function splitCharacteristics(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Explicit mapping from the form to the wire request (no field can leak by accident). */
export function toProductWriteRequest(value: ProductFormValue): ProductWriteRequest {
  return {
    title: value.title.trim(),
    category: value.category,
    subcategory: value.subcategory.trim(),
    description: value.description.trim(),
    price: value.price,
    characteristics: splitCharacteristics(value.characteristics),
  };
}
