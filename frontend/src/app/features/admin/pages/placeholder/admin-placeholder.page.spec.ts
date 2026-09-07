import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AdminPlaceholderPage } from './admin-placeholder.page';

describe('AdminPlaceholderPage', () => {
  let fixture: ComponentFixture<AdminPlaceholderPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPlaceholderPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                title: 'Pedidos',
                description:
                  'Gestión de pedidos — Próximamente. Esta sección se implementará cuando el backend de pedidos esté disponible.',
              },
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminPlaceholderPage);
    fixture.detectChanges();
  });

  it('renders the title supplied via route data', () => {
    expect(fixture.nativeElement.textContent).toContain('Pedidos');
  });

  it('renders the description supplied via route data', () => {
    expect(fixture.nativeElement.textContent).toContain('Próximamente');
  });
});
