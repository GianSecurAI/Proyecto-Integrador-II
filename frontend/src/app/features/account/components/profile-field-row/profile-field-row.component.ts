import { Component, input } from '@angular/core';

/**
 * Presentational "label + static value" row used by `ProfilePage`'s view mode. Extracted only
 * because the same markup repeats five times (email, member-since, first name, last name, phone)
 * — plain display, no formatting/business decisions (the caller passes an already-formatted
 * string). Scoped to this feature rather than `shared/ui` because no other screen needs it yet.
 */
@Component({
  selector: 'app-profile-field-row',
  standalone: true,
  templateUrl: './profile-field-row.component.html',
  styleUrl: './profile-field-row.component.scss',
})
export class ProfileFieldRowComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
}
