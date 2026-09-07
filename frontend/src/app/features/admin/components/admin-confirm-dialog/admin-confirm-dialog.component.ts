import { Component, ElementRef, ViewChild, computed, effect, input, output } from '@angular/core';

let nextDialogId = 0;

/**
 * Small, reusable, accessible confirmation dialog — the FIRST genuine modal/dialog usage in this
 * codebase. `features/admin/layout/admin-shell.component.ts` deliberately skipped building one
 * during the admin-shell task (nothing needed it yet, and Figma has zero admin frames — see
 * `pages/product-list/admin-product-list.page.ts`'s doc comment). This task's own instruction
 * ("confirmation dialogs when appropriate") is the first real, grounded need: confirming before
 * deactivating a product (`available: true -> false`) on `AdminProductListPage`.
 *
 * Scoped under `features/admin/components/` rather than `shared/ui/` — the only current/foreseen
 * caller is an admin screen and there is no confirmed cross-cutting need yet, the same
 * "keep it feature-scoped until proven cross-cutting" judgment call already made for
 * `features/admin/components/admin-page-header/` vs a hypothetical generic header, and for
 * `features/account/components/order-status-badge/` vs the generic `shared/ui/status-badge/`.
 *
 * Accessibility: `role="alertdialog"` (a confirmation interrupts the user, per the ARIA
 * Authoring Practices distinction between `dialog`/`alertdialog`), `aria-modal="true"`,
 * `aria-labelledby`/`aria-describedby` wired to the title/description. Focus moves to the
 * (non-destructive) Cancel action when the dialog opens, is trapped within the dialog while open
 * (Tab/Shift+Tab cycle), returns to the element that triggered the dialog when it closes, and
 * Escape closes it via the same path as Cancel. The confirm action defaults to `danger` styling
 * since its one real caller is a destructive-ish (customer-visible) deactivation.
 */
@Component({
  selector: 'app-admin-confirm-dialog',
  standalone: true,
  templateUrl: './admin-confirm-dialog.component.html',
  styleUrl: './admin-confirm-dialog.component.scss',
})
export class AdminConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly confirmLabel = input('Confirmar');
  readonly cancelLabel = input('Cancelar');
  /** Styles the confirm action as a destructive action (red). Defaults to `true` since this
   * component's one grounded caller (deactivating a product) is the destructive-ish case. */
  readonly danger = input(true);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  @ViewChild('dialogEl') private readonly dialogElRef?: ElementRef<HTMLElement>;
  @ViewChild('cancelBtn') private readonly cancelBtnRef?: ElementRef<HTMLButtonElement>;

  private readonly instanceId = `admin-confirm-dialog-${++nextDialogId}`;
  readonly titleId = `${this.instanceId}-title`;
  readonly descriptionId = `${this.instanceId}-description`;

  readonly describedBy = computed(() => (this.description() ? this.descriptionId : null));

  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.previouslyFocused = (document.activeElement as HTMLElement) ?? null;
        // Wait for the `@if` block to render before moving focus into it.
        queueMicrotask(() => this.cancelBtnRef?.nativeElement.focus());
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });
  }

  onBackdropClick(): void {
    this.cancel();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
      return;
    }
    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  confirm(): void {
    this.confirmed.emit();
  }

  cancel(): void {
    this.cancelled.emit();
  }

  private trapFocus(event: KeyboardEvent): void {
    const dialog = this.dialogElRef?.nativeElement;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
