import { Injectable, inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth';

@Injectable({ providedIn: 'root' })
export class AuthGuard {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(): boolean | UrlTree {
    // 1. Check Service State
    const user = this.authService.currentUserSubject.value;
    // 2. Check Storage as backup
    const hasSession = localStorage.getItem('cls_user_session');

    if (user || hasSession) {
      return true; // Keep the user in the app
    }

    // Only redirect if there is absolutely no user found
    return this.router.createUrlTree(['/login']);
  }
}