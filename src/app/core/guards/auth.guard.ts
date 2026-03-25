import { Injectable, inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Observable, from } from 'rxjs';
import { map, take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthGuard {
  private authService = inject(Auth);
  private router = inject(Router);

  canActivate(): Observable<boolean | UrlTree> {
    // Use Firebase's onAuthStateChanged directly for reliable auth state
    // This is more reliable than waiting for the full user profile to load
    return new Observable<boolean | UrlTree>(observer => {
      const unsubscribe = onAuthStateChanged(this.authService, fbUser => {
        if (fbUser) {
          observer.next(true);
        } else {
          observer.next(this.router.createUrlTree(['/login']));
        }
        observer.complete();
      });
      
      // Cleanup on unsubscribe
      return () => unsubscribe();
    });
  }
}