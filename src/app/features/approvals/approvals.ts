import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, map, combineLatest, startWith, BehaviorSubject, tap } from 'rxjs';
import { AuthService, User } from '../../core/services/auth';
import { LeaveService } from '../../core/services/leave.services';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './approvals.html',
  styleUrls: ['./approvals.css']
})
export class ApprovalsComponent {
  private authService = inject(AuthService);
  private leaveService = inject(LeaveService);
  
  currentUser$: Observable<User | null> = this.authService.currentUser$;
  allFilteredRequests$: Observable<any[]>;
  paginatedRequests$: Observable<any[]>;
  
  itemsPerPage = 10;
  private currentPageSubject = new BehaviorSubject<number>(1);
  currentPage$ = this.currentPageSubject.asObservable();
  
  searchControl = new FormControl('');
  monthControl = new FormControl(new Date().getMonth());
  yearControl = new FormControl(new Date().getFullYear());

  months = [
    { v: 0, l: 'Jan' }, { v: 1, l: 'Feb' }, { v: 2, l: 'Mar' }, { v: 3, l: 'Apr' },
    { v: 4, l: 'May' }, { v: 5, l: 'Jun' }, { v: 6, l: 'Jul' }, { v: 7, l: 'Aug' },
    { v: 8, l: 'Sep' }, { v: 9, l: 'Oct' }, { v: 10, l: 'Nov' }, { v: 11, l: 'Dec' }
  ];
  years = [2024, 2025, 2026];

  expandedReq: any = null;

  constructor() {
    this.allFilteredRequests$ = combineLatest([
      this.authService.currentUser$,
      this.leaveService.requests$,
      this.searchControl.valueChanges.pipe(startWith(''), tap(() => this.currentPageSubject.next(1))),
      this.monthControl.valueChanges.pipe(startWith(this.monthControl.value), tap(() => this.currentPageSubject.next(1))),
      this.yearControl.valueChanges.pipe(startWith(this.yearControl.value), tap(() => this.currentPageSubject.next(1)))
    ]).pipe(
      map(([user, allRequests, searchTerm, selMonth, selYear]: [User | null, any[], string | null, number | null, number | null]) => {
        if (!user || !allRequests) return [];
        
        const term = searchTerm?.toLowerCase().trim() || '';
        const normalizedUserRole = user.role.toLowerCase();

        return allRequests.filter(req => {
          // Only show requests that need action (pending or awaiting approval)
          const actionStatuses = ['Pending', 'Awaiting HR Approval', 'Awaiting Admin Manager Approval'];
          if (!actionStatuses.includes(req.status)) return false;
          
          const matchesSearch = 
            req.employeeName?.toLowerCase().includes(term) || 
            req.companyId?.toLowerCase().includes(term) ||
            req.type?.toLowerCase().includes(term);

          if (!matchesSearch || req.uid === user.uid) return false;

          const isMatch = this.checkPeriodMatch(req.period, Number(selMonth), Number(selYear));
          if (!isMatch) return false;

          const normalizedTarget = (req.targetReviewer || '').toLowerCase();
          
          // Explicitly filter out 'None' targetReviewer (fully approved/rejected)
          if (normalizedTarget === 'none' || !req.targetReviewer) {
            return false;
          }
          
          // HR role mapping - HR users should see requests targeted to 'HR'
          const hrRoles = ['hr', 'human resource officer', 'human resources officer', 'hr officer'];
          if (normalizedTarget === 'hr' && hrRoles.includes(normalizedUserRole)) {
            return true;
          }
          
          // Admin Manager should see requests targeted to 'Admin Manager'
          const adminManagerRoles = ['admin manager', 'admin'];
          if (normalizedTarget === 'admin manager' && adminManagerRoles.includes(normalizedUserRole)) {
            return true;
          }
          
          // Operations Admin Supervisor should see requests targeted to them
          const opsAdminRoles = ['operations admin supervisor', 'ops admin supervisor', 'ops admin'];
          if (normalizedTarget === 'operations admin supervisor' && opsAdminRoles.includes(normalizedUserRole)) {
            return true;
          }
          
          // Account Supervisor should see requests targeted to them
          const acctSupervisorRoles = ['account supervisor', 'acct supervisor', 'acct sup'];
          if (normalizedTarget === 'account supervisor' && acctSupervisorRoles.includes(normalizedUserRole)) {
            return true;
          }
          
          return normalizedTarget === normalizedUserRole;
        });
      })
    );

    this.paginatedRequests$ = combineLatest([this.allFilteredRequests$, this.currentPage$]).pipe(
      map(([requests, page]) => {
        const start = (page - 1) * this.itemsPerPage;
        return requests.slice(start, start + this.itemsPerPage);
      })
    );
  }

