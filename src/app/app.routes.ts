import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard';
import { FileLeaveComponent } from './features/leave/file-leave/file-leave';
import { ApprovalsComponent } from './features/approvals/approvals';
import { HistoryComponent } from './features/leave/history/history.component';
import { LoginComponent } from './features/auth/login/login';
import { ProfileComponent } from './features/profile/profile';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'file-leave', component: FileLeaveComponent, canActivate: [AuthGuard] },
  { path: 'approvals', component: ApprovalsComponent, canActivate: [AuthGuard] },
  { path: 'history', component: HistoryComponent, canActivate: [AuthGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];
