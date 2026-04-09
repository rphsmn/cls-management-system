import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import {
  Observable,
  combineLatest,
  BehaviorSubject,
  startWith,
  map,
  tap,
  debounceTime,
  shareReplay,
  Subscription,
  take,
} from 'rxjs';
import { AuthService, User } from '../../../core/services/auth';
import { LeaveService } from '../../../core/services/leave.services';
import { HolidayService } from '../../../core/services/holiday.service';
import { calculateWorkdays } from '../../../core/utils/workday-calculator.util';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css',
})
export class HistoryComponent implements OnDestroy {
  private authService = inject(AuthService);
  private leaveService = inject(LeaveService);
  private holidayService = inject(HolidayService);

  currentUser$ = this.authService.currentUser$;
  allFilteredRequests$: Observable<any[]>;
  paginatedRequests$: Observable<any[]>;

  itemsPerPage = 10;
  private currentPageSubject = new BehaviorSubject<number>(1);
  currentPage$ = this.currentPageSubject.asObservable();

  // Pre-compute holidays from HolidayService
  private holidayList: any[] = [];

  searchControl = new FormControl('', { nonNullable: true });
  monthControl = new FormControl(-1, { nonNullable: true }); // Default to 'All' months
  yearControl = new FormControl(-1, { nonNullable: true }); // Default to 'All' years
  statusControl = new FormControl('all', { nonNullable: true }); // Filter by status: all, active, cancelled

  statusOptions = [
    { v: 'all', l: 'All Requests' },
    { v: 'active', l: 'Active' },
    { v: 'cancelled', l: 'Cancelled' },
  ];

  months = [
    { v: -1, l: 'All Months' },
    { v: 0, l: 'Jan' },
    { v: 1, l: 'Feb' },
    { v: 2, l: 'Mar' },
    { v: 3, l: 'Apr' },
    { v: 4, l: 'May' },
    { v: 5, l: 'Jun' },
    { v: 6, l: 'Jul' },
    { v: 7, l: 'Aug' },
    { v: 8, l: 'Sep' },
    { v: 9, l: 'Oct' },
    { v: 10, l: 'Nov' },
    { v: 11, l: 'Dec' },
  ];
  years: number[] = [-1]; // Will be populated dynamically from leave data
  expandedReq: any = null;
  expandedCancellationReason: any = null;

