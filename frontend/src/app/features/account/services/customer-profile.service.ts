import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Role } from '../../../shared/models/wire-enums';
import { CustomerProfileViewModel, EditableCustomerProfileFields } from '../models/customer-profile.model';

/** Backend `CustomerProfileResponseDto`. Optional fields arrive as `null` when never set. */
export interface CustomerProfileDto {
  id: number;
  email: string;
  role: Role;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

/** Backend `CustomerProfileUpdateRequestDto` (`PUT /api/customers/me`). The email is the login
 * identity and cannot be changed through this endpoint. */
export interface CustomerProfileUpdateDto {
  firstName: string;
  lastName: string;
  phone: string;
}

function toViewModel(dto: CustomerProfileDto): CustomerProfileViewModel {
  return {
    email: dto.email,
    memberSince: new Date(dto.createdAt),
    firstName: dto.firstName ?? '',
    lastName: dto.lastName ?? '',
    phone: dto.phone ?? '',
  };
}

const EMPTY_PROFILE: CustomerProfileViewModel = {
  email: '',
  memberSince: new Date(0),
  firstName: '',
  lastName: '',
  phone: '',
};

/**
 * The signed-in customer's own profile (`GET`/`PUT /api/customers/me`, CLIENTE only). Holds the
 * last server copy in a signal so the profile page renders it; every change goes to the backend
 * first and the signal is updated from the response.
 */
@Injectable({ providedIn: 'root' })
export class CustomerProfileService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/customers/me`;
  private readonly state = signal<CustomerProfileViewModel>(EMPTY_PROFILE);

  readonly profile = this.state.asReadonly();

  load(): Observable<CustomerProfileViewModel> {
    return this.http.get<CustomerProfileDto>(this.url).pipe(
      map(toViewModel),
      tap((profile) => this.state.set(profile)),
    );
  }

  save(changes: EditableCustomerProfileFields): Observable<CustomerProfileViewModel> {
    const body: CustomerProfileUpdateDto = {
      firstName: changes.firstName.trim(),
      lastName: changes.lastName.trim(),
      phone: changes.phone.trim(),
    };
    return this.http.put<CustomerProfileDto>(this.url, body).pipe(
      map(toViewModel),
      tap((profile) => this.state.set(profile)),
    );
  }
}
