import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  // This tag is the 'placeholder' where your Login/Dashboard will appear
  template: `<router-outlet></router-outlet>` 
})
export class App {
  private authService = inject(AuthService);
  
  constructor() {
    // Initialize auth subscription in constructor so it runs BEFORE route guards
    // This ensures Firebase auth state is restored before any guards check the user
    this.authService.initializeAuthSubscription();
  }
}