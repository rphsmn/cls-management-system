import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService, User, calculatePaidTimeOff } from '../../core/services/auth';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  currentUser$: Observable<User | null>;
  private authService = inject(AuthService);
  
  // Computed values (will be updated when user data is available)
  yearsOfService = 'N/A';
  paidTimeOff = 0;
  private currentUser: User | null = null;
  
  // Email options state
  showEmailOptions = false;
  emailCopied = false;

  constructor() {
    this.currentUser$ = this.authService.currentUser$;
  }

  ngOnInit(): void {
    // Subscribe to update computed values when user data changes
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = user;
        this.updateComputedValues();
      }
    });
  }
  
  private updateComputedValues(): void {
    if (!this.currentUser) return;
    
    // Calculate years of service
    if (this.currentUser.joinedDate) {
      const joinDate = new Date(this.currentUser.joinedDate);
      const today = new Date();
      const years = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      
      if (years < 1) {
        this.yearsOfService = 'Less than 1 year';
      } else if (years < 2) {
        this.yearsOfService = '1 year';
      } else {
        this.yearsOfService = `${Math.floor(years)} years`;
      }
    } else {
      this.yearsOfService = 'N/A';
    }
    
    // Calculate paid time off
    this.paidTimeOff = calculatePaidTimeOff(this.currentUser.joinedDate, this.currentUser.role);
  }
  
  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  }
  
  toggleEmailOptions(): void {
    this.showEmailOptions = !this.showEmailOptions;
    this.emailCopied = false;
  }
  
  getGmailComposeUrl(): string {
    const subject = encodeURIComponent(`Update Request - ${this.currentUser?.name || 'Employee'}`);
    const body = encodeURIComponent(`Hello HR,\n\nI would like to request an update to my professional information.\n\nEmployee: ${this.currentUser?.name || 'N/A'}\nEmployee ID: ${this.currentUser?.employeeId || 'N/A'}\nDepartment: ${this.currentUser?.department || this.currentUser?.dept || 'N/A'}\n\nPlease let me know what information needs to be updated.\n\nThank you.`);
    return `https://mail.google.com/mail/?view=cm&fs=1&to=neptunorosalie25@gmail.com&su=${subject}&body=${body}`;
  }
  
  getYahooComposeUrl(): string {
    const subject = encodeURIComponent(`Update Request - ${this.currentUser?.name || 'Employee'}`);
    const body = encodeURIComponent(`Hello HR,\n\nI would like to request an update to my professional information.\n\nEmployee: ${this.currentUser?.name || 'N/A'}\nEmployee ID: ${this.currentUser?.employeeId || 'N/A'}\nDepartment: ${this.currentUser?.department || this.currentUser?.dept || 'N/A'}\n\nPlease let me know what information needs to be updated.\n\nThank you.`);
    return `https://compose.mail.yahoo.com/?to=neptunorosalie25@gmail.com&subject=${subject}&body=${body}`;
  }
  
  getOutlookWebComposeUrl(): string {
    const subject = encodeURIComponent(`Update Request - ${this.currentUser?.name || 'Employee'}`);
    const body = encodeURIComponent(`Hello HR,\n\nI would like to request an update to my professional information.\n\nEmployee: ${this.currentUser?.name || 'N/A'}\nEmployee ID: ${this.currentUser?.employeeId || 'N/A'}\nDepartment: ${this.currentUser?.department || this.currentUser?.dept || 'N/A'}\n\nPlease let me know what information needs to be updated.\n\nThank you.`);
    return `https://outlook.live.com/owa/?path=/mail/action/compose&to=neptunorosalie25@gmail.com&subject=${subject}&body=${body}`;
  }
  
  getMailtoUrl(): string {
    const subject = encodeURIComponent(`Update Request - ${this.currentUser?.name || 'Employee'}`);
    const body = encodeURIComponent(`Hello HR,\n\nI would like to request an update to my professional information.\n\nEmployee: ${this.currentUser?.name || 'N/A'}\nEmployee ID: ${this.currentUser?.employeeId || 'N/A'}\nDepartment: ${this.currentUser?.department || this.currentUser?.dept || 'N/A'}\n\nPlease let me know what information needs to be updated.\n\nThank you.`);
    return `mailto:neptunorosalie25@gmail.com?subject=${subject}&body=${body}`;
  }
  
  copyHrEmail(): void {
    navigator.clipboard.writeText('neptunorosalie25@gmail.com').then(() => {
      this.emailCopied = true;
      setTimeout(() => {
        this.emailCopied = false;
      }, 2000);
    });
  }
}
