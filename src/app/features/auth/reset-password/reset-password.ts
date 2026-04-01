import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Auth, verifyPasswordResetCode, confirmPasswordReset } from '@angular/fire/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css']
})
export class ResetPasswordComponent {
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  resetForm: FormGroup;
  isLoading = false;
  isSuccess = false;
  passwordVisible = false;
  errorMessage = '';

  constructor() {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    const password = g.get('password')?.value;
    const confirm = g.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  async onSubmit() {
    if (this.resetForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      // Get the oobCode from the URL query parameters
      const oobCode = this.route.snapshot.queryParams['oobCode'];
      
      if (!oobCode) {
        this.errorMessage = 'Invalid reset link. Please request a new password reset.';
        this.isLoading = false;
        return;
      }

      try {
        // First verify the code is valid
        await verifyPasswordResetCode(this.auth, oobCode);
        
        // Then confirm the password reset
        await confirmPasswordReset(this.auth, oobCode, this.resetForm.get('password')?.value);
        
        this.isLoading = false;
        this.isSuccess = true;
      } catch (error: any) {
        this.isLoading = false;
        
        // Handle specific Firebase auth errors
        if (error.code === 'auth/expired-action-code') {
          this.errorMessage = 'This reset link has expired. Please request a new password reset.';
        } else if (error.code === 'auth/invalid-action-code') {
          this.errorMessage = 'This reset link is invalid. Please request a new password reset.';
        } else {
          this.errorMessage = 'Failed to reset password. Please try again.';
        }
      }
    }
  }
}