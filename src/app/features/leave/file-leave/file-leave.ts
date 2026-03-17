import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService, Attachment } from '../../../core/services/auth';
import { Observable, combineLatest, map } from 'rxjs';

@Component({
  selector: 'app-file-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './file-leave.html',
  styleUrls: ['./file-leave.css']
})
export class FileLeaveComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  liveCredits$: Observable<any>;
  
  leaveRequest = {
    type: '',
    startDate: '',
    endDate: '',
    reason: ''
  };

  selectedFile: Attachment | null = null;
  fileName = '';
  showSuccessToast = false;

  constructor() {
    // Syncs user data and requests to show real-time Available/Pending balances
    this.liveCredits$ = combineLatest([
      this.authService.currentUser$,
      this.authService.requests$
    ]).pipe(
      map(([user, allRequests]) => {
        if (!user) return null;
        const myRequests = allRequests.filter(req => req.employeeName === user.name);
        
        const calc = (type: string, status: 'pending' | 'approved') => {
          return myRequests
            .filter(r => r.type === type && (status === 'pending' ? (r.status === 'Pending' || r.status.includes('HR')) : r.status === 'Approved'))
            .reduce((sum, r) => {
              if (r.period?.includes(' - ')) {
                const dates = r.period.split(' - ');
                return sum + (Math.ceil(Math.abs(new Date(dates[1]).getTime() - new Date(dates[0]).getTime()) / 86400000) + 1);
              }
              return sum + 1;
            }, 0);
        };

        return {
          ...user,
          balances: {
            'Paid Leave': { rem: user.credits.paidLeave - calc('Paid Leave', 'approved'), pen: calc('Paid Leave', 'pending') },
            'Sick Leave': { rem: user.credits.sickLeave - calc('Sick Leave', 'approved'), pen: calc('Sick Leave', 'pending') },
            'Birthday Leave': { rem: user.credits.birthdayLeave - calc('Birthday Leave', 'approved'), pen: calc('Birthday Leave', 'pending') }
          }
        };
      })
    );
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large! Please upload a document smaller than 2MB.');
      event.target.value = ''; 
      return;
    }

    this.fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.selectedFile = {
        name: file.name,
        type: file.type,
        data: reader.result as string
      };
    };
    reader.readAsDataURL(file);
  }

  removeFile() {
    this.fileName = '';
    this.selectedFile = null;
  }

  onSubmit() {
    const period = this.leaveRequest.startDate === this.leaveRequest.endDate 
      ? this.leaveRequest.startDate 
      : `${this.leaveRequest.startDate} - ${this.leaveRequest.endDate}`;
    
    const newRequest = {
      type: this.leaveRequest.type,
      period: period,
      reason: this.leaveRequest.reason,
      dateFiled: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      attachment: this.selectedFile
    };

    this.authService.addRequest(newRequest);
    this.showSuccessToast = true;

    setTimeout(() => {
      this.showSuccessToast = false;
      this.router.navigate(['/history']);
    }, 2500);
  }
}