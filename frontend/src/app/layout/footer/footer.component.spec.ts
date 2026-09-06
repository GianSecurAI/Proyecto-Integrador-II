import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
  });

  it('shows the current year in the copyright line', () => {
    expect(fixture.nativeElement.textContent).toContain(String(new Date().getFullYear()));
  });

  it('does not render any payment-method or third-party review badges (05-figma-analysis §9 exclusions)', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toMatch(/UPI|VISA|MASTERCARD|RUPIA|Trustpilot/i);
  });
});
