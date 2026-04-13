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
import { AuditService } from '../../../core/services/audit.service';
import { NotificationService } from '../../../core/services/notification.service';
import { calculateWorkdays } from '../../../core/utils/workday-calculator.util';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
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
  private auditService = inject(AuditService);
  private notificationService = inject(NotificationService);
  private firestore = inject(Firestore);

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
  selectedEmployee: any = null;
  selectedEmployeeLoading = false;

  constructor() {
    // Subscribe to HolidayService
    this.holidayService.holidays$.subscribe((holidays) => {
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

  async viewEmployeeProfile(req: any) {
    if (!req.uid) return;

    this.selectedEmployeeLoading = true;
    this.selectedEmployee = null;

    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', req.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();

        const joinDate = userData['joinedDate']?.toDate
          ? userData['joinedDate'].toDate()
          : new Date(userData['joinedDate']);
        const today = new Date();
        const yearsOfService =
          (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

        this.selectedEmployee = {
          ...userData,
          dept: userData['dept'] || 'N/A',
          joinedDate: userData['joinedDate'],
          yearsOfService:
            yearsOfService >= 1
              ? `${Math.floor(yearsOfService)} year(s) ${Math.round((yearsOfService % 1) * 12)} month(s)`
              : 'Less than 1 year',
        };
      }
    } catch (error) {
      console.error('Error fetching employee profile:', error);
    } finally {
      this.selectedEmployeeLoading = false;
    }
  }

  closeEmployeeProfile() {
    this.selectedEmployee = null;
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

  private getNotificationTargets(employeeRole: string): string[] {
    const r = employeeRole.toUpperCase();
    if (r.includes('DEVELOPER')) return ['MANAGER', 'HR', 'HUMAN RESOURCE'];
    if (r.includes('ACCOUNTS')) return ['ACCOUNT SUPERVISOR', 'HR'];
    return ['MANAGER', 'HR', 'HUMAN RESOURCE'];
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

        // Log to audit trail
        const leaveType = req.type || req.leaveType || 'Leave';
        await this.auditService.logAction(
          'leave_cancelled',
          `${currentUser?.name} cancelled ${leaveType} leave request`,
          {
            targetUserId: req.uid,
            targetUserName: req.employeeName,
            metadata: { requestId: req.id, reason, period: req.period },
          },
        );

        // Notify supervisors if different from the employee
        if (currentUser?.uid !== req.uid) {
          const targets = this.getNotificationTargets(currentUser?.role || '');
          for (const role of targets) {
            await this.notificationService.createNotification(
              'leave_cancelled',
              'Leave Cancelled',
              `${currentUser?.name} cancelled ${leaveType} leave (${req.period})`,
              currentUser?.name || 'Unknown',
              currentUser?.uid || '',
              role,
            );
          }
        }

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
    // Only the employee who filed the request can cancel it
    const currentUser = this.authService.currentUser;
    if (!currentUser) return false;

    // Check if current user is the one who filed the request
    const isOwner = req.uid === currentUser.uid || req.employeeId === currentUser.employeeId;
    if (!isOwner) return false;

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
    if (upper === 'OPERATIONS ADMIN SUPERVISOR' || upper === 'ACCOUNT SUPERVISOR')
      return 'supervisor';
    if (upper === 'SENIOR IT DEVELOPER' || upper === 'IT ASSISTANT' || upper === 'IT DEVELOPER')
      return 'it';
    if (
      upper === 'ADMIN OPERATION OFFICER' ||
      upper === 'ADMIN OPERATION ASSISTANT' ||
      upper === 'ADMIN COMPLIANCE OFFICER'
    )
      return 'ops-admin';
    if (
      upper === 'ACCOUNTING CLERK' ||
      upper === 'ACCOUNT RECEIVABLE SPECIALIST' ||
      upper === 'ACCOUNT PAYABLES SPECIALIST'
    )
      return 'accounts';
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
    if (
      status.includes('Rejected') &&
      (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER'))
    )
      return 'rejected';
    if (
      status === 'Rejected' &&
      !status.includes('HR') &&
      !status.includes('HUMAN RESOURCE OFFICER')
    )
      return 'rejected';
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
      if (
        status.includes('Rejected') &&
        (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER'))
      )
        return 'rejected';
      return status === 'Awaiting HR Approval' ? 'pending' : '';
    }

    if ((category === 'ops-admin' || category === 'accounts') && isFirstStep) {
      return this.getStepCompletedStatus(req, role);
    }

    if ((category === 'ops-admin' || category === 'accounts') && isSecondStep) {
      if (status === 'Approved') return 'completed';
      if (
        status.includes('Rejected') &&
        (status.includes('HR') || status.includes('HUMAN RESOURCE OFFICER'))
      )
        return 'rejected';
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
    this.allFilteredRequests$.pipe(take(1)).subscribe({
      next: (requests) => {
        if (requests.length === 0) {
          return;
        }

        const formatDate = (dateStr: string | undefined): string => {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return '';
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          });
        };

        const parsePeriod = (period: string | undefined) => {
          if (!period) return { startDate: '', endDate: '' };
          const parts = period.split(' to ');
          return {
            startDate: parts[0]?.trim() || '',
            endDate: parts[1]?.trim() || parts[0]?.trim() || '',
          };
        };

        const sortedRequests = [...requests].sort((a, b) => {
          const aPeriod = parsePeriod(a.period);
          const bPeriod = parsePeriod(b.period);
          const dateA = new Date(aPeriod.startDate).getTime();
          const dateB = new Date(bPeriod.startDate).getTime();
          return dateB - dateA;
        });

        const escapeHtml = (value: any): string => {
          const str = value == null ? '' : String(value);
          return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        };

        const getStatusStyle = (status: string): { bg: string; color: string; cellBg: string } => {
          const s = status?.toLowerCase() || '';
          if (s.includes('approved')) return { bg: '#dcfce7', color: '#166534', cellBg: '#ecfdf5' };
          if (s.includes('rejected')) return { bg: '#fef2f2', color: '#dc2626', cellBg: '#fef2f2' };
          if (s.includes('pending')) return { bg: '#fef9c3', color: '#854d0e', cellBg: '#fefce8' };
          return { bg: '#f1f5f9', color: '#475569', cellBg: '#ffffff' };
        };

        const approvedCount = sortedRequests.filter((r) =>
          r.status?.toLowerCase().includes('approved'),
        ).length;
        const pendingCount = sortedRequests.filter((r) =>
          r.status?.toLowerCase().includes('pending'),
        ).length;
        const totalDays = sortedRequests.reduce(
          (sum, req) => sum + Number(req.daysDeducted ?? req.noOfDays ?? 1),
          0,
        );

        const headers = [
          'Employee Name',
          'Employee ID',
          'Leave Type',
          'Start Date',
          'End Date',
          'Days',
          'Status',
          'Date Filed',
          'Reason',
        ];
        const colWidths = [
          '220px',
          '140px',
          '160px',
          '130px',
          '130px',
          '80px',
          '120px',
          '130px',
          '250px',
        ];

        const headerRow = headers
          .map((h, i) => {
            const align =
              i === 1 || i === 5 || i === 6 ? 'center' : i >= 3 && i <= 7 ? 'right' : 'left';
            return `<th style="background: #2D5A27; color: white; padding: 12px; text-align: ${align}; font-weight: 700; font-size: 12px; border: 1px solid #1a5336; font-family: 'Segoe UI', sans-serif; white-space: nowrap; width: ${colWidths[i]};">${h}</th>`;
          })
          .join('');

        const dataRows = sortedRequests
          .map((req, index) => {
            const period = parsePeriod(req.period);
            const days = req.daysDeducted ?? req.noOfDays ?? 1;
            const reason = req.reason?.trim() || 'N/A';
            const dateFiled = req.dateFiled ? formatDate(req.dateFiled) : '';
            const statusStyle = getStatusStyle(req.status || '');
            const zebraBg = index % 2 === 0 ? '#ffffff' : '#f9f9f9';

            return `
            <tr style="background: ${zebraBg};">
              <td style="padding: 12px; color: #1e293b; font-weight: 600; font-size: 12px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; text-align: left; width: 220px;">${escapeHtml(req.employeeName || '')}</td>
              <td style="padding: 12px; color: #64748b; font-size: 11px; border: 1px solid #e2e8f0; font-family: 'Consolas', monospace; text-align: center; width: 140px;">${escapeHtml(req.employeeId || '')}</td>
              <td style="padding: 12px; color: #166534; font-weight: 600; font-size: 11px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; text-align: left; width: 160px;">${escapeHtml(req.type || '')}</td>
              <td style="padding: 12px; color: #1e293b; font-size: 11px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; text-align: right; width: 130px;">${formatDate(period.startDate)}</td>
              <td style="padding: 12px; color: #1e293b; font-size: 11px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; text-align: right; width: 130px;">${formatDate(period.endDate)}</td>
              <td style="padding: 12px; color: #1e293b; font-weight: 700; font-size: 12px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; text-align: center; width: 80px;">${String(days)}</td>
              <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: center; width: 120px; background: ${statusStyle.cellBg};"><span style="background: ${statusStyle.bg}; color: ${statusStyle.color}; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 10px; font-family: 'Segoe UI', sans-serif; display: inline-block;">${escapeHtml(req.status || '')}</span></td>
              <td style="padding: 12px; color: #64748b; font-size: 11px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; text-align: right; width: 130px;">${dateFiled}</td>
              <td style="padding: 12px; color: #475569; font-size: 11px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; text-align: left; width: 250px;">${escapeHtml(reason)}</td>
            </tr>
          `;
          })
          .join('');

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Leave History Report</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc;">
    <div style="max-width: 100%; margin: 0 auto;">
      
      <!-- HEADER SECTION -->
      <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
        <tr>
          <td style="background: #2D5A27; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <p style="color: rgba(255,255,255,0.7); font-size: 11px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Company Report</p>
            <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 800; font-family: 'Segoe UI', sans-serif;">Leave History Report</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0 0; font-size: 13px;">Cor Logic Solutions Inc.</p>
          </td>
          <td style="background: #2D5A27; padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: right;">
            <p style="color: rgba(255,255,255,0.9); font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">Generated On</p>
            <p style="color: white; font-size: 14px; margin: 0; font-weight: 700;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </td>
        </tr>
      </table>
      
      <!-- SUMMARY & LEGEND ROW -->
      <table style="width: 100%; border-collapse: collapse; background: white; table-layout: fixed;">
        <tr>
          <!-- Summary -->
          <td style="vertical-align: top; padding: 20px; border-right: 1px solid #e2e8f0; width: 360px;">
            <p style="color: #2D5A27; font-size: 11px; font-weight: 700; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #2D5A27; padding-bottom: 8px;">Summary</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr><td style="padding: 6px 0; color: #64748b;">Total Records</td><td style="padding: 6px 0; color: #1e293b; font-weight: 600; text-align: right;">${sortedRequests.length}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Total Days</td><td style="padding: 6px 0; color: #2D5A27; font-weight: 700; font-size: 14px; text-align: right;">${totalDays}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Approved</td><td style="padding: 6px 0; color: #166534; font-weight: 700; text-align: right;">${approvedCount}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Pending</td><td style="padding: 6px 0; color: #854d0e; font-weight: 700; text-align: right;">${pendingCount}</td></tr>
            </table>
          </td>
          
          <!-- Status Legend -->
          <td style="vertical-align: top; padding: 20px; width: 290px;">
            <p style="color: #2D5A27; font-size: 11px; font-weight: 700; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #2D5A27; padding-bottom: 8px;">Status Legend</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0;"><span style="background: #ecfdf5; color: #166534; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #dcfce7;">Approved</span></td></tr>
              <tr><td style="padding: 6px 0;"><span style="background: #fefce8; color: #854d0e; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #fef9c3;">Pending</span></td></tr>
              <tr><td style="padding: 6px 0;"><span style="background: #fef2f2; color: #dc2626; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #fee2e2;">Rejected</span></td></tr>
            </table>
          </td>
        </tr>
      </table>
      
      <!-- COLUMN KEY ROW -->
      <table style="width: 100%; border-collapse: collapse; background: #f1f5f9; table-layout: fixed;">
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px; font-weight: 700; width: 220px;">Employee Name</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px; font-weight: 700; width: 140px;">Employee ID</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px; font-weight: 700; width: 160px;">Leave Type</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px; font-weight: 700; width: 130px; text-align: right;">Start Date</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px; font-weight: 700; width: 130px; text-align: right;">End Date</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px; font-weight: 700; width: 80px; text-align: center;">Days</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px; font-weight: 700; width: 120px; text-align: center;">Status</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px; font-weight: 700; width: 130px; text-align: right;">Date Filed</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px; font-weight: 700; width: 250px;">Reason</td>
        </tr>
      </table>
      
      <!-- TABLE DATA -->
      <table style="width: 100%; border-collapse: collapse; background: white; table-layout: fixed;">
        <thead>
          <tr>${headerRow}</tr>
        </thead>
        <tbody>
          ${dataRows}
          <tr style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);">
            <td style="padding: 12px; text-align: right; font-weight: 700; color: #1a5336; font-size: 12px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; width: 220px;"></td>
            <td style="padding: 12px; text-align: center; font-weight: 700; color: #1a5336; font-size: 12px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; width: 140px;"></td>
            <td style="padding: 12px; text-align: left; font-weight: 700; color: #1a5336; font-size: 12px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; width: 160px;">TOTAL</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #e2e8f0; width: 130px;"></td>
            <td style="padding: 12px; text-align: right; border: 1px solid #e2e8f0; width: 130px;"></td>
            <td style="padding: 12px; text-align: center; font-weight: 800; color: #1a5336; font-size: 14px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; background: #dcfce7; border-bottom: 3px double #1a5336; width: 80px;">${totalDays}</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: center; width: 120px;"></td>
            <td style="padding: 12px; text-align: right; border: 1px solid #e2e8f0; width: 130px;"></td>
            <td style="padding: 12px; text-align: left; border: 1px solid #e2e8f0; width: 250px;"></td>
          </tr>
        </tbody>
      </table>
      
      <!-- Footer -->
      <div style="background: #f1f5f9; padding: 16px 32px; border-radius: 0 0 12px 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="color: #1a5336; font-size: 13px; font-weight: 700;">Cor Logic Solutions Inc.</span>
          <span style="color: #64748b; font-size: 12px; margin-left: 8px;">| Leave Management System</span>
        </div>
        <span style="color: #94a3b8; font-size: 11px;">Total Records: ${sortedRequests.length}</span>
      </div>
      
      <!-- Disclaimer -->
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 10px; font-style: italic;">
        Confidential - For Internal Use Only | Cor Logic Solutions Inc.
      </div>
    </div>
  </body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `leave-history-${new Date().toISOString().split('T')[0]}.xls`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
    });
  }

  formatDepartment(dept: string | undefined): string {
    if (!dept) return 'N/A';
    const deptMap: Record<string, string> = {
      devs: 'DevOps',
      accounts: 'Accounts',
      manager: 'Manager',
      'operations-admin': 'Operations-Admin',
      'part-time': 'Part-time',
    };
    const normalized = dept.toLowerCase().trim();
    return deptMap[normalized] || dept;
  }
}
