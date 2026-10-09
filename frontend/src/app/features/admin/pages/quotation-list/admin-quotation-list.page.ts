import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import {
  AdminQuotation,
  QUOTATION_STATUSES,
  QuotationStatus,
  describeQuotationStatus,
} from '../../models/admin-quotation.model';
import { AdminQuotationsService } from '../../services/admin-quotations.service';

type LoadStatus = 'loading' | 'loaded' | 'error';
type StatusFilter = QuotationStatus | 'todos';

export const QUOTATION_SEARCH_DEBOUNCE_MS = 300;

/**
 * Quotations agreed over WhatsApp (`/admin/quotations`, ASESOR and ADMINISTRADOR), RF-08/RF-09: newest first, filtered
 * by status and by text (description or customer e-mail) on the server, with a shortcut to register a new one.
 */
@Component({
  selector: 'app-admin-quotation-list-page',
  standalone: true,
  imports: [
    RouterLink,
    AdminPageHeaderComponent,
    AdminDataTableComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-quotation-list.page.html',
  styleUrl: './admin-quotation-list.page.scss',
})
export class AdminQuotationListPage {
  private readonly quotationsService = inject(AdminQuotationsService);

  readonly status = signal<LoadStatus>('loading');
  readonly quotations = signal<AdminQuotation[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('todos');
  readonly statusFilterOptions: readonly StatusFilter[] = ['todos', ...QUOTATION_STATUSES];

  private request: Subscription | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      if (this.timer) clearTimeout(this.timer);
    });
  }

  retry(): void {
    this.load();
  }

  updateSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), QUOTATION_SEARCH_DEBOUNCE_MS);
  }

  updateStatusFilter(value: string): void {
    this.statusFilter.set(value as StatusFilter);
    this.page.set(0);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  hasActiveFilters(): boolean {
    return this.search().trim() !== '' || this.statusFilter() !== 'todos';
  }

  statusLabel(status: QuotationStatus): string {
    return describeQuotationStatus(status).label;
  }

  statusTone(status: QuotationStatus): 'neutral' | 'info' | 'success' | 'danger' {
    return describeQuotationStatus(status).tone;
  }

  preview(description: string): string {
    return description.length > 80 ? `${description.slice(0, 80)}…` : description;
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(iso));
  }

  private load(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.request?.unsubscribe();
    this.status.set('loading');
    const status = this.statusFilter();
    this.request = this.quotationsService
      .list({ q: this.search(), status: status === 'todos' ? null : status, page: this.page() })
      .subscribe({
        next: (result) => {
          this.quotations.set(result.content);
          this.totalPages.set(result.totalPages);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
