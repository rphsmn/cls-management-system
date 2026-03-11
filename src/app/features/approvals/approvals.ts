import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, map, combineLatest } from 'rxjs';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './approvals.html',
  styleUrl: './approvals.css'
})
export class ApprovalsComponent {
  requests$: Observable<any[]>;
  showModal = false; // Fixes image_266df8.png
  pendingAction: 'Approve' | 'Reject' | null = null;
  selectedRequest: any = null;

  constructor(private authService: AuthService) {
    this.requests$ = this.authService.requests$; // Corrected variable name
  }

  updateStatus(req: any, action: 'Approve' | 'Reject') {
    this.selectedRequest = req;
    this.pendingAction = action;
    this.showModal = true;
  }

  confirmAction() {
    if (this.selectedRequest && this.pendingAction) {
      this.authService.updateRequestStatus(this.selectedRequest, this.pendingAction === 'Approve' ? 'Approved' : 'Rejected');
      this.closeModal();
    }
  }

  closeModal() {
    this.showModal = false;
  }

  hasPendingRequests(requests: any[]): boolean {
    return requests && requests.length > 0;
  }
}