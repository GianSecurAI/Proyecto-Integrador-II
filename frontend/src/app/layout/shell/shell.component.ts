import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { HeaderComponent } from '../header/header.component';

/**
 * Application shell: header + routed content + footer, composed once here so `layout/`
 * stays the single place that owns page chrome (project requirements frontend conventions), rather than
 * `App` doing it directly. Includes a skip-link because every route now has a header before
 * its main content (Constitution Principle XVI).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {}
