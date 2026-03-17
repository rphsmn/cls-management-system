import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth'; 

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  passwordVisible = false;
  isLoading = false;
  errorMessage: string | null = null;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  constructor() {
    this.loginForm = this.fb.group({
      employeeId: ['', [Validators.required]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });
  }

  togglePassword() {
    this.passwordVisible = !this.passwordVisible;
  }

  async onSubmit() {
    if (this.loginForm.invalid || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = null;

    // Simulated network delay for the "Authenticating" UI state
    await new Promise(resolve => setTimeout(resolve, 1200));

    const { employeeId, password } = this.loginForm.value;
    const success = this.authService.login(employeeId, password);

    if (success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.isLoading = false;
      this.errorMessage = "Access Denied. Invalid Employee ID or Password.";
    }
  }
}