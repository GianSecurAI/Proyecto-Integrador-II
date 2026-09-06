import { Component, computed, input, signal } from '@angular/core';
import { ProductImageViewModel } from '../../models/product-detail.model';

@Component({
  selector: 'app-product-gallery',
  standalone: true,
  templateUrl: './product-gallery.component.html',
  styleUrl: './product-gallery.component.scss',
})
export class ProductGalleryComponent {
  readonly images = input.required<readonly ProductImageViewModel[]>();
  readonly selectedSource = signal<string | null>(null);
  readonly selectedImage = computed<ProductImageViewModel | undefined>(
    () => this.images().find((image) => image.src === this.selectedSource()) ?? this.images()[0],
  );
}