  private checkPeriodMatch(period: string, selMonth: number, selYear: number): boolean {
    if (!period) return false;
    const separator = period.includes(' to ') ? ' to ' : ' - ';
    const dates = period.split(separator);
    const startDate = new Date(dates[0].trim());
    const endDate = dates[1] ? new Date(dates[1].trim()) : startDate;
    return (startDate.getMonth() === selMonth && startDate.getFullYear() === selYear) || 
           (endDate.getMonth() === selMonth && endDate.getFullYear() === selYear);
  }

  getFormattedPeriod(period: string): string {
    if (!period) return 'N/A';
    const separator = period.includes(' to ') ? ' to ' : ' - ';
    
    if (!period.includes(separator)) {
      const singleDate = new Date(period.trim());
      return `1 Day (${singleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    }

    const parts = period.split(separator);
    const start = new Date(parts[0].trim());
    const end = new Date(parts[1].trim());
    const diff = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${diff} ${diff === 1 ? 'Day' : 'Days'} (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  }

  updateStatus(req: any, action: string) {
    const isApprove = action === 'Approve';
    Swal.fire({
      title: `<div style="color: #1a5336; font-weight: 800; font-size: 24px; margin-bottom: 10px;">Confirm ${action}?</div>`,
      html: `<div style="font-size: 15px; color: #64748b;">Process leave for <strong>${req.employeeName}</strong>?</div>`,
      icon: isApprove ? 'success' : 'error', 
      showCancelButton: true,
      confirmButtonText: `Yes, ${action}`,
      cancelButtonText: 'No, Cancel',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: 'swal-premium-popup',
        confirmButton: isApprove ? 'swal-confirm-mint' : 'swal-confirm-danger',
        cancelButton: 'swal-cancel-outline',
        actions: 'swal-button-container'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const user = this.authService.currentUser;
        if (!user) return;
        
        const status = action === 'Approve' ? 'Approved' : 'Rejected';
        this.leaveService.updateRequestStatus(req.id, status, user.role).then(() => {
          Swal.fire({ 
            toast: true, 
            position: 'top-end', 
            showConfirmButton: false, 
            timer: 2000, 
            icon: 'success', 
            title: `Request ${action === 'Approve' ? 'Approved' : 'Rejected'}` 
          });
        }).catch(() => {
          Swal.fire({ 
            toast: true, 
            position: 'top-end', 
            showConfirmButton: false, 
            timer: 2000, 
            icon: 'error', 
            title: 'Failed to process request' 
          });
        });
      }
    });
  }

  viewDocument(attachment: any) {
    if (!attachment?.data) return;
    const newTab = window.open();
    newTab?.document.write(`<iframe src="${attachment.data}" frameborder="0" style="width:100%; height:100%;"></iframe>`);
  }

  getTotalPages(total: number) { return Math.ceil(total / this.itemsPerPage) || 1; }
  getStartRange(total: number) { return total === 0 ? 0 : (this.currentPageSubject.value - 1) * this.itemsPerPage + 1; }
  getEndRange(total: number) { return Math.min(this.currentPageSubject.value * this.itemsPerPage, total); }
  onItemsPerPageChange(e: any) { this.itemsPerPage = +e.target.value; this.currentPageSubject.next(1); }
  nextPage(total: number) { if (this.currentPageSubject.value < this.getTotalPages(total)) this.currentPageSubject.next(this.currentPageSubject.value + 1); }
  prevPage() { if (this.currentPageSubject.value > 1) this.currentPageSubject.next(this.currentPageSubject.value - 1); }
  toggleReason(req: any) { this.expandedReq = (this.expandedReq === req) ? null : req; }
  
  getLeaveIcon(type: string): string {
    const icons: any = { 
      'Birthday Leave': '🎂', 
      'Sick Leave': '🤒', 
      'Paid Time Off': '💰',
      'Paid Leave': '💰',
      'Maternity Leave': '🤱',
      'Paternity Leave': '👶',
      'Leave Without Pay': '⏰'
    };
    return icons[type] || '📄';
  }
}
