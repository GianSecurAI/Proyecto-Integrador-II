/**
 * UI ViewModel for the RF-04 profile screen (`pages/profile/profile.page.ts`), mapped from the
 * backend `CustomerProfileResponseDto` by `services/customer-profile.service.ts` (`createdAt` ->
 * `memberSince: Date`, nullable name/phone -> empty string). The backend `id`/`role` are not shown.
 */
export interface CustomerProfileViewModel {
  /** Read-only: the customer's OTP identity. Changing it is a distinct, unspecified concern. */
  readonly email: string;
  readonly memberSince: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
}

/** The only fields this screen ever lets a customer edit (the email is the login identity). */
export type EditableCustomerProfileFields = Pick<
  CustomerProfileViewModel,
  'firstName' | 'lastName' | 'phone'
>;
