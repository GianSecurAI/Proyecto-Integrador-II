import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('accepts in-app absolute paths', () => {
    expect(safeReturnUrl('/checkout')).toBe('/checkout');
    expect(safeReturnUrl('/admin/orders?page=1')).toBe('/admin/orders?page=1');
  });

  it('rejects external, protocol-relative, relative and empty values', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/' + String.fromCharCode(92) + 'evil', 'checkout', '', null, undefined]) {
      expect(safeReturnUrl(bad)).toBeNull();
    }
  });
});
