import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductGalleryComponent } from './product-gallery.component';

/**
 * Synthetic, obviously-fake image sources — not real product photography and never resolved by
 * the browser in this test. Exercises the thumbnail-switching mechanism in isolation, replacing
 * the previous page-level test that relied on two real (and since-removed) downloaded photos of
 * a third-party branded keychain — see mocks/product-details.mock.ts doc-comment.
 */
const IMAGES = [
  { src: 'test-fixture-1.png', alt: 'Vista 1 de prueba' },
  { src: 'test-fixture-2.png', alt: 'Vista 2 de prueba' },
];

describe('ProductGalleryComponent', () => {
  let fixture: ComponentFixture<ProductGalleryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductGalleryComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductGalleryComponent);
  });

  it('shows a placeholder message instead of a broken <img> when there are no images', () => {
    fixture.componentRef.setInput('images', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.gallery__empty')?.textContent).toContain(
      'Imagen no disponible',
    );
  });

  it('shows the first image by default and no thumbnail row for a single image', () => {
    fixture.componentRef.setInput('images', [IMAGES[0]]);
    fixture.detectChanges();

    const stageImg: HTMLImageElement = fixture.nativeElement.querySelector('.gallery__image');
    expect(stageImg.src).toContain(IMAGES[0].src);
    expect(fixture.nativeElement.querySelector('.gallery__thumbnails')).toBeNull();
  });

  it('switches the stage image and aria-pressed state when a thumbnail is clicked', () => {
    fixture.componentRef.setInput('images', IMAGES);
    fixture.detectChanges();

    const thumbnails: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.gallery__thumbnail'),
    );
    expect(thumbnails.length).toBe(2);
    expect(thumbnails[0].getAttribute('aria-pressed')).toBe('true');

    thumbnails[1].click();
    fixture.detectChanges();

    expect(thumbnails[1].getAttribute('aria-pressed')).toBe('true');
    expect(thumbnails[0].getAttribute('aria-pressed')).toBe('false');
    const stageImg: HTMLImageElement = fixture.nativeElement.querySelector('.gallery__image');
    expect(stageImg.src).toContain(IMAGES[1].src);
  });
});
