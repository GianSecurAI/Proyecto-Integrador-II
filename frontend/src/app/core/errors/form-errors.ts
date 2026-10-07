import { AbstractControl, FormGroup } from '@angular/forms';
import { toApiError } from '../models/api-error.model';

/**
 * Shows backend `400 VALIDATION_FAILED` `fieldErrors` on a reactive form. UX only: the backend is
 * authoritative; this just surfaces its verdict next to the matching control. `fieldMap` maps a
 * backend field path (e.g. `delivery.address`) to a control name when they differ. Returns the
 * messages that could NOT be attached to a control, so the caller can show them as a summary.
 */
export function applyFieldErrors(
  form: FormGroup,
  err: unknown,
  fieldMap: Record<string, string> = {},
): string[] {
  const api = toApiError(err);
  if (api?.code !== 'VALIDATION_FAILED') return [];
  const unmatched: string[] = [];
  for (const fe of api.fieldErrors ?? []) {
    const name = fieldMap[fe.field] ?? fe.field;
    const control: AbstractControl | null = form.get(name);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: fe.message });
      control.markAsTouched();
    } else {
      unmatched.push(`${fe.field}: ${fe.message}`);
    }
  }
  if (!api.fieldErrors?.length && api.message) unmatched.push(api.message);
  return unmatched;
}

/** The server message attached by `applyFieldErrors` (or `null`). */
export function serverError(control: AbstractControl): string | null {
  const value: unknown = control.errors?.['server'];
  return typeof value === 'string' ? value : null;
}
