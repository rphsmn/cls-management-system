import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.css']
})
export class MainLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  showLogoutModal = false;
  
  // Using the observables from AuthService
  currentUser$ = this.authService.currentUser$;
  isLoading$ = this.authService.isLoading$;

  confirmLogout() { 
    this.showLogoutModal = true; 
  }

  cancelLogout() { 
    this.showLogoutModal = false; 
  }

  async executeLogout() {
    try {
      await this.authService.logout();
      this.showLogoutModal = false;
      this.router.navigate(['/login']);
    } catch (error) {
      // Logout failed silently
    }
  }

  /**
   * Role-Based Access Control Helpers
   */
  hasAccess(role: string): boolean {
    if (!role) return false;
    return this.canSeeEmployees(role) || this.canSeeApprovals(role);
  }

  canSeeEmployees(role: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return (
      r.includes('HR') || 
      r.includes('HUMAN RESOURCE') || 
      r.includes('ADMIN MANAGER') || 
      r.includes('ADM-MGR') || 
      r.includes('MANAGER') || 
      r.includes('MGR') ||
      r === 'MANAGING DIRECTOR'
    );
  }

  canSeeApprovals(role: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    // Managing Director cannot see approvals - hands-off approach
    if (r === 'MANAGING DIRECTOR') return false;
    return (
      r.includes('SUPERVISOR') || 
      r.includes('MANAGER') || 
      r.includes('MGR') || 
      r.includes('HR') ||
      r.includes('HUMAN RESOURCE')
    );
  }
}