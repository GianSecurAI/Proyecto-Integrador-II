import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

type ProofImageState = 'loading' | 'ready' | 'error';

const SHOWABLE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Shows a payment-proof screenshot that the API serves ONLY to authenticated, authorized callers
 * (owner or administrator). The image is fetched through the caller-supplied `loader` (an
 * `HttpClient` call with credentials, so the session cookie is sent), turned into a `blob:` object
 * URL for an `<img>`, and that URL is revoked whenever the image changes and on destroy. Nothing
 * is ever loaded from another host, and the blob is shown only if its content type is a plain
 * raster image. Zoom toggles a scrollable, enlarged view; "abrir" opens the same blob in a new tab.
 */
@Component({
  selector: 'app-proof-image',
  standalone: true,
  templateUrl: './proof-image.component.html',
  styleUrl: './proof-image.component.scss',
})
export class ProofImageComponent {
  /** Factory returning the image bytes; a NEW function instance triggers a reload. */
  readonly loader = input.required<() => Observable<Blob>>();
  readonly alt = input('Comprobante de pago');

  readonly state = signal<ProofImageState>('loading');
  readonly objectUrl = signal<string | null>(null);
  readonly zoomed = signal(false);

  private request: Subscription | null = null;

  constructor() {
    effect(() => {
      const load = this.loader();
      untracked(() => this.load(load));
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  retry(): void {
    this.load(this.loader());
  }

  toggleZoom(): void {
    this.zoomed.update((value) => !value);
  }

  private load(load: () => Observable<Blob>): void {
    this.release();
    this.state.set('loading');
    this.zoomed.set(false);
    this.request = load().subscribe({
      next: (blob) => {
        if (!SHOWABLE_TYPES.includes(blob.type)) {
          this.state.set('error');
          return;
        }
        this.objectUrl.set(URL.createObjectURL(blob));
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }

  private release(): void {
    this.request?.unsubscribe();
    this.request = null;
    const url = this.objectUrl();
    if (url) URL.revokeObjectURL(url);
    this.objectUrl.set(null);
  }
}
