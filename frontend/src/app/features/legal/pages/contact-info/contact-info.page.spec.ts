import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { ContactInfoPage } from './contact-info.page';

describe('ContactInfoPage', () => {
  let fixture: ComponentFixture<ContactInfoPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ContactInfoPage] });
    fixture = TestBed.createComponent(ContactInfoPage);
    fixture.detectChanges();
  });

  it('renders exactly one h1 with the page title', () => {
    const h1s: HTMLHeadingElement[] = Array.from(fixture.nativeElement.querySelectorAll('h1'));
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toContain('Información del contacto');
  });

  it('renders email, phone/hours and address contact details', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('contacto@armakers3d.example');
    expect(text).toContain('+51 900 000 000');
    expect(text).toContain('Lima');
  });

  it('links to WhatsApp using the environment placeholder number, not a hardcoded one', () => {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    const waLink = links.find((link) => link.textContent?.includes('Chatea con nosotros'));
    expect(waLink?.href).toContain(`https://wa.me/${environment.whatsappNumber}`);
    expect(waLink?.getAttribute('target')).toBe('_blank');
    expect(waLink?.getAttribute('rel')).toContain('noopener');
  });

  it('renders no contact form (CONFLICT pattern, deliberately excluded)', () => {
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toContain('Enviar mensaje');
  });

  it('renders no FAQ section (unrequested, not in the 5 footer links)', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toMatch(/preguntas frecuentes/i);
  });
});
