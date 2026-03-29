import { Component, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPasswordComponent implements OnDestroy {
  email: string = '';
  isLoading = false;
  isSent = false;
  errorMessage: string | null = null;
  
  resendCountdown: number = 0;
  private timerInterval: any;

  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);

  async onSubmit() {
    if (!this.email || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = null;

    try {
      await sendPasswordResetEmail(this.auth, this.email);
      this.isSent = true;
      this.startCountdown();
    } catch (error: any) {
      this.errorMessage = this.getFriendlyErrorMessage(error.code);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  startCountdown() {
    this.resendCountdown = 30;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        clearInterval(this.timerInterval);
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  handleTryAgain() {
    if (this.resendCountdown > 0) return;
    this.isSent = false;
    this.cdr.detectChanges();
  }

  private getFriendlyErrorMessage(code: string): string {
    switch (code) {
      case 'auth/user-not-found': return 'No account found with this email.';
      case 'auth/invalid-email': return 'Please enter a valid email address.';
      case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
      default: return 'An error occurred. Please try again.';
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }
}