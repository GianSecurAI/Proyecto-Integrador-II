import { HOME_LATEST_PRODUCTS, HOME_TRENDING_PRODUCTS } from '../../home/mocks/home-products.mock';
import { ProductDetailViewModel } from '../models/product-detail.model';
import { CATALOG_PRODUCTS } from './catalog-products.mock';

/** Isolated visual fixtures. No API calls, stock checks, price calculations or order rules.
 * Only the orange keyring has matching Figma photography; other fixtures intentionally have
 * no image instead of falsely showing an unrelated product. Replace with approved real data
 * once the API contract exists. Related cards are editorial fixture choices, not recommendations.
 */
const PRODUCTS = [...CATALOG_PRODUCTS, ...HOME_TRENDING_PRODUCTS, ...HOME_LATEST_PRODUCTS];

export const PRODUCT_DETAILS: readonly ProductDetailViewModel[] = PRODUCTS.map((product) => {
  const isReference = product.id === 'llavero-diseno-naranja';
  return {
    product,
    images: isReference
      ? [
          {
            src: '/images/product-detail/orange-keyring-1.png',
            alt: 'Llavero naranja con letras KTM en relieve y anilla metálica, vista frontal',
          },
          {
            src: '/images/product-detail/orange-keyring-2.png',
            alt: 'Llavero naranja con letras KTM en relieve, segunda vista',
          },
        ]
      : [],
    description: isReference
      ? 'Llavero impreso en 3D con un diseño naranja en relieve sobre una base negra y un contorno blanco. Una pieza compacta para acompañar tus llaves.'
      : `${product.title}. Explora los detalles de esta pieza de nuestra colección de ${product.subcategory.toLowerCase()}.`,
    characteristics: isReference
      ? [
          'Diseño en relieve impreso en 3D.',
          'Acabado naranja con base negra y contorno blanco.',
          'Anilla metálica para sujetar tus llaves.',
          'Formato compacto y ligero.',
        ]
      : [],
    specifications: isReference
      ? [
          { label: 'Material', value: 'PLA' },
          { label: 'Color', value: 'Naranja, negro y blanco' },
          { label: 'Categoría', value: 'Llaveros' },
        ]
      : [
          { label: 'Categoría', value: product.category },
          { label: 'Colección', value: product.subcategory },
        ],
    relatedProducts: CATALOG_PRODUCTS.filter((related) => related.id !== product.id).slice(0, 4),
  };
});
