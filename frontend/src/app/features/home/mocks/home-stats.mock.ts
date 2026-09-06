/** A single trust-band statistic rendered in the Home hero. */
export interface HomeStat {
  value: string;
  label: string;
}

/**
 * MOCK DATA — placeholder trust-band numbers ("19+ productos", "207+ órdenes", etc.). These are
 * business aggregates (product count, order count, customer count, average rating), not static
 * copy, so they must eventually come from a real backend aggregate endpoint. No such endpoint is
 * confirmed/specified yet, so this file exists purely to make that swap obvious later — do not
 * treat these numbers as real business data.
 */
export const HOME_STATS: HomeStat[] = [
  { value: '19+', label: 'Productos' },
  { value: '207+', label: 'Órdenes' },
  { value: '250+', label: 'Clientes' },
  { value: '5.0 ★', label: 'Clasificación' },
];
