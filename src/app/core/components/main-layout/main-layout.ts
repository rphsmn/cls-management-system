import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { ConnectionService } from '../../../core/services/connection.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Observable, map } from 'rxjs';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.css'],
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private connectionService = inject(ConnectionService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private inactivityTimeout: any;
  private readonly INACTIVITY_LIMIT = 2 * 60 * 60 * 1000; // 2 hours

  showLogoutModal = false;
  showNotifications = false;
  darkMode = false;

  // Using the observables from AuthService
  currentUser$ = this.authService.currentUser$;
  isLoading$ = this.authService.isLoading$;

  // Connection state for offline indicator
  isOnline$: Observable<boolean> = this.connectionService.connectionState$.pipe(
    map((state) => state.isOnline),
  );

  // Notifications
  unreadCount$ = this.notificationService.unreadCount$;
  notifications$ = this.notificationService.notifications$;

  ngOnInit() {
    console.log('[MainLayout] ngOnInit - checking theme...');
    const savedTheme = localStorage.getItem('theme');
    console.log('[MainLayout] Saved theme from localStorage:', savedTheme);
    if (savedTheme === 'dark') {
      this.darkMode = true;
    }
    console.log('[MainLayout] darkMode state after init:', this.darkMode);
    this.authService.currentUser$.subscribe((user) => {
      if (user) {
        this.notificationService.subscribeToNotifications(user.role, user.uid);
        this.resetInactivityTimeout();
      }
    });
    this.resetInactivityTimeout();
  }

  @HostListener('window:mouseup')
  @HostListener('window:keydown')
  @HostListener('window:click')
  @HostListener('window:scroll')
  onUserActivity() {
    this.resetInactivityTimeout();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent) {
    // Ctrl/Cmd + L = Logout
    if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
      event.preventDefault();
      this.confirmLogout();
    }
    // Ctrl/Cmd + D = Go to Dashboard
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault();
      this.router.navigate(['/dashboard']);
    }
    // Ctrl/Cmd + P = Go to Profile
    if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
      event.preventDefault();
      this.router.navigate(['/profile']);
    }
    // Escape = Close modals
    if (event.key === 'Escape') {
      if (this.showLogoutModal) {
        this.cancelLogout();
      }
      if (this.showNotifications) {
        this.showNotifications = false;
      }
    }
  }

  toggleDarkMode() {
    console.log('[MainLayout] toggleDarkMode - before:', this.darkMode);
    this.darkMode = !this.darkMode;
    console.log('[MainLayout] toggleDarkMode - after:', this.darkMode);
    localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
    console.log('[MainLayout] localStorage theme set to:', this.darkMode ? 'dark' : 'light');
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  private resetInactivityTimeout() {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }
    const currentUser = this.authService.currentUser;
    if (currentUser) {
      this.inactivityTimeout = setTimeout(() => {
        console.log('[MainLayout] Session timed out due to inactivity');
        this.authService.logout();
        this.router.navigate(['/login']);
      }, this.INACTIVITY_LIMIT);
    }
  }

  async markAllAsRead() {
    const user = this.authService.currentUser;
    if (user) {
      await this.notificationService.markAllAsRead(user.role);
    }
  }

  async clearAllNotifications() {
    const user = this.authService.currentUser;
    if (user) {
      await this.notificationService.clearAllNotifications(user.role);
    }
  }

  async markAsRead(notification: any) {
    console.log('[MainLayout] Mark as read clicked:', notification);
    if (!notification.read) {
      await this.notificationService.markAsRead(notification.id);
    }
  }

  ngOnDestroy() {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }
    this.notificationService.unsubscribeFromNotifications();
    this.destroy$.next();
    this.destroy$.complete();
  }

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
      r.includes('MANAGER') ||
      r === 'MANAGING DIRECTOR'
    );
  }

  canSeeAuditLogs(role: string, dept?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    const d = (dept || '').toUpperCase();
    return (
      r.includes('HR') ||
      r.includes('HUMAN RESOURCE') ||
      r.includes('ADMIN MANAGER') ||
      r.includes('MANAGER') ||
      r.includes('MGR') ||
      d.includes('MANAGER') ||
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
