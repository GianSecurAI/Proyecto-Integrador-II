import { HttpParams } from '@angular/common/http';

/** Builds query params, skipping `null`/`undefined`/blank values so optional filters never reach
 * the wire as empty strings (the backend treats an absent param as "no filter"). */
export function buildParams(
  values: Record<string, string | number | boolean | readonly (string | number)[] | null | undefined>,
): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params = params.append(key, String(item));
      continue;
    }
    const text = String(value);
    if (text.trim() === '') continue;
    params = params.set(key, text);
  }
  return params;
}
