import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService, Attachment } from '../../../core/services/auth';
import { Observable, combineLatest, map, take } from 'rxjs';

@Component({
  selector: 'app-file-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './file-leave.html',
  styleUrls: ['./file-leave.css']
})
export class FileLeaveComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  liveCredits$: Observable<any>;
  minDate: string = '';
  totalDays: number = 0;
  isOverBalance: boolean = false;
  
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
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];

    this.liveCredits$ = combineLatest([
      this.authService.currentUser$,
      this.authService.requests$
    ]).pipe(
      map(([user, allRequests]) => {
        if (!user) return null;
        const isBirthMonth = user.birthDate ? 
          new Date(user.birthDate).getMonth() === new Date().getMonth() : false;

        const myRequests = allRequests.filter(req => req.employeeName === user.name);
        
const calc = (type: string, status: 'pending' | 'approved') => {
  return myRequests
    .filter(r => {
      const isSameType = r.type === type;
      const rStatus = r.status.toLowerCase();
      
      if (status === 'approved') {
        return isSameType && rStatus === 'approved';
      } else {
        // This captures "Pending", "pending", "Pending HR", etc.
        return isSameType && (rStatus.includes('pending') || rStatus.includes('hr'));
      }
    })
    .reduce((sum, r) => {
      if (r.period?.includes(' - ')) {
        const dates = r.period.split(' - ');
        const start = new Date(dates[0]).getTime();
        const end = new Date(dates[1]).getTime();
        return sum + (Math.ceil(Math.abs(end - start) / 86400000) + 1);
      }
      return sum + 1;
    }, 0);
};

        return {
          ...user,
          isBirthMonth,
          balances: {
            'Paid Leave': { rem: user.credits.paidLeave - calc('Paid Leave', 'approved'), pen: calc('Paid Leave', 'pending') },
            'Sick Leave': { rem: user.credits.sickLeave - calc('Sick Leave', 'approved'), pen: calc('Sick Leave', 'pending') },
            'Birthday Leave': { rem: user.credits.birthdayLeave - calc('Birthday Leave', 'approved'), pen: calc('Birthday Leave', 'pending') }
          }
        };
      })
    );
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['date']) {
        this.leaveRequest.startDate = params['date'];
        this.leaveRequest.endDate = params['date'];
        this.calculateDays();
      }
    });
  }

  calculateDays() {
    if (this.leaveRequest.startDate && this.leaveRequest.endDate) {
      const start = new Date(this.leaveRequest.startDate);
      const end = new Date(this.leaveRequest.endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      this.totalDays = diffDays > 0 ? diffDays : 0;
      this.checkBalance();
    } else {
      this.totalDays = 0;
      this.isOverBalance = false;
    }
  }

  checkBalance() {
    if (!this.leaveRequest.type) return;
    this.liveCredits$.pipe(take(1)).subscribe(user => {
      if (user) {
        const available = user.balances[this.leaveRequest.type].rem;
        this.isOverBalance = this.totalDays > available;
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('File too large (Max 2MB)');
      event.target.value = '';
      return;
    }
    this.fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.selectedFile = { name: file.name, type: file.type, data: reader.result as string };
    };
    reader.readAsDataURL(file);
  }

  removeFile() {
    this.fileName = '';
    this.selectedFile = null;
  }

  onSubmit() {
    if (this.isOverBalance || this.totalDays <= 0) return;

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