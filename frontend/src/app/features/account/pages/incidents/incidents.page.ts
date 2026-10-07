import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiErrorCode, httpStatus, rateLimitMessage } from '../../../../core/models/api-error.model';
import { applyFieldErrors } from '../../../../core/errors/form-errors';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AccountNavComponent } from '../../components/account-nav/account-nav.component';
import {
  INCIDENT_DESCRIPTION_MAX,
  INCIDENT_DESCRIPTION_MIN,
  IncidentStatus,
  IncidentViewModel,
  NewIncidentFormValue,
  describeIncidentStatus,
} from '../../models/incident.model';
import { OrderSummaryViewModel } from '../../models/order.model';
import { CustomerIncidentsService } from '../../services/customer-incidents.service';
import { CustomerOrdersService } from '../../services/customer-orders.service';

type LoadStatus = 'loading' | 'loaded' | 'error';

/** Minimum description length — UX-only convenience so an empty/near-empty report can't be
 * submitted from this screen; the real constraint (if any) belongs to a future backend DTO
 * (Constitution Prohibited Practice #6 — this is never advertised as validated on its own). */

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
 * Deliberately excludes any priority/type/status *input*: the server sets status `ABIERTA` and the
 * reporter; priority and status management are staff-only (`/admin/incidents`). The order-select
 * control lists the customer's own orders from `GET /api/orders`. Registration is
 * `POST /api/incidents` and the history is `GET /api/incidents` (own incidents only). The order
 * fetch, the incident list and the submission each have their own loading/error handling, since
 * any of them can fail independently.
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
  private readonly ordersService = inject(CustomerOrdersService);
  private readonly incidentsService = inject(CustomerIncidentsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ordersStatus = signal<LoadStatus>('loading');
  readonly orders = signal<OrderSummaryViewModel[]>([]);

  readonly incidentsStatus = signal<LoadStatus>('loading');
  readonly incidents = signal<IncidentViewModel[]>([]);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal<string | null>(null);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  readonly form = new FormGroup<{ [K in keyof NewIncidentFormValue]: FormControl<string> }>({
    orderId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(INCIDENT_DESCRIPTION_MIN),
        Validators.maxLength(INCIDENT_DESCRIPTION_MAX),
      ],
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
    this.loadIncidents();
  }

  retryOrders(): void {
    this.loadOrders();
  }

  retryIncidents(): void {
    this.loadIncidents();
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
      .register(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.form.reset({ orderId: '', description: '' });
          this.submitSuccess.set(`Incidencia ${created.id} registrada correctamente.`);
          this.incidents.update((current) => [created, ...current]);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.submitError.set(this.submitErrorMessage(err));
        },
      });
  }

  /** Maps backend outcomes of `POST /api/incidents` to user-facing copy. */
  private submitErrorMessage(err: unknown): string {
    const status = httpStatus(err);
    if (status === 404) return 'No encontramos ese pedido en tu cuenta.';
    if (status === 409 || apiErrorCode(err) === 'CONFLICT') {
      return 'Ya existe una incidencia abierta igual para este pedido, o el pedido alcanzó el máximo de incidencias abiertas.';
    }
    if (apiErrorCode(err) === 'VALIDATION_FAILED') {
      const unmatched = applyFieldErrors(this.form, err);
      return unmatched.length > 0 || this.form.invalid
        ? 'Revisa los datos ingresados e inténtalo de nuevo.'
        : 'No pudimos registrar tu incidencia.';
    }
    if (status === 429) return rateLimitMessage(err);
    return 'No pudimos registrar tu incidencia. Inténtalo de nuevo más tarde.';
  }

  private loadOrders(): void {
    this.ordersStatus.set('loading');
    this.ordersService
      .list({ size: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.orders.set(page.content);
          this.ordersStatus.set('loaded');
        },
        error: () => this.ordersStatus.set('error'),
      });
  }

  private loadIncidents(): void {
    this.incidentsStatus.set('loading');
    this.incidentsService
      .list({ size: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.incidents.set(page.content);
          this.incidentsStatus.set('loaded');
        },
        error: () => this.incidentsStatus.set('error'),
      });
  }
}
