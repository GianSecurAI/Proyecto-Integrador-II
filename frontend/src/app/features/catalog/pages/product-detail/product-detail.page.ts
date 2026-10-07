import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { httpStatus } from '../../../../core/models/api-error.model';
import { ProductDetail } from '../../../../shared/models/catalog-product.model';
import { categoryLabel } from '../../../../shared/models/wire-enums';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { CartStateService } from '../../../cart/services/cart-state.service';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';
import { ProductImageViewModel } from '../../models/product-detail.model';
import { CatalogService } from '../../services/catalog.service';

type DetailState =
  | { kind: 'loading' }
  | { kind: 'loaded'; product: ProductDetail }
  | { kind: 'not-found' }
  | { kind: 'error' };

/**
 * RF-07/RF-08 product detail, backed by `GET /api/catalog/products/{id}` (numeric id). A 404
 * (unknown OR unavailable product — the public catalog hides unavailable products) shows the
 * "not found" state; any other failure shows a retryable error. Images come from the backend
 * (currently always an empty list -> placeholder). There is no related-products block and no
 * specifications table beyond real fields: the backend has no such data.
 *
 * "Añadir a la cesta" / "Comprar ahora" feed the standard-catalog cart (`features/cart/`); the
 * server prices the order, the shown price is informational.
 */
@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    ProductGalleryComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.scss',
})
export class ProductDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cart = inject(CartStateService);
  private readonly catalog = inject(CatalogService);

  private readonly retry$ = new BehaviorSubject<void>(undefined);

  /** Loads on construction and whenever `:id` changes or the retry button is pressed. */
  readonly state = toSignal(
    combineLatest([this.route.paramMap, this.retry$]).pipe(
      switchMap(([params]) => {
        const id = params.get('id');
        const numericId = id !== null && /^\d+$/.test(id) ? Number(id) : null;
        if (numericId === null) return of<DetailState>({ kind: 'not-found' });
        return this.catalog.get(numericId).pipe(
          map((product): DetailState => ({ kind: 'loaded', product })),
          catchError((err: unknown) =>
            of<DetailState>(httpStatus(err) === 404 ? { kind: 'not-found' } : { kind: 'error' }),
          ),
          startWith<DetailState>({ kind: 'loading' }),
        );
      }),
    ),
    { initialValue: { kind: 'loading' } as DetailState },
  );

  readonly detail = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.product : null;
  });
  readonly images = computed<ProductImageViewModel[]>(
    () => this.detail()?.images.map((image) => ({ src: image.url, alt: image.alt })) ?? [],
  );
  readonly categoryLabel = computed(() => {
    const detail = this.detail();
    return detail ? categoryLabel(detail.category) : '';
  });

  private readonly feedback = signal<{ id: number; message: string } | null>(null);
  readonly actionMessage = computed(() => {
    const feedback = this.feedback();
    if (!feedback || feedback.id !== this.detail()?.id) return '';
    return feedback.message;
  });

  retry(): void {
    this.retry$.next();
  }

  addToCart(): void {
    const detail = this.detail();
    if (!detail) return;
    this.cart.addItem(detail, 1);
    this.feedback.set({ id: detail.id, message: 'Se añadió al carrito.' });
  }

  buyNow(): void {
    const detail = this.detail();
    if (!detail) return;
    this.cart.addItem(detail, 1);
    void this.router.navigateByUrl('/cart');
  }
}
