import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ProofImageComponent } from './proof-image.component';

describe('ProofImageComponent', () => {
  let fixture: ComponentFixture<ProofImageComponent>;
  let createUrl: jasmine.Spy;
  let revokeUrl: jasmine.Spy;
  let counter: number;

  function setup(loader: () => Observable<Blob>) {
    counter = 0;
    createUrl = spyOn(URL, 'createObjectURL').and.callFake(() => `blob:proof-${++counter}`);
    revokeUrl = spyOn(URL, 'revokeObjectURL');
    TestBed.configureTestingModule({ imports: [ProofImageComponent] });
    fixture = TestBed.createComponent(ProofImageComponent);
    fixture.componentRef.setInput('loader', loader);
    fixture.detectChanges();
  }

  const png = () => new Blob(['x'], { type: 'image/png' });

  it('shows a loading state, then the image from a blob object URL (same-site, no external host)', () => {
    const pending = new Subject<Blob>();
    setup(() => pending);
    expect(fixture.nativeElement.textContent).toContain('Cargando comprobante');
    pending.next(png());
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(img.getAttribute('src')).toBe('blob:proof-1');
    const open: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(open.getAttribute('href')).toBe('blob:proof-1');
    expect(open.rel).toContain('noopener');
  });

  it('toggles zoom', () => {
    setup(() => of(png()));
    const viewport: HTMLElement = fixture.nativeElement.querySelector('.proof-image__viewport');
    expect(viewport.classList).not.toContain('proof-image__viewport--zoomed');
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(viewport.classList).toContain('proof-image__viewport--zoomed');
  });

  it('refuses to render content that is not a raster image (e.g. an HTML or SVG blob)', () => {
    setup(() => of(new Blob(['<svg/>'], { type: 'image/svg+xml' })));
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(createUrl).not.toHaveBeenCalled();
  });

  it('shows an error with retry when the request fails', () => {
    let calls = 0;
    setup(() => (++calls === 1 ? throwError(() => new Error('boom')) : of(png())));
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No se pudo cargar');
    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).not.toBeNull();
  });

  it('revokes the previous object URL when the loader changes and the last one on destroy', () => {
    setup(() => of(png()));
    fixture.componentRef.setInput('loader', () => of(png()));
    fixture.detectChanges();
    expect(revokeUrl).toHaveBeenCalledWith('blob:proof-1');
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('blob:proof-2');
    fixture.destroy();
    expect(revokeUrl).toHaveBeenCalledWith('blob:proof-2');
  });
});
