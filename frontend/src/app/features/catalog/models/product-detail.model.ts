/** Presentation shape for one gallery image (mapped from the backend's `ProductImageDto`
 * `{ url, alt }`; see `shared/models/catalog-product.model.ts`). */
export interface ProductImageViewModel {
  readonly src: string;
  readonly alt: string;
}
