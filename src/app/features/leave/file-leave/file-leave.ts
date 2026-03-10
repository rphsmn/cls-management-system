import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth'; 
import { Router } from '@angular/router';
import { take } from 'rxjs/operators'; // Added for a clean one-time subscription

@Component({
  selector: 'app-file-leave',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-leave.html',
  styleUrl: './file-leave.css'
})
export class FileLeaveComponent {
  leaveType: string = 'Paid Leave';
  leaveReason: string = ''; 
  startDate: string = '';
  endDate: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  submitLeave() {
    if (!this.startDate || !this.endDate) {
      alert('Please select start and end dates.');
      return;
    }
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    if (start > end) {
      alert('End date must be after start date.');
      return;
    }
    // 1. Get the current user details from the AuthService
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (user) {
        const newRequest = {
          // These two lines fix the "Jennifer vs Ralph" name bug:
          requesterName: user.name, 
          requesterRole: user.role,
          
          type: this.leaveType,
          reason: this.leaveReason,
          range: `${this.startDate} to ${this.endDate}`,
          status: 'Pending',
          dateFiled: new Date().toLocaleDateString()
        };

        // 2. Add the request with the correct names
        this.authService.addRequest(newRequest);
        
        alert('Leave request submitted successfully!');
        this.router.navigate(['/dashboard']);
      } else {
        alert('Error: User session not found. Please log in again.');
      }
    });
  }
}