import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationStart } from '@angular/router';
import { Subject, takeUntil, filter, take } from 'rxjs';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  passwordVisible = false;
  isLoading = false;
  errorMessage: string | null = null;
  greeting: string = '';

  private destroy$ = new Subject<void>();
  private isSubmitting = false;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  constructor() {
    this.loginForm = this.fb.group({
      employeeId: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
  }

  ngOnInit() {
    // Add class to html element to prevent overflow issues on mobile
    document.documentElement.classList.add('login-page');
    document.body.classList.add('login-page-body');

    // Set time-based greeting
    this.greeting = this.getGreeting();

    // Force reset all state when component initializes (e.g., navigating back to login)
    this.resetFormState();

    // Subscribe to navigation events to reset form when coming back to login
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        filter((event) => (event as NavigationStart).url === '/login'),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.resetFormState();
      });

    // Reset local loading state when auth state changes (user logged out)
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      // Always reset when user is null (logged out)
      this.isLoading = false;
      this.errorMessage = null;
      this.isSubmitting = false;
      // Reset form for next login attempt
      this.loginForm.reset({ employeeId: '', password: '', rememberMe: false });
    });
  }

  ngOnDestroy() {
    // Clean up classes added for login page
    document.documentElement.classList.remove('login-page');
    document.body.classList.remove('login-page-body');

    this.destroy$.next();
    this.destroy$.complete();
  }

  private resetFormState() {
    // Aggressive reset of all state
    this.isLoading = false;
    this.errorMessage = null;
    this.isSubmitting = false;
    this.loginForm.reset({ employeeId: '', password: '', rememberMe: false });
    this.passwordVisible = false;
  }

  togglePassword() {
    this.passwordVisible = !this.passwordVisible;
  }

  private getGreeting(): string {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Time-based greetings
    if (hour >= 5 && hour < 12) {
      // Morning (5am-11:59am)
      if (day === 1) return 'Happy Monday';
      return 'Good morning';
    } else if (hour >= 12 && hour < 18) {
      // Afternoon (12pm-5:59pm)
      if (day === 5) return 'Almost Friday!';
      return 'Good afternoon';
    } else if (hour >= 18 && hour < 22) {
      // Evening (6pm-9:59pm)
      if (day === 5) return 'Happy Friday!'; // Friday evening
      return 'Good evening';
    } else {
      // Late night (10pm-4:59am)
      return 'Still working?';
    }
  }

  async onSubmit() {
    // Prevent multiple simultaneous submissions
    if (this.loginForm.invalid || this.isLoading || this.isSubmitting) {
      return;
    }

    this.isLoading = true;
    this.isSubmitting = true;
    this.errorMessage = null;

    const { employeeId, password, rememberMe } = this.loginForm.value;

    try {
      const result = await this.authService.login(employeeId, password, rememberMe);

      if (result.success) {
        // Wait for loading to complete before navigating
        // This ensures the user profile is fetched before the dashboard loads

        // Wait for isLoading$ to become false (profile loaded or timeout)
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 5000); // 5 second timeout

          const sub = this.authService.isLoading$.subscribe((loading) => {
            if (!loading) {
              clearTimeout(timeout);
              sub.unsubscribe();
              resolve();
            }
          });
        });

        // Reset submission flag
        this.isSubmitting = false;
        this.router.navigate(['/dashboard']);
      } else {
        // Auth failed - reset loading state
        this.isLoading = false;
        this.isSubmitting = false;
        this.errorMessage = result.error || 'Access Denied. Invalid Employee ID or Password.';
      }
    } catch (error) {
      // Unexpected error - reset loading state
      this.isLoading = false;
      this.isSubmitting = false;
      this.errorMessage = 'An unexpected error occurred. Please try again.';
    }
  }
}
