import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AccountNavComponent } from '../../components/account-nav/account-nav.component';
import { IncidentStatus, IncidentViewModel, NewIncidentFormValue, describeIncidentStatus } from '../../models/incident.model';
import { OrderSummaryViewModel } from '../../models/order.model';
import { CustomerIncidentsMockService, IncidentsMockState } from '../../services/customer-incidents-mock.service';
import { CustomerOrdersMockService } from '../../services/customer-orders-mock.service';

type LoadStatus = 'loading' | 'loaded' | 'error';

/** Minimum description length — UX-only convenience so an empty/near-empty report can't be
 * submitted from this screen; the real constraint (if any) belongs to a future backend DTO
 * (Constitution Prohibited Practice #6 — this is never advertised as validated on its own). */
const MIN_DESCRIPTION_LENGTH = 20;

/**
 * RF-15 ("Registro de incidencias", actor Cliente, docs/discovery/06-system-definition.md lines
 * 219-220), "Confirmado". No `spec.md` exists for incidents yet, no backend `Incidencia` entity
 * exists at all, and no Figma frame covers this screen (confirmed absent — line 261: "Registro de
 * incidencias (RF-15) | — | No existe pantalla") — this reuses the existing light-theme design
 * system (`app-card`, `app-form-field`, `_tokens.scss`) the same way `ProfilePage` and
 * `OrderHistoryPage` do, rather than inventing a new visual language.
 *
 * A single page combines both the submission form and the list/history — a separate "detail"
 * sub-route was judged unnecessary scope for this entity, since resolution text is short enough
 * to display inline on the relevant list item (unlike `OrderDetailPage`'s append-only status
 * *history*, which genuinely needs its own screen).
 *
 * Deliberately excludes any priority/type/status *input* — see `../../models/incident.model.ts`'s
 * doc comment: RF-17 (priority classification) and RF-16 (status management) are staff-only
 * (actor Administrador/Asesor), never Cliente, and no incident-type concept is defined anywhere in
 * the discovery docs. The order-select control reuses `CustomerOrdersMockService.getOrders()`
 * directly — this feature never re-mocks a second, parallel order list.
 *
 * `?mockState=empty` / `?mockState=error` query params let a reviewer deterministically preview
 * the incident *list*'s async states from the browser URL bar alone (see the on-screen notice in
 * incidents.page.html), mirroring `OrderHistoryPage`. The order-select fetch and the incident
 * submission each have their own independent loading/error handling, since either can fail on its
 * own regardless of the list's state.
 */
@Component({
  selector: 'app-incidents-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AccountNavComponent,
    CardComponent,
    ButtonComponent,
    FormFieldComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './incidents.page.html',
  styleUrl: './incidents.page.scss',
})
export class IncidentsPage {
  private readonly ordersService = inject(CustomerOrdersMockService);
  private readonly incidentsService = inject(CustomerIncidentsMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly ordersStatus = signal<LoadStatus>('loading');
  readonly orders = signal<OrderSummaryViewModel[]>([]);

  readonly incidentsStatus = signal<LoadStatus>('loading');
  readonly incidents = signal<IncidentViewModel[]>([]);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal<string | null>(null);

  private currentMockState: IncidentsMockState = 'populated';

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  readonly form = new FormGroup<{ [K in keyof NewIncidentFormValue]: FormControl<string> }>({
    orderId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_DESCRIPTION_LENGTH)],
    }),
  });

  get orderIdControl() {
    return this.form.controls.orderId;
  }
  get descriptionControl() {
    return this.form.controls.description;
  }

  constructor() {
    this.loadOrders();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const value = params.get('mockState');
      this.currentMockState = value === 'empty' || value === 'error' ? value : 'populated';
      this.loadIncidents(this.currentMockState);
    });
  }

  retryOrders(): void {
    this.loadOrders();
  }

  retryIncidents(): void {
    this.loadIncidents(this.currentMockState);
  }

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  describeStatus(status: IncidentStatus): { label: string; tone: ReturnType<typeof describeIncidentStatus>['tone'] } {
    return describeIncidentStatus(status);
  }

  submit(): void {
    if (this.submitting()) return;
    this.descriptionControl.setValue(this.descriptionControl.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(null);
    const value: NewIncidentFormValue = this.form.getRawValue();
    this.incidentsService
      .submitIncident(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.form.reset({ orderId: '', description: '' });
          this.submitSuccess.set(`Incidencia ${created.id} registrada correctamente.`);
          this.incidents.update((current) => [created, ...current]);
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set(
            'No pudimos registrar tu incidencia. Inténtalo de nuevo más tarde.',
          );
        },
      });
  }

  private loadOrders(): void {
    this.ordersStatus.set('loading');
    this.ordersService
      .getOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (orders) => {
          this.orders.set(orders);
          this.ordersStatus.set('loaded');
        },
        error: () => this.ordersStatus.set('error'),
      });
  }

  private loadIncidents(mockState: IncidentsMockState): void {
    this.incidentsStatus.set('loading');
    this.incidentsService
      .getIncidents(mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (incidents) => {
          this.incidents.set(incidents);
          this.incidentsStatus.set('loaded');
        },
        error: () => this.incidentsStatus.set('error'),
      });
  }
}
