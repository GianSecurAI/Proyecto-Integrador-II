import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CustomerProfileService } from './customer-profile.service';

/** Shape copied from backend `CustomerProfileResponseDto`. */
const PROFILE = {
  id: 3,
  email: 'maria@example.com',
  role: 'CLIENTE',
  createdAt: '2026-09-01T10:00:00Z',
  firstName: 'María',
  lastName: null,
  phone: '987 654 321',
};

describe('CustomerProfileService (GET/PUT /api/customers/me)', () => {
  let service: CustomerProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CustomerProfileService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the profile and maps null optional fields to empty strings', () => {
    service.load().subscribe();
    http.expectOne('/api/customers/me').flush(PROFILE);
    expect(service.profile().email).toBe('maria@example.com');
    expect(service.profile().lastName).toBe('');
    expect(service.profile().memberSince instanceof Date).toBeTrue();
  });

  it('PUTs only firstName, lastName and phone (never the email) and stores the response', () => {
    service.save({ firstName: ' Ana ', lastName: 'Ruiz', phone: '' }).subscribe();
    const req = http.expectOne('/api/customers/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ firstName: 'Ana', lastName: 'Ruiz', phone: '' });
    req.flush({ ...PROFILE, firstName: 'Ana', lastName: 'Ruiz', phone: null });
    expect(service.profile().firstName).toBe('Ana');
    expect(service.profile().phone).toBe('');
  });
});
