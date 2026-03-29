import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password';
import { MainLayoutComponent } from './core/components/main-layout/main-layout';
import { DashboardComponent } from './features/dashboard/dashboard';
import { AuthGuard } from './core/guards/auth.guard';
import { FileLeaveComponent } from './features/leave/file-leave/file-leave';
import { HistoryComponent } from './features/leave/history/history.component';
import { ApprovalsComponent } from './features/approvals/approvals';
import { ProfileComponent } from './features/profile/profile';
import { CalendarComponent } from './features/calendar/calendar';
import { EmployeeStatusComponent } from './features/employees/employees';
import { EmployeeUpdateComponent } from './features/admin/employee-update/employee-update.component';

export const routes: Routes = [
  { 
    path: 'login', 
    component: LoginComponent, 
    title: 'Login | COR LOGICS' 
  },
  { 
    path: 'forgot-password', 
    component: ForgotPasswordComponent, 
    title: 'Forgot Password | COR LOGICS' 
  },
  { 
    path: 'reset-password', 
    component: ResetPasswordComponent, 
    title: 'Reset Password | COR LOGICS' 
  },
  {
    path: '',
    canActivate: [AuthGuard],
    component: MainLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'file-leave', component: FileLeaveComponent },
      { path: 'history', component: HistoryComponent },
      { path: 'approvals', component: ApprovalsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'calendar', component: CalendarComponent },
      { path: 'employees', component: EmployeeStatusComponent },
      { path: 'admin/employee-update', component: EmployeeUpdateComponent }
    ]
  },
  // Explicitly add login redirect for when not authenticated
  { path: '**', redirectTo: 'login' }
];