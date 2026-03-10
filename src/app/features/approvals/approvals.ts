import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth';
import { Observable, map } from 'rxjs';
import { User } from '../../core/models/user.model';

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
    // We get the requests from the service
    this.requests$ = this.authService.requests$.pipe(
      map(requests => requests.map(req => ({
        ...req,
        requesterName: req.requesterName || 'Unknown',
        requesterRole: req.requesterRole || 'Unknown'
      })))
    );
    
    // We subscribe to the current user to know their role (Manager or HR)
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnInit() {}

  // You ONLY see the request if you are the designated 'targetReviewer'
  canApprove(request: any): boolean {
    if (!this.currentUser) return false;

    return request.targetReviewer === this.currentUser.role;
  }

  updateStatus(request: any, status: string) {
    this.authService.updateRequestStatus(request, status);
  }
}