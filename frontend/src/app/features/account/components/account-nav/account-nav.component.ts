import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Small "Perfil" / "Mis pedidos" / "Incidencias" tab nav shared by `ProfilePage`,
 * `OrderHistoryPage` and `IncidentsPage`, so a signed-in customer can move between the areas of
 * the `/account` feature (all guarded by the same `authGuard` + `role: 'CLIENTE'`, see
 * `app.routes.ts`). Follows `docs/discovery/04-printcrate-adaptation.md` §A6's recommendation to
 * group profile + order history + incidents as sub-routes of one unified `account` feature rather
 * than unrelated standalone pages. Deliberately minimal — three links, not a redesign of the
 * already-built `ProfilePage`.
 */
@Component({
  selector: 'app-account-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './account-nav.component.html',
  styleUrl: './account-nav.component.scss',
})
export class AccountNavComponent {}
