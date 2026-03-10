import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../core/services/auth';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './approvals.html',
  styleUrl: './approvals.css'
})
export class ApprovalsComponent implements OnInit {
  requests$: Observable<any[]>;
  currentUser: User | null = null;

  constructor(private authService: AuthService) {
    this.requests$ = this.authService.requests$;
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  // Fixes TS2339: Logic to check if current user is the target reviewer
  canApprove(req: any): boolean {
    if (!this.currentUser) return false;
    return req.targetReviewer === this.currentUser.role && req.status !== 'Approved' && req.status !== 'Rejected';
  }

  updateStatus(req: any, status: string) {
    this.authService.updateRequestStatus(req, status);
  }
}