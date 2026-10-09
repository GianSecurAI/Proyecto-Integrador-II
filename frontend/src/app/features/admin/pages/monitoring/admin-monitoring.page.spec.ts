import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminMonitoringPage } from './admin-monitoring.page';

const STATUS = {
  status: 'UP',
  checkedAt: '2026-10-09T16:00:00Z',
  startedAt: '2026-10-09T10:00:00Z',
  uptimeSeconds: 21600,
  javaVersion: '21.0.12',
  processors: 8,
  memory: { usedMb: 210, maxMb: 2048 },
  database: { available: true, latencyMs: 3, product: 'PostgreSQL', version: '17.11', schemaVersion: '10' },
  counters: { users: 12, activeProducts: 15, orders: 4, openIncidents: 2, paymentsToReview: 1, pendingQuotations: 3 },
  persistence: { users: 'jpa', orders: 'jpa', monitoring: 'jpa' },
  scheduledJobs: { otpAndSessionPurge: true, checkoutExpiry: false },
};

const BACKUPS = {
  health: 'OK',
  maxAgeHours: 26,
  lastSuccessfulAt: '2026-10-09T08:00:00Z',
  hoursSinceLastSuccess: 8,
  lastVerifiedRestoreAt: '2026-10-08T08:00:00Z',
  recent: [
    {
      id: 1,
      backupAt: '2026-10-09T08:00:00Z',
      type: 'AUTOMATICO',
      result: 'EXITOSO',
      restoreVerified: true,
      detail: 'Copia diaria del servicio gestionado',
      registeredBy: 3,
      registeredAt: '2026-10-09T08:05:00Z',
    },
  ],
};

describe('AdminMonitoringPage (GET /api/admin/monitoring[/backups])', () => {
  let fixture: ComponentFixture<AdminMonitoringPage>;
  let component: AdminMonitoringPage;
  let http: HttpTestingController;
  const statusReq = () => http.expectOne('/api/admin/monitoring');
  const backupsReq = () => http.expectOne('/api/admin/monitoring/backups');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminMonitoringPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminMonitoringPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('renders the system status, the counters and the backup health exactly as the server sent them', () => {
    statusReq().flush(STATUS);
    backupsReq().flush(BACKUPS);
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Disponible');
    expect(text).toContain('PostgreSQL 17.11 · 3 ms');
    expect(text).toContain('Versión 10');
    expect(text).toContain('210 / 2048 MB');
    expect(text).toContain('Pagos por verificar');
    expect(text).toContain('Al día');
    expect(text).toContain('Copia diaria del servicio gestionado');
    expect(text).toContain('Limpieza de códigos y sesiones');
  });

  it('flags a database that does not answer and missing backups', () => {
    statusReq().flush({
      ...STATUS,
      status: 'DOWN',
      database: { available: false, latencyMs: null, product: null, version: null, schemaVersion: null },
      counters: null,
    });
    backupsReq().flush({ ...BACKUPS, health: 'CRITICAL', lastSuccessfulAt: null, hoursSinceLastSuccess: null, lastVerifiedRestoreAt: null, recent: [] });
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Caída');
    expect(text).toContain('Sin conexión');
    expect(text).toContain('Sin respaldos');
    expect(text).toContain('Todavía no hay respaldos registrados');
  });

  it('registers a backup, then refreshes both panels', () => {
    statusReq().flush(STATUS);
    backupsReq().flush(BACKUPS);
    component.formAt.set('2026-10-09T10:30');
    component.formType.set('MANUAL');
    component.setVerified(true);
    component.formDetail.set('  Prueba de restauración trimestral  ');
    component.registerBackup();
    const req = http.expectOne((r) => r.method === 'POST' && r.url === '/api/admin/monitoring/backups');
    expect(req.request.body.type).toBe('MANUAL');
    expect(req.request.body.result).toBe('EXITOSO');
    expect(req.request.body.restoreVerified).toBeTrue();
    expect(req.request.body.detail).toBe('Prueba de restauración trimestral');
    expect(req.request.body.backupAt).toMatch(/Z$/);
    req.flush({ id: 2 });
    statusReq().flush(STATUS);
    backupsReq().flush(BACKUPS);
    fixture.detectChanges();
    expect(component.saveMessage()).toEqual({ kind: 'ok', text: 'Respaldo registrado.' });
  });

  it('a failed backup cannot be marked as verified', () => {
    statusReq().flush(STATUS);
    backupsReq().flush(BACKUPS);
    component.setVerified(true);
    component.setResult('FALLIDO');
    expect(component.formVerified()).toBeFalse();
  });

  it('shows an error state with retry when the server fails', () => {
    statusReq().flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    expect(backupsReq().cancelled).toBeTrue(); // forkJoin abandons the sibling request
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
  });
});
