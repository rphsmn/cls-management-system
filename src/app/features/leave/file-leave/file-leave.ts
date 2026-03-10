import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
// FIXED PATH: Go up 3 levels to reach 'src/app/' then down into 'core/services'
import { AuthService } from '../../../core/services/auth'; 

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
    const newRequest = {
      type: this.leaveType,
      reason: this.leaveReason,
      range: `${this.startDate} to ${this.endDate}`,
      dateFiled: new Date().toLocaleDateString()
    };

    this.authService.addRequest(newRequest);
    this.router.navigate(['/dashboard']);
  }
}