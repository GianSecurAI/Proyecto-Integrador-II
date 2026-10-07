import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Sends the httpOnly session cookie (`ARM3D_SESSION`) with every request to the backend API.
 * With the dev proxy / same-origin deployment this is the browser default already; it matters
 * only if `apiBaseUrl` is ever an absolute cross-origin URL. Requests to anything else are left
 * untouched.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith(environment.apiBaseUrl) ? next(req.clone({ withCredentials: true })) : next(req);
