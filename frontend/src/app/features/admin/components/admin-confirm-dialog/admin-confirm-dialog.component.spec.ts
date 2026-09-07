import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminConfirmDialogComponent } from './admin-confirm-dialog.component';

@Component({
  standalone: true,
  imports: [AdminConfirmDialogComponent],
  template: `
    <button type="button" id="trigger">Abrir</button>
    <app-admin-confirm-dialog
      [open]="open()"
      title="Desactivar producto"
      description="El producto dejará de mostrarse en el catálogo."
      confirmLabel="Desactivar"
      (confirmed)="confirmedCount = confirmedCount + 1"
      (cancelled)="cancelledCount = cancelledCount + 1"
    />
  `,
})
class HostComponent {
  readonly open = signal(false);
  confirmedCount = 0;
  cancelledCount = 0;
}

describe('AdminConfirmDialogComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders nothing when closed', () => {
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('renders the title/description with accessible aria wiring when open', () => {
    host.open.set(true);
    fixture.detectChanges();

    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role="alertdialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const titleId = dialog.getAttribute('aria-labelledby')!;
    const descId = dialog.getAttribute('aria-describedby')!;
    expect(fixture.nativeElement.querySelector(`#${titleId}`).textContent).toContain(
      'Desactivar producto',
    );
    expect(fixture.nativeElement.querySelector(`#${descId}`).textContent).toContain(
      'dejará de mostrarse',
    );
  });

  it('emits confirmed and not cancelled when the confirm action is clicked', () => {
    host.open.set(true);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.admin-confirm-dialog__actions button'),
    );
    const confirmButton = buttons.find((b) => b.textContent?.includes('Desactivar'))!;
    confirmButton.click();

    expect(host.confirmedCount).toBe(1);
    expect(host.cancelledCount).toBe(0);
  });

  it('emits cancelled when the cancel action is clicked', () => {
    host.open.set(true);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.admin-confirm-dialog__actions button'),
    );
    const cancelButton = buttons.find((b) => b.textContent?.includes('Cancelar'))!;
    cancelButton.click();

    expect(host.cancelledCount).toBe(1);
    expect(host.confirmedCount).toBe(0);
  });

  it('emits cancelled when the backdrop is clicked', () => {
    host.open.set(true);
    fixture.detectChanges();

    const backdrop: HTMLElement = fixture.nativeElement.querySelector(
      '.admin-confirm-dialog__backdrop',
    );
    backdrop.click();

    expect(host.cancelledCount).toBe(1);
  });

  it('emits cancelled on Escape', () => {
    host.open.set(true);
    fixture.detectChanges();

    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role="alertdialog"]');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(host.cancelledCount).toBe(1);
  });

  it('moves focus into the dialog (cancel action) when opened', async () => {
    host.open.set(true);
    fixture.detectChanges();
    // Focus is moved via queueMicrotask; flush the microtask queue.
    await Promise.resolve();
    await Promise.resolve();

    const cancelButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.admin-confirm-dialog__actions button',
    );
    expect(document.activeElement).toBe(cancelButton);
  });

  it('returns focus to the triggering element when closed', async () => {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('#trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    host.open.set(true);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();

    host.open.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);
  });
});
