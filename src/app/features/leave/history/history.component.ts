import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Observable, combineLatest, BehaviorSubject, startWith, map, tap, debounceTime, shareReplay, Subscription, take } from 'rxjs';
import { AuthService, User } from '../../../core/services/auth';
import { LeaveService } from '../../../core/services/leave.services';
import { calculateWorkdays } from '../../../core/utils/workday-calculator.util';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent implements OnDestroy {
  private authService = inject(AuthService);
  private leaveService = inject(LeaveService);

  currentUser$ = this.authService.currentUser$;
  allFilteredRequests$: Observable<any[]>;
  paginatedRequests$: Observable<any[]>;
  
  itemsPerPage = 10;
  private currentPageSubject = new BehaviorSubject<number>(1);
  currentPage$ = this.currentPageSubject.asObservable();
  
  // Pre-compute holidays once to avoid repeated localStorage access
  private holidayList: string[] = [];

  searchControl = new FormControl('', { nonNullable: true });
  monthControl = new FormControl(-1, { nonNullable: true }); // Default to 'All' months
  yearControl = new FormControl(-1, { nonNullable: true }); // Default to 'All' years
  statusControl = new FormControl('all', { nonNullable: true }); // Filter by status: all, active, cancelled

  statusOptions = [
    { v: 'all', l: 'All Requests' },
    { v: 'active', l: 'Active' },
    { v: 'cancelled', l: 'Cancelled' }
  ];

  months = [{ v: -1, l: 'All Months' }, { v: 0, l: 'Jan' }, { v: 1, l: 'Feb' }, { v: 2, l: 'Mar' }, { v: 3, l: 'Apr' }, { v: 4, l: 'May' }, { v: 5, l: 'Jun' }, { v: 6, l: 'Jul' }, { v: 7, l: 'Aug' }, { v: 8, l: 'Sep' }, { v: 9, l: 'Oct' }, { v: 10, l: 'Nov' }, { v: 11, l: 'Dec' }];
  years: number[] = [-1]; // Will be populated dynamically from leave data
  expandedReq: any = null;
  expandedCancellationReason: any = null;

  constructor() {
    // Load holidays once
    try {
      this.holidayList = JSON.parse(localStorage.getItem('company_holidays') || '[]');
    } catch (e) {
      this.holidayList = [];
    }
    
    this.allFilteredRequests$ = combineLatest([
      this.authService.currentUser$,
      this.leaveService.requests$,
      this.searchControl.valueChanges.pipe(
        startWith(''), 
        debounceTime(200),
        tap(() => this.currentPageSubject.next(1))
      ),
      this.monthControl.valueChanges.pipe(
        startWith(this.monthControl.value), 
        debounceTime(200),
        tap(() => this.currentPageSubject.next(1))
      ),
      this.yearControl.valueChanges.pipe(
        startWith(this.yearControl.value), 
        debounceTime(200),
        tap(() => this.currentPageSubject.next(1))
      ),
      this.statusControl.valueChanges.pipe(
        startWith(this.statusControl.value),
        debounceTime(200),
        tap(() => this.currentPageSubject.next(1))
      )
    ]).pipe(
      map(([user, requests, term, selMonth, selYear, selStatus]) => {
        if (!user || !requests) return [];
        
        // Convert string values to numbers (HTML select returns strings)
        const monthNum = typeof selMonth === 'string' ? parseInt(selMonth, 10) : selMonth;
        const yearNum = typeof selYear === 'string' ? parseInt(selYear, 10) : selYear;
        
        // Debug: Log filter values
        console.log('=== FILTER DEBUG ===');
        console.log('Selected Month:', selMonth, '-> Converted:', monthNum, '(type:', typeof monthNum, ')');
        console.log('Selected Year:', selYear, '-> Converted:', yearNum, '(type:', typeof yearNum, ')');
        console.log('Search Term:', term);
        console.log('Total Requests:', requests.length);
        
        // Dynamically generate years from leave data
        const yearSet = new Set<number>();
        requests.forEach(req => {
          if (req.period) {
            const startDate = this.parseISODate(req.period.split(' to ')[0]);
            if (startDate) {
              yearSet.add(startDate.getFullYear());
            }
          }
        });
        // Sort years in descending order and add 'All' option at the beginning
        const sortedYears = Array.from(yearSet).sort((a, b) => b - a);
        this.years = [-1, ...sortedYears];
        
        console.log('Available Years:', this.years);
        
        const userRoleUpper = user.role.toUpperCase();
        const filteredRequests = requests.filter(req => {
          if (!req.period) return false; // Skip requests without period
          
          // Status filter logic
          const isCancelled = req.status === 'Cancelled';
          if (selStatus === 'active' && isCancelled) return false; // Skip cancelled when showing active
          if (selStatus === 'cancelled' && !isCancelled) return false; // Skip non-cancelled when showing cancelled
          
          // HR, Admin Manager, and Managing Director can see all requests, others only see their own
          const canSee = (userRoleUpper === 'HR' || userRoleUpper === 'ADMIN MANAGER' || 
                         userRoleUpper === 'HUMAN RESOURCE OFFICER' || userRoleUpper === 'MANAGING DIRECTOR') || req.uid === user.uid;
          const matchesSearch = req.employeeName?.toLowerCase().includes(term.toLowerCase()) || req.type?.toLowerCase().includes(term.toLowerCase());
          const start = this.parseISODate(req.period.split(' to ')[0]);
          
          if (!start) return false; // Skip requests with invalid dates
          
          // Debug: Log each request's date info
          if (monthNum !== -1) {
            console.log('Request:', {
              period: req.period,
              parsedStart: start,
              startMonth: start.getMonth(),
              startYear: start.getFullYear(),
              selMonth: monthNum,
              selYear: yearNum,
              matchesMonth: start.getMonth() === monthNum && (yearNum === -1 || start.getFullYear() === yearNum)
            });
          }
          
          // Simplified filtering logic:
          // - If month is -1 (All), show all regardless of year
          // - If month is specific and year is -1 (All), show that month across all years
          // - If both are specific, show that exact month/year combination
          const matchesMonth = monthNum === -1 || 
            (start.getMonth() === monthNum && (yearNum === -1 || start.getFullYear() === yearNum));
          
          return canSee && matchesSearch && matchesMonth;
        });
        
        console.log('Filtered Requests:', filteredRequests.length);
        console.log('=== END FILTER DEBUG ===');
        
        return filteredRequests;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.paginatedRequests$ = combineLatest([this.allFilteredRequests$, this.currentPage$]).pipe(
      map(([reqs, page]) => reqs.slice((page - 1) * this.itemsPerPage, page * this.itemsPerPage)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }
  
  ngOnDestroy() {
    // Cleanup if needed
  }

  // Helper to parse ISO date strings (YYYY-MM-DD) correctly without timezone issues
  private parseISODate(dateString: string): Date | null {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month, day);
  }

  // --- RESTORED HELPER METHODS FOR HTML ---
  getFormattedPeriod(period: string): string {
    const diff = calculateWorkdays(period, this.holidayList);
    const start = this.parseISODate(period.split(' to ')[0]);
    if (!start) return 'Invalid date';
    return `${diff} ${diff === 1 ? 'Day' : 'Days'} (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  }

  getRelativeDate(d: any): string {
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    return date.toDateString() === yesterday.toDateString() ? 'Yesterday' : '';
  }

  async cancelRequest(req: any) {
    const { value: reason } = await import('sweetalert2').then(m => m.default.fire({
      title: '<div style="color: #1a5336; font-weight: 800; font-size: 24px; margin-bottom: 10px;">Cancel Request?</div>',
      html: '<div style="font-size: 15px; color: #64748b;">Please provide a reason for cancelling this leave request.<br><span style="font-size: 12px; color: #94a3b8;">(This will be recorded for documentation)</span></div>',
      icon: 'warning',
      input: 'text',
      inputPlaceholder: 'Enter cancellation reason...',
      inputValidator: (value: string) => {
        return !value.trim() ? 'Please enter a reason for cancellation' : null;
      },
      showCancelButton: true,
      confirmButtonText: 'Yes, Cancel Request',
      cancelButtonText: 'No, Keep It',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: 'swal-premium-popup',
        confirmButton: 'swal-confirm-danger',
        cancelButton: 'swal-cancel-outline',
        actions: 'swal-button-container'
      }
    }));

    if (reason) { // User provided a reason and clicked confirm
      try {
        const currentUser = await this.authService.currentUser$.pipe(take(1)).toPromise() as any;
        const cancelledBy = currentUser?.name || 'Employee';
        await this.leaveService.cancelRequest(req.id, cancelledBy, reason);
        import('sweetalert2').then(m => m.default.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Request cancelled',
          showConfirmButton: false,
          timer: 2000
        }));
      } catch (error) {
        import('sweetalert2').then(m => m.default.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: 'Failed to cancel request',
          showConfirmButton: false,
          timer: 2000
        }));
      }
    }
  }

  canCancel(req: any): boolean {
    // Can cancel if status is Pending or Awaiting HR Approval OR Awaiting Admin Manager Approval
    return req.status === 'Pending' || 
           req.status === 'Awaiting HR Approval' || 
           req.status === 'Awaiting Admin Manager Approval';
  }

  getSteps(req: any): string[] {
    const role = (req.role || '').toUpperCase();
    // Approval hierarchy based on user role:
    // - Part-Time: HR only (1 step)
    // - Operations Admin staff: Operations Admin Supervisor → HR
    // - Accounts staff: Account Supervisor → HR
    // - IT staff: Admin Manager → HR
    // - Operations Admin Supervisor: Admin Manager → HR
    // - Account Supervisor: Admin Manager → HR
    // - HR: Admin Manager (HR NOT reviewed again after Admin Manager approval)
    // - Admin Manager: HR
    
    // HR and Admin Manager (1 step each)
    if (role === 'HR' || role === 'HUMAN RESOURCE OFFICER') return ['Admin Manager'];
    if (role === 'ADMIN MANAGER') return ['HR'];
    
    // Part-time (1 step)
    if (role === 'PART-TIME') return ['HR'];
    
    // Supervisors (2 steps): Admin Manager → HR
    if (role === 'OPERATIONS ADMIN SUPERVISOR' || role === 'ACCOUNT SUPERVISOR') return ['Admin Manager', 'HR'];
    
    // IT staff (2 steps): Admin Manager → HR
    if (role === 'SENIOR IT DEVELOPER' || role === 'IT ASSISTANT' || role === 'IT DEVELOPER') return ['Admin Manager', 'HR'];
    
    // Operations Admin staff (2 steps): Ops Admin Supervisor → HR
    if (role === 'ADMIN OPERATION OFFICER' || role === 'ADMIN OPERATION ASSISTANT' || role === 'ADMIN COMPLIANCE OFFICER') return ['Ops Admin', 'HR'];
    
    // Accounts staff (2 steps): Account Supervisor → HR
    if (role === 'ACCOUNTING CLERK' || role === 'ACCOUNT RECEIVABLE SPECIALIST' || role === 'ACCOUNT PAYABLES SPECIALIST') return ['Acct Sup', 'HR'];
    
    return ['HR'];
  }
  
  // Abbreviate role names for display in the progress tracker
  abbreviateRole(role: string): string {
    const upper = role.toUpperCase();
    if (upper.includes('OPERATIONS ADMIN SUPERVISOR')) return 'Ops Admin';
    if (upper.includes('ACCOUNT SUPERVISOR')) return 'Acct Sup';
    if (upper.includes('ADMIN MANAGER')) return 'Admin Mgr';
    if (upper.includes('HUMAN RESOURCE') || upper === 'HR') return 'HR';
    return role;
  }

  getStepStatus(req: any, index: number): string {
    const status = req.status;
    const role = (req.role || '').toUpperCase();
    const steps = this.getSteps(req);
    
    // For Part-Time employees (1 step): HR only
    if (role === 'PART-TIME') {
      if (index === 0) {
        if (status === 'Approved') return 'completed';
        if (status.includes('Rejected')) return 'rejected';
        return 'pending';
      }
    }
    
    // For Operations Admin staff (2 steps): Ops Admin Supervisor → HR
    if (role === 'ADMIN OPERATION OFFICER' || role === 'ADMIN OPERATION ASSISTANT' || role === 'ADMIN COMPLIANCE OFFICER') {
      if (index === 0) {
        // First step (Ops Admin Supervisor): completed when Approved, Awaiting HR Approval, or Rejected by HR
        // Awaiting HR Approval means Ops Admin Supervisor already approved
        // Rejected by HR means Ops Admin Supervisor already approved (HR rejected later)
        if (status === 'Approved' || status === 'Awaiting HR Approval' || 
            (status.includes('Rejected') && (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER')))) return 'completed';
        // Rejected by Ops Admin Supervisor (not HR)
        if (status === 'Rejected' && !status.includes('HR') && !status.includes('HUMAN RESOURCE OFFICER')) return 'rejected';
        return 'pending';
      }
      if (index === 1) {
        // Second step (HR): completed only when status is Approved (final)
        // Pending when awaiting HR approval
        if (status === 'Approved') return 'completed';
        // Rejected by HR specifically
        if (status.includes('Rejected') && (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER'))) return 'rejected';
        return status === 'Awaiting HR Approval' ? 'pending' : '';
      }
    }
    
    // For Accounts staff (2 steps): Account Supervisor → HR
    if (role === 'ACCOUNTING CLERK' || role === 'ACCOUNT RECEIVABLE SPECIALIST' || role === 'ACCOUNT PAYABLES SPECIALIST') {
      if (index === 0) {
        // First step (Account Supervisor): completed when Approved, Awaiting HR Approval, or Rejected by HR
        // Awaiting HR Approval means Account Supervisor already approved
        // Rejected by HR means Account Supervisor already approved (HR rejected later)
        if (status === 'Approved' || status === 'Awaiting HR Approval' || 
            (status.includes('Rejected') && (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER')))) return 'completed';
        // Rejected by Account Supervisor (not HR)
        if (status === 'Rejected' && !status.includes('HR') && !status.includes('HUMAN RESOURCE OFFICER')) return 'rejected';
        return 'pending';
      }
      if (index === 1) {
        // Second step (HR): completed only when status is Approved (final)
        if (status === 'Approved') return 'completed';
        // Rejected by HR specifically
        if (status.includes('Rejected') && (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER'))) return 'rejected';
        return status === 'Awaiting HR Approval' ? 'pending' : '';
      }
    }
    
    // For Supervisors / IT Dev (2 steps): Admin Manager → HR
    if (role === 'OPERATIONS ADMIN SUPERVISOR' || role === 'ACCOUNT SUPERVISOR' || 
        role === 'SENIOR IT DEVELOPER' || role === 'IT ASSISTANT' || role === 'IT DEVELOPER') {
      if (index === 0) {
        // First step (Admin Manager): completed when Approved, Awaiting HR Approval, or Rejected by HR
        // Awaiting HR Approval means Admin Manager already approved
        // Rejected by HR means Admin Manager already approved (HR rejected later)
        if (status === 'Approved' || status === 'Awaiting HR Approval' || 
            (status.includes('Rejected') && (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER')))) return 'completed';
        // Rejected by Admin Manager (not HR)
        if (status.includes('Rejected') && !status.includes('HR') && !status.includes('HUMAN RESOURCE OFFICER')) return 'rejected';
        return 'pending';
      }
      if (index === 1) {
        // Second step (HR): completed only when status is Approved (final)
        if (status === 'Approved') return 'completed';
        // Rejected by HR specifically
        if (status.includes('Rejected') && (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER'))) return 'rejected';
        return status === 'Awaiting HR Approval' ? 'pending' : '';
      }
    }
    
    // For HR (1 step): Admin Manager only (HR NOT reviewed again after Admin Manager approval)
    if (role === 'HR' || role === 'HUMAN RESOURCE OFFICER') {
      if (index === 0) {
        // HR requests: Admin Manager approves, then it's done (no second HR review)
        // Status after Admin Manager approval: 'Awaiting HR Approval' (misleading name but means approved)
        if (status === 'Approved' || status === 'Awaiting HR Approval') return 'completed';
        if (status.includes('Rejected')) return 'rejected';
        return 'pending';
      }
    }
    
    // For Admin Manager (1 step): HR
    if (role === 'ADMIN MANAGER') {
      if (index === 0) {
        // Admin Manager requests go to HR for approval
        if (status === 'Approved') return 'completed';
        if (status.includes('Rejected')) return 'rejected';
        return 'pending';
      }
    }
    
    return '';
  }

  getStepIcon(req: any, index: number): string {
    const stat = this.getStepStatus(req, index);
    if (stat === 'completed') return '✓';
    if (stat === 'rejected') return '✕';
    return '...';
  }

  // Check if request is cancelled
  isCancelled(req: any): boolean {
    return req.status === 'Cancelled';
  }

  // Get cancellation info display text
  getCancellationInfo(req: any): string {
    if (!this.isCancelled(req)) return '';
    const cancelledBy = req.cancelledBy || 'Employee';
    const date = req.dateCancelled ? new Date(req.dateCancelled).toLocaleDateString() : '';
    return `Cancelled by ${cancelledBy}${date ? ' on ' + date : ''}`;
  }

  // Get the last step that was approved before cancellation
  getLastApprovedStep(req: any): string {
    if (!this.isCancelled(req)) return '';
    const status = req.status;
    const targetReviewer = req.targetReviewer || '';
    const previousStatus = req.previousStatus || '';
    const previousTargetReviewer = req.previousTargetReviewer || '';
    
    // First check previous fields (newer cancelled requests)
    if (previousTargetReviewer || previousStatus) {
      if (previousTargetReviewer === 'HR' || previousStatus === 'Awaiting HR Approval') {
        return 'Last at: HR Review (approved by Ops Admin)';
      }
      if (previousTargetReviewer === 'Admin Manager' || previousStatus === 'Awaiting Admin Manager Approval') {
        return 'Last at: Admin Manager Review';
      }
    }
    
    // Fallback: check current/remaining fields (older cancelled requests)
    // If it was awaiting HR approval
    if (targetReviewer === 'HR' || status === 'Awaiting HR Approval') {
      return 'Last at: HR Review (approved by Ops Admin)';
    }
    // If it was at Admin Manager step
    if (targetReviewer === 'Admin Manager' || status === 'Awaiting Admin Manager Approval') {
      return 'Last at: Admin Manager Review';
    }
    // If it was pending at Ops Admin
    if (status === 'Pending' || targetReviewer === 'Ops Admin' || 
        targetReviewer === 'Operations Admin Supervisor' || targetReviewer === 'Operations Admin') {
      return 'Last at: Pending (not yet reviewed)';
    }
    // If approved (final status before cancelled)
    if (status === 'Approved') {
      return 'Last at: Fully Approved';
    }
    return '';
  }

  // Get cancellation reason
  getCancellationReason(req: any): string {
    if (!this.isCancelled(req)) return '';
    return req.cancellationReason || 'No reason provided';
  }

  getStartRange(total: number) { return total === 0 ? 0 : (this.currentPageSubject.value - 1) * this.itemsPerPage + 1; }
  getEndRange(total: number) { return Math.min(this.currentPageSubject.value * this.itemsPerPage, total); }
  getTotalPages(total: number) { return Math.ceil(total / this.itemsPerPage) || 1; }
  
  onItemsPerPageChange(e: any) { 
    this.itemsPerPage = +e.target.value; 
    this.currentPageSubject.next(1); 
  }
  
  prevPage() { if (this.currentPageSubject.value > 1) this.currentPageSubject.next(this.currentPageSubject.value - 1); }
  nextPage(total: number) { if (this.currentPageSubject.value < this.getTotalPages(total)) this.currentPageSubject.next(this.currentPageSubject.value + 1); }
  
  getLeaveIcon(t: string) { 
    if (t.includes('Sick')) return '🤒';
    if (t.includes('Birthday')) return '🎂';
    if (t.includes('Without Pay')) return '⏰';
    if (t.includes('Maternity')) return '🤱';
    if (t.includes('Paternity')) return '👶';
    return '💰'; 
  }
  toggleReason(r: any) { this.expandedReq = this.expandedReq === r ? null : r; }
  // Toggle cancellation reason expansion using request ID
  toggleCancellationReason(req: any) {
    const reqId = req.id || req.$id;
    if (this.expandedCancellationReason === reqId) {
      this.expandedCancellationReason = null;
    } else {
      this.expandedCancellationReason = reqId;
    }
  }
  viewDocument(att: any) { window.open()?.document.write(`<iframe src="${att.data}" style="width:100%;height:100%;"></iframe>`); }
  
  // Reset all filters to default values
  resetFilters(): void {
    this.searchControl.setValue('');
    this.monthControl.setValue(-1);
    this.yearControl.setValue(-1);
    this.statusControl.setValue('all');
    this.currentPageSubject.next(1);
  }
  
  // Check if any filter is active
  hasActiveFilters(): boolean {
    return this.searchControl.value !== '' || 
           this.monthControl.value !== -1 || 
           this.yearControl.value !== -1 ||
           this.statusControl.value !== 'all';
  }
}