  constructor() {
    // Subscribe to HolidayService
    this.holidayService.holidays$.subscribe(holidays => {
      this.holidayList = holidays;
    });

    this.allFilteredRequests$ = combineLatest([
      this.authService.currentUser$,
      this.leaveService.requests$,
      this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(200),
        tap(() => this.currentPageSubject.next(1)),
      ),
      this.monthControl.valueChanges.pipe(
        startWith(this.monthControl.value),
        debounceTime(200),
        tap(() => this.currentPageSubject.next(1)),
      ),
      this.yearControl.valueChanges.pipe(
        startWith(this.yearControl.value),
        debounceTime(200),
        tap(() => this.currentPageSubject.next(1)),
      ),
      this.statusControl.valueChanges.pipe(
        startWith(this.statusControl.value),
        debounceTime(200),
        tap(() => this.currentPageSubject.next(1)),
      ),
    ]).pipe(
      map(([user, requests, term, selMonth, selYear, selStatus]) => {
        if (!user || !requests) return [];

        // Convert string values to numbers (HTML select returns strings)
        const monthNum = typeof selMonth === 'string' ? parseInt(selMonth, 10) : selMonth;
        const yearNum = typeof selYear === 'string' ? parseInt(selYear, 10) : selYear;

        // Dynamically generate years from leave data
        const yearSet = new Set<number>();
        requests.forEach((req) => {
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

        const userRoleUpper = user.role.toUpperCase();
        const filteredRequests = requests.filter((req) => {
          if (!req.period) return false; // Skip requests without period

          // Status filter logic
          const isCancelled = req.status === 'Cancelled';
          if (selStatus === 'active' && isCancelled) return false; // Skip cancelled when showing active
          if (selStatus === 'cancelled' && !isCancelled) return false; // Skip non-cancelled when showing cancelled

          // HR, Admin Manager, and Managing Director can see all requests, others only see their own
          // Use both uid and employeeName fallback (for employees who don't have uid stored in users collection)
          const canSee =
            userRoleUpper === 'HR' ||
            userRoleUpper === 'ADMIN MANAGER' ||
            userRoleUpper === 'HUMAN RESOURCE OFFICER' ||
            userRoleUpper === 'MANAGING DIRECTOR' ||
            req.uid === user.uid ||
            req.employeeName === user.name;
          const matchesSearch =
            req.employeeName?.toLowerCase().includes(term.toLowerCase()) ||
            req.type?.toLowerCase().includes(term.toLowerCase());
          const start = this.parseISODate(req.period.split(' to ')[0]);

          if (!start) return false; // Skip requests with invalid dates

          // Simplified filtering logic:
          // - If month is -1 (All), show all regardless of year
          // - If month is specific and year is -1 (All), show that month across all years
          // - If both are specific, show that exact month/year combination
          const matchesMonth =
            monthNum === -1 ||
            (start.getMonth() === monthNum && (yearNum === -1 || start.getFullYear() === yearNum));

          return canSee && matchesSearch && matchesMonth;
        });

        return filteredRequests;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.paginatedRequests$ = combineLatest([this.allFilteredRequests$, this.currentPage$]).pipe(
      map(([reqs, page]) => reqs.slice((page - 1) * this.itemsPerPage, page * this.itemsPerPage)),
      shareReplay({ bufferSize: 1, refCount: true }),
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
  getFormattedPeriod(req: any): string {
    // Use daysDeducted for half-day support (0.5 or 1.0), otherwise use calculateWorkdays
    let diff: number;
    if (req.daysDeducted !== undefined && req.daysDeducted !== null) {
      diff = req.daysDeducted;
    } else if (req.noOfDays) {
      diff = req.noOfDays;
    } else {
      diff = calculateWorkdays(req.period, this.holidayList);
    }
    const start = this.parseISODate(req.period.split(' to ')[0]);
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
    const { value: reason } = await import('sweetalert2').then((m) =>
      m.default.fire({
        title:
          '<div style="color: #1a5336; font-weight: 800; font-size: 24px; margin-bottom: 10px;">Cancel Request?</div>',
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
          actions: 'swal-button-container',
        },
      }),
    );

    if (reason) {
      // User provided a reason and clicked confirm
      try {
        const currentUser = (await this.authService.currentUser$.pipe(take(1)).toPromise()) as any;
        const cancelledBy = currentUser?.name || 'Employee';
        await this.leaveService.cancelRequest(req.id, cancelledBy, reason);
        import('sweetalert2').then((m) =>
          m.default.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Request cancelled',
            showConfirmButton: false,
            timer: 2000,
          }),
        );
      } catch (error) {
        import('sweetalert2').then((m) =>
          m.default.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Failed to cancel request',
            showConfirmButton: false,
            timer: 2000,
          }),
        );
      }
    }
  }

  canCancel(req: any): boolean {
    // Can cancel if status is Pending or Awaiting HR Approval OR Awaiting Admin Manager Approval
    return (
      req.status === 'Pending' ||
      req.status === 'Awaiting HR Approval' ||
      req.status === 'Awaiting Admin Manager Approval'
    );
  }

  private getRoleCategory(role: string): string {
    const upper = role.toUpperCase();
    if (upper === 'HR' || upper === 'HUMAN RESOURCE OFFICER') return 'hr';
    if (upper === 'ADMIN MANAGER') return 'admin-manager';
    if (upper === 'PART-TIME') return 'part-time';
    if (upper === 'OPERATIONS ADMIN SUPERVISOR' || upper === 'ACCOUNT SUPERVISOR') return 'supervisor';
    if (upper === 'SENIOR IT DEVELOPER' || upper === 'IT ASSISTANT' || upper === 'IT DEVELOPER') return 'it';
    if (upper === 'ADMIN OPERATION OFFICER' || upper === 'ADMIN OPERATION ASSISTANT' || upper === 'ADMIN COMPLIANCE OFFICER') return 'ops-admin';
    if (upper === 'ACCOUNTING CLERK' || upper === 'ACCOUNT RECEIVABLE SPECIALIST' || upper === 'ACCOUNT PAYABLES SPECIALIST') return 'accounts';
    return 'default';
  }

  getSteps(req: any): string[] {
    const role = (req.role || '').toUpperCase();
    const category = this.getRoleCategory(role);
    
    switch (category) {
      case 'hr':
        return ['Admin Manager'];
      case 'admin-manager':
        return ['HR'];
      case 'part-time':
        return ['HR'];
      case 'supervisor':
      case 'it':
        return ['Admin Manager', 'HR'];
      case 'ops-admin':
        return ['Ops Admin', 'HR'];
      case 'accounts':
        return ['Acct Sup', 'HR'];
      default:
        return ['HR'];
    }
  }

  abbreviateRole(role: string): string {
    const upper = role.toUpperCase();
    if (upper.includes('OPERATIONS ADMIN SUPERVISOR')) return 'Ops Admin';
    if (upper.includes('ACCOUNT SUPERVISOR')) return 'Acct Sup';
    if (upper.includes('ADMIN MANAGER')) return 'Admin Mgr';
    if (upper.includes('HUMAN RESOURCE') || upper === 'HR') return 'HR';
    return role;
  }

  private getStepCompletedStatus(req: any, role: string): string {
    const status = req.status;
    if (status === 'Approved' || status === 'Awaiting HR Approval') return 'completed';
    if (status.includes('Rejected') && (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER'))) return 'rejected';
    if (status === 'Rejected' && !status.includes('HR') && !status.includes('HUMAN RESOURCE OFFICER')) return 'rejected';
    return 'pending';
  }

  getStepStatus(req: any, index: number): string {
    const status = req.status;
    const role = (req.role || '').toUpperCase();
    const category = this.getRoleCategory(role);
    const isFirstStep = index === 0;
    const isSecondStep = index === 1;
    
    if (category === 'hr' || category === 'admin-manager' || category === 'part-time') {
      if (status === 'Approved' || status === 'Awaiting HR Approval') return 'completed';
      if (status.includes('Rejected')) return 'rejected';
      return 'pending';
    }

    if ((category === 'supervisor' || category === 'it') && isFirstStep) {
      return this.getStepCompletedStatus(req, role);
    }

    if ((category === 'supervisor' || category === 'it') && isSecondStep) {
      if (status === 'Approved') return 'completed';
      if (status.includes('Rejected') && (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER'))) return 'rejected';
      return status === 'Awaiting HR Approval' ? 'pending' : '';
    }

    if ((category === 'ops-admin' || category === 'accounts') && isFirstStep) {
      return this.getStepCompletedStatus(req, role);
    }

    if ((category === 'ops-admin' || category === 'accounts') && isSecondStep) {
      if (status === 'Approved') return 'completed';
      if (status.includes('Rejected') && (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER'))) return 'rejected';
      return status === 'Awaiting HR Approval' ? 'pending' : '';
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
      if (
        previousTargetReviewer === 'Admin Manager' ||
        previousStatus === 'Awaiting Admin Manager Approval'
      ) {
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
    if (
      status === 'Pending' ||
      targetReviewer === 'Ops Admin' ||
      targetReviewer === 'Operations Admin Supervisor' ||
      targetReviewer === 'Operations Admin'
    ) {
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

  getStartRange(total: number) {
    return total === 0 ? 0 : (this.currentPageSubject.value - 1) * this.itemsPerPage + 1;
  }
  getEndRange(total: number) {
    return Math.min(this.currentPageSubject.value * this.itemsPerPage, total);
  }
  getTotalPages(total: number) {
    return Math.ceil(total / this.itemsPerPage) || 1;
  }

  onItemsPerPageChange(e: any) {
    this.itemsPerPage = +e.target.value;
    this.currentPageSubject.next(1);
  }

  prevPage() {
    if (this.currentPageSubject.value > 1)
      this.currentPageSubject.next(this.currentPageSubject.value - 1);
  }
  nextPage(total: number) {
    if (this.currentPageSubject.value < this.getTotalPages(total))
      this.currentPageSubject.next(this.currentPageSubject.value + 1);
  }

  getLeaveIcon(t: string) {
    if (t.includes('Sick')) return '🤒';
    if (t.includes('Birthday')) return '🎂';
    if (t.includes('Without Pay')) return '⏰';
    if (t.includes('Maternity')) return '🤱';
    if (t.includes('Paternity')) return '👶';
    return '💰';
  }
  toggleReason(r: any) {
    this.expandedReq = this.expandedReq === r ? null : r;
  }
  // Toggle cancellation reason expansion using request ID
  toggleCancellationReason(req: any) {
    const reqId = req.id || req.$id;
    if (this.expandedCancellationReason === reqId) {
      this.expandedCancellationReason = null;
    } else {
      this.expandedCancellationReason = reqId;
    }
  }
  viewDocument(att: any) {
    window
      .open()
      ?.document.write(`<iframe src="${att.data}" style="width:100%;height:100%;"></iframe>`);
  }

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
    return (
      this.searchControl.value !== '' ||
      this.monthControl.value !== -1 ||
      this.yearControl.value !== -1 ||
      this.statusControl.value !== 'all'
    );
  }

  exportToCSV() {
    this.allFilteredRequests$.pipe(take(1)).subscribe(requests => {
      if (requests.length === 0) {
        return;
      }

      const headers = ['Employee', 'Employee ID', 'Leave Type', 'Period', 'Days', 'Status', 'Date Filed', 'Reason'];
      const rows = requests.map(req => [
        req.employeeName || '',
        req.employeeId || '',
        req.type || '',
        req.period || '',
        req.daysDeducted || req.noOfDays || '1',
        req.status || '',
        req.dateFiled ? new Date(req.dateFiled).toLocaleDateString() : '',
        (req.reason || '').replace(/,/g, ';')
      ]);

      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `leave-history-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }
}
