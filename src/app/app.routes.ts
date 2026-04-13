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
import { AuditLogsComponent } from './features/audit-logs/audit-logs';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    title: 'CLS HRIS | Login',
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    title: 'CLS HRIS | Forgot Password',
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    title: 'CLS HRIS | Reset Password',
  },
  {
    path: '',
    canActivate: [AuthGuard],
    component: MainLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent, title: 'CLS HRIS | Dashboard' },
      { path: 'file-leave', component: FileLeaveComponent, title: 'CLS HRIS | File Leave' },
      { path: 'history', component: HistoryComponent, title: 'CLS HRIS | Leave History' },
      { path: 'approvals', component: ApprovalsComponent, title: 'CLS HRIS | Approvals' },
      { path: 'profile', component: ProfileComponent, title: 'CLS HRIS | Profile' },
      { path: 'calendar', component: CalendarComponent, title: 'CLS HRIS | Calendar' },
      { path: 'employees', component: EmployeeStatusComponent, title: 'CLS HRIS | Employees' },
      {
        path: 'admin/employee-update',
        component: EmployeeUpdateComponent,
        title: 'CLS HRIS | Employee Update',
      },
      { path: 'audit-logs', component: AuditLogsComponent, title: 'CLS HRIS | Audit Logs' },
    ],
  },
  // Explicitly add login redirect for when not authenticated
  { path: '**', redirectTo: 'login' },
];
