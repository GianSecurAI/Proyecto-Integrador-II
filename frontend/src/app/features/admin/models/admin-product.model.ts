import { CatalogProduct } from '../../../shared/models/catalog-product.model';
import { CatalogCategory } from '../../catalog/models/catalog-filters.model';

/**
 * RF-07 ("Catálogo de productos", admin side = HU06 "Gestionar catálogo de productos") is
 * "Confirmado" per `docs/discovery/01-requirements-analysis.md` line 218 and
 * `docs/discovery/06-system-definition.md` lines 197-201, but ships with an EMPTY Gherkin — the
 * `Producto` entity is documented only at a high level there: "nombre, descripción, atributos de
 * impresión 3D, disponibilidad". This ViewModel reuses the SAME approved storefront product shape
 * (`CatalogProduct` — `shared/models/catalog-product.model.ts`, already the real model behind
 * `features/catalog/` and `features/home/`) rather than forking a parallel admin-only product
 * type, and adds only what that high-level entity description names: `description` and
 * `available` ("disponibilidad").
 *
 * `characteristics` is included as a deliberate, lean first pass — a plain string list edited via
 * a single multi-line textarea (one line per characteristic, see `AdminProductFormComponent` and
 * `AdminProductsMockService`'s split-on-newline mapping), NOT a repeatable-field editor. `images`
 * and `specifications` (the richer `label`/`value` pairs from
 * `features/catalog/models/product-detail.model.ts`'s `ProductDetailViewModel`) are a documented,
 * deliberate DEFERRAL for this first pass: a `specifications` editor needs a genuine repeatable
 * key/value field UI, and an image field needs real upload infrastructure — both out of scope per
 * CLAUDE.md's "Important exclusions" (no file/image upload of any kind is modeled here).
 */
export interface AdminProductViewModel extends CatalogProduct {
  readonly description: string;
  /** "Disponibilidad" — the one status field the approved `Producto` entity description names.
   * Never set directly through the edit form; always changed through
   * `AdminProductsMockService.setAvailability()`, its own dedicated, confirmation-gated method
   * (see `AdminConfirmDialogComponent`'s one concrete trigger on the product-list page). */
  readonly available: boolean;
  /** One entry per plain-text characteristic/attribute line. Optional and possibly empty — not
   * every seeded product needs a characteristics list to exercise this screen meaningfully. */
  readonly characteristics: readonly string[];
}

/**
 * Local, form-only model for the create/edit reactive form — deliberately NOT
 * `AdminProductViewModel` (no `id`, no server-assigned fields, no `available`/`badge`/
 * `compareAtPrice` conflated with server state), same "form model independent from
 * view/persistence model" discipline already established by `ProfilePage`'s `ProfileFormValue`,
 * `RegisterPage`'s `RegisterFormValue`, and `IncidentsPage`'s `NewIncidentFormValue`.
 *
 * `category` excludes `CatalogCategory`'s `'todo'` value — that is a catalog-toolbar filter
 * pseudo-category, never a real product category (see `catalog-filters.model.ts`'s doc comment).
 *
 * `characteristics` stays the raw multi-line textarea string here (one characteristic per line);
 * splitting into `AdminProductViewModel.characteristics` (a `string[]`) happens in
 * `AdminProductsMockService`'s create/update mapping, not in this form model.
 *
 * `available` is intentionally ABSENT from this form — see `AdminProductViewModel.available`'s
 * doc comment: availability has its own dedicated, confirmation-gated control, never edited
 * through this general create/edit form.
 */
export interface ProductFormValue {
  readonly title: string;
  readonly category: Exclude<CatalogCategory, 'todo'>;
  readonly subcategory: string;
  readonly description: string;
  readonly price: number;
  readonly compareAtPrice: number | null;
  readonly personalizable: boolean;
  readonly characteristics: string;
}

/** Real product categories a product can be created/edited with — `CatalogCategory` minus the
 * `'todo'` filter-only pseudo-category. Reuses the one approved category vocabulary
 * (`catalog-filters.model.ts`, cited to Figma nodes 2:7/2:27) rather than inventing new copy. */
export const PRODUCT_FORM_CATEGORIES: readonly Exclude<CatalogCategory, 'todo'>[] = [
  'descarga-digital',
  'llavero',
  'pegatinas',
];

/** Default values for the create-product form — an empty/neutral starting point, never
 * pre-filled with any real product's data. */
export const EMPTY_PRODUCT_FORM_VALUE: ProductFormValue = {
  title: '',
  category: 'llavero',
  subcategory: '',
  description: '',
  price: 0,
  compareAtPrice: null,
  personalizable: false,
  characteristics: '',
};

/** Maps an existing product into the form's editable shape — the inverse of the split-on-newline
 * mapping in `AdminProductsMockService`. Used by `AdminProductDetailPage` to pre-fill the edit
 * form, mirroring `ProfilePage.startEditing()`'s `current -> form` mapping. */
export function toProductFormValue(product: AdminProductViewModel): ProductFormValue {
  return {
    title: product.title,
    category: product.category as Exclude<CatalogCategory, 'todo'>,
    subcategory: product.subcategory,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    personalizable: product.personalizable ?? false,
    characteristics: product.characteristics.join('\n'),
  };
}
