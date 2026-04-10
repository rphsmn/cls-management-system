import {
  Component,
  inject,
  OnInit,
  ChangeDetectorRef,
  NgZone,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import {
  AuthService,
  calculatePaidTimeOff,
  hasCompletedOneYear,
  isPartTimeEmployee,
  canFilePaidLeave,
  canFileMaternityPaternity,
  canFileSickLeave,
  LEAVE_TYPES,
} from '../../../core/services/auth';
import { LeaveService } from '../../../core/services/leave.services';
import { HolidayService } from '../../../core/services/holiday.service';
import { calculateWorkdays } from '../../../core/utils/workday-calculator.util';
import { Observable, combineLatest, map, take, of } from 'rxjs';

@Component({
  selector: 'app-file-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './file-leave.html',
  styleUrls: ['./file-leave.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate(
          '0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          style({ transform: 'translateY(0)', opacity: 1 }),
        ),
      ]),
      transition(':leave', [
        animate('0.3s ease-in', style({ transform: 'translateY(-100%)', opacity: 0 })),
      ]),
    ]),
  ],
})
export class FileLeaveComponent implements OnInit {
  private authService = inject(AuthService);
  private leaveService = inject(LeaveService);
  private holidayService = inject(HolidayService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  // Expose LEAVE_TYPES to template
  LEAVE_TYPES = LEAVE_TYPES;

  private holidayList: any[] = [];

  holidaysInRange: string[] = [];

  liveCredits$: Observable<any>;
  minDate: string = new Date().toISOString().split('T')[0];
  totalDays: number = 0;
  isSubmitting: boolean = false;
  isOverBalance: boolean = false;
  isInsufficientNotice: boolean = false;
  isPostFiling: boolean = false;
  noticeRequired: number = 0;
  showSuccessToast = false;
  showErrorToast = false;
  errorMessage = '';
  successMessage = '';
  fileName = '';
  isHalfDay: boolean = false;

  // Dynamic min date - sick leave allows past dates
  get minDateAllowed(): string {
    if (this.leaveRequest.type === LEAVE_TYPES.SICK_LEAVE) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);
      return pastDate.toISOString().split('T')[0];
    }
    return this.minDate;
  }

  leaveRequest: {
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachment: any;
    isHalfDay?: boolean;
    daysDeducted?: number;
  } = {
    type: LEAVE_TYPES.PAID_TIME_OFF,
    startDate: '',
    endDate: '',
    reason: '',
    attachment: null,
    isHalfDay: false,
    daysDeducted: 1.0,
  };

  get canSubmit(): boolean {
    if (this.isSubmitting || this.totalDays <= 0) return false;
    const isSickLeave = this.leaveRequest.type === 'Sick Leave';
    const requiresAttachment = isSickLeave && this.totalDays >= 3;
    const hasAttachment = !!this.leaveRequest.attachment;
    if (requiresAttachment && !hasAttachment) return false;
    return true;
  }

  get submitDisabledReason(): string {
    const isSickLeave = this.leaveRequest.type === 'Sick Leave';
    const requiresAttachment = isSickLeave && this.totalDays >= 3;
    const hasAttachment = !!this.leaveRequest.attachment;
    if (requiresAttachment && !hasAttachment) {
      return 'Medical certificate required for 3+ days sick leave';
    }
    return '';
  }

  constructor() {
    this.liveCredits$ = combineLatest([
      this.authService.currentUser$,
      this.leaveService.requests$,
    ]).pipe(
      map(([user, allRequests]) => {
        if (!user) return null;
        const myRequests = allRequests.filter((req) => req.uid === user.uid && req.period);

        const calc = (type: string, status: 'approved' | 'pending') => {
          return myRequests
            .filter(
              (r) =>
                r.type === type &&
                (status === 'approved' ? r.status === 'Approved' : r.status.includes('Pending')),
            )
            .reduce((sum, r) => sum + calculateWorkdays(r.period, this.holidayList), 0);
        };

        // Check if employee is part-time
        const isPartTime = isPartTimeEmployee(user.department);

        // Calculate dynamic Paid Time Off based on joinedDate and role
        // Part-time employees get 0 PTO
        const paidTimeOffTotal = isPartTime ? 0 : calculatePaidTimeOff(user.joinedDate, user.role);
        const hasOneYearCompleted = hasCompletedOneYear(user.joinedDate);

        // Check if it's birth month for birthday leave
        const birthMonth = user.birthday ? new Date(user.birthday).getMonth() : -1;
        const currentMonth = new Date().getMonth();
        const isBirthMonth = birthMonth === currentMonth;

        // Determine leave filing eligibility
        const canFilePaidLeaves = canFilePaidLeave(user.joinedDate, user.department, user.role);
        const canFileMaternityPaternityLeaves = canFileMaternityPaternity(
          user.department,
          user.gender,
        );
        const canFileSickLeaves = canFileSickLeave(user.role);

        const leaveBal = user.leaveBalance ?? -1;
        const sickLeaveUsed = calc(LEAVE_TYPES.SICK_LEAVE, 'approved');
        const paidTimeOffTotalCalc =
          leaveBal >= 0 ? leaveBal + calc(LEAVE_TYPES.PAID_TIME_OFF, 'approved') : paidTimeOffTotal;

        return {
          ...user,
          isPartTime,
          // Dynamic balance calculations
          // leaveBalance in Firestore is already the remaining balance after deductions
          balances: {
            [LEAVE_TYPES.PAID_TIME_OFF]: {
              // Use leaveBalance from Firestore if available, otherwise calculate dynamically
              rem:
                leaveBal >= 0
                  ? leaveBal
                  : paidTimeOffTotal - calc(LEAVE_TYPES.PAID_TIME_OFF, 'approved'),
              pen: calc(LEAVE_TYPES.PAID_TIME_OFF, 'pending'),
              // Use leaveBalance from Firestore, or calculate total based on years of service
              total: paidTimeOffTotalCalc,
            },
            [LEAVE_TYPES.BIRTHDAY_LEAVE]: {
              rem: user.birthdayLeave - calc(LEAVE_TYPES.BIRTHDAY_LEAVE, 'approved'),
              pen: calc(LEAVE_TYPES.BIRTHDAY_LEAVE, 'pending'),
              total: user.birthdayLeave,
            },
            [LEAVE_TYPES.MATERNITY_LEAVE]: {
              rem: 105 - calc(LEAVE_TYPES.MATERNITY_LEAVE, 'approved'),
              pen: calc(LEAVE_TYPES.MATERNITY_LEAVE, 'pending'),
              total: 105,
            },
            [LEAVE_TYPES.PATERNITY_LEAVE]: {
              rem: 7 - calc(LEAVE_TYPES.PATERNITY_LEAVE, 'approved'),
              pen: calc(LEAVE_TYPES.PATERNITY_LEAVE, 'pending'),
              total: 7,
            },
            [LEAVE_TYPES.LEAVE_WITHOUT_PAY]: {
              rem: Infinity, // Unlimited
              pen: 0,
              total: Infinity,
            },
            [LEAVE_TYPES.SICK_LEAVE]: {
              // Sick leave shares balance with PTO - use same calculation
              rem:
                leaveBal >= 0
                  ? leaveBal
                  : paidTimeOffTotal - calc(LEAVE_TYPES.SICK_LEAVE, 'approved'),
              pen: calc(LEAVE_TYPES.SICK_LEAVE, 'pending'),
              total: paidTimeOffTotalCalc,
            },
          },
          // Additional flags
          canFilePaidLeaves,
          canFileMaternityPaternityLeaves,
          canFileSickLeaves,
          isBirthMonth,
          // Managing Director cannot file leaves at all
          canFileLeave: !['MANAGING DIRECTOR'].includes(user.role.toUpperCase()),
          isAdminOrSupervisor: [
            'ADMIN MANAGER',
            'ACCOUNT SUPERVISOR',
            'OPERATIONS ADMIN SUPERVISOR',
            'HR',
            'HUMAN RESOURCE OFFICER',
          ].includes(user.role.toUpperCase()),
          isFemale: (user.gender || '').trim().toLowerCase() === 'female',
          isMale: (user.gender || '').trim().toLowerCase() === 'male',
        };
      }),
    );
  }

  private async checkForDuplicateRequest(): Promise<boolean> {
    const user = this.authService.currentUser;
    if (!user || !this.leaveRequest.startDate || !this.leaveRequest.endDate) {
      return false;
    }

    const requestStart = new Date(this.leaveRequest.startDate);
    const requestEnd = new Date(this.leaveRequest.endDate);

    // Get all existing requests for this user
    const allRequests = (await this.leaveService.requests$.pipe(take(1)).toPromise()) || [];

    const myRequests = allRequests.filter(
      (req) =>
        req.uid === user.uid &&
        (req.status === 'Pending' ||
          req.status === 'Awaiting HR Approval' ||
          req.status === 'Awaiting Admin Manager Approval'),
    );

    for (const req of myRequests) {
      if (!req.period) continue;

      const sep = req.period.includes(' to ') ? ' to ' : ' - ';
      const dates = req.period.split(sep);
      const existingStart = new Date(dates[0].trim());
      const existingEnd = dates[1] ? new Date(dates[1].trim()) : existingStart;

      // Check if dates overlap
      if (requestStart <= existingEnd && requestEnd >= existingStart) {
        return true;
      }
    }

    return false;
  }

  ngOnInit() {
    // Subscribe to holiday service
    this.holidayService.holidays$.subscribe((holidays) => {
      this.holidayList = holidays;
      // Recalculate if dates already selected
      if (this.leaveRequest.startDate && this.leaveRequest.endDate) {
        this.calculateDays();
      }
    });

    this.route.queryParams.subscribe((params) => {
      if (params['date']) {
        this.leaveRequest.startDate = params['date'];
        this.leaveRequest.endDate = params['date'];
        setTimeout(() => {
          this.calculateDays();
          this.cdr.detectChanges();
        }, 100);
      }
    });
  }

  calculateDays() {
    if (this.leaveRequest.startDate && this.leaveRequest.endDate) {
      const period = `${this.leaveRequest.startDate} to ${this.leaveRequest.endDate}`;
      this.totalDays = calculateWorkdays(period, this.holidayList);

      // Update daysDeducted based on half-day toggle and total days
      if (this.isHalfDay) {
        this.leaveRequest.daysDeducted = 0.5;
      } else {
        this.leaveRequest.daysDeducted = this.totalDays > 0 ? this.totalDays : 1.0;
      }

      const start = new Date(this.leaveRequest.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      const noticeDiff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Sick Leave: Waive all notice requirements, allow post-filing (past or today)
      if (this.leaveRequest.type === LEAVE_TYPES.SICK_LEAVE) {
        this.noticeRequired = 0;
        this.isInsufficientNotice = false;
        // Check if post-filing (start date is in the past or today)
        this.isPostFiling = noticeDiff <= 0;
      }
      // Paid Leave (PTO) - New notice rules based on duration
      else if (this.leaveRequest.type === LEAVE_TYPES.PAID_TIME_OFF) {
        if (this.totalDays === 1) {
          this.noticeRequired = 2; // 1-Day: Minimum 2 days advance notice
        } else if (this.totalDays === 2) {
          this.noticeRequired = 3; // 2-Day: Minimum 3 days advance notice
        } else {
          this.noticeRequired = 5; // 3+ Day: Minimum 5 days advance notice
        }
        this.isInsufficientNotice = noticeDiff < this.noticeRequired;
        this.isPostFiling = false;
      }
      // Leave Without Pay: Same notice policy as Paid Leave
      else if (this.leaveRequest.type === LEAVE_TYPES.LEAVE_WITHOUT_PAY) {
        if (this.totalDays === 1) {
          this.noticeRequired = 2;
        } else if (this.totalDays === 2) {
          this.noticeRequired = 3;
        } else {
          this.noticeRequired = 5;
        }
        this.isInsufficientNotice = noticeDiff < this.noticeRequired;
        this.isPostFiling = false;
      }
      // Other leave types (Birthday, Maternity, Paternity) don't require advance notice
      else {
        this.noticeRequired = 0;
        this.isInsufficientNotice = false;
        this.isPostFiling = false;
      }

      // Update holidays in range for display
      this.holidaysInRange = this.getHolidaysInRange();

      this.checkBalance();
      this.cdr.detectChanges();
    }
  }

  // Helper function to format date as YYYY-MM-DD in local timezone
  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Check if selected dates include holidays and return holiday names
  private getHolidaysInRange(): string[] {
    if (!this.leaveRequest.startDate || !this.leaveRequest.endDate) return [];

    const start = new Date(this.leaveRequest.startDate);
    const end = new Date(this.leaveRequest.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const holidays: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = this.formatLocalDate(current);

      const holiday = this.holidayList.find(
        (h: any) => h.date === dateStr && (h.type === 'regular' || h.type === 'special-non'),
      );
      if (holiday && !holidays.includes(holiday.name)) {
        holidays.push(holiday.name);
      }
      current.setDate(current.getDate() + 1);
    }

    return holidays;
  }

  onLeaveTypeChange() {
    // Reset half-day toggle when leave type changes
    this.isHalfDay = false;
    this.leaveRequest.isHalfDay = false;
    this.leaveRequest.daysDeducted = 1.0;
    // Recalculate days to apply new leave type rules
    // Note: calculateDays() already handles notice requirement and balance check
    if (this.leaveRequest.startDate && this.leaveRequest.endDate) {
      this.calculateDays();
    }
    this.cdr.detectChanges();
  }

  onHalfDayToggle() {
    if (this.isHalfDay) {
      this.leaveRequest.isHalfDay = true;
      this.leaveRequest.daysDeducted = 0.5;
    } else {
      this.leaveRequest.isHalfDay = false;
      this.leaveRequest.daysDeducted = this.totalDays > 0 ? this.totalDays : 1.0;
    }
    this.checkBalance();
    this.cdr.detectChanges();
  }

  checkBalance() {
    this.liveCredits$.pipe(take(1)).subscribe((user) => {
      if (user) {
        // Leave Without Pay has no balance check
        if (this.leaveRequest.type === LEAVE_TYPES.LEAVE_WITHOUT_PAY) {
          this.isOverBalance = false;
        } else {
          const balance = user.balances[this.leaveRequest.type];
          // Use daysDeducted (0.5 or 1.0) for single-day requests, totalDays for multi-day
          const daysToCheck =
            this.totalDays === 1 ? this.leaveRequest.daysDeducted || 1.0 : this.totalDays;
          this.isOverBalance = balance ? daysToCheck > balance.rem : false;
        }
        // Recalculate notice requirement for current leave type
        this.recalculateNoticeRequirement();
        // Reset post-filing flag - will be set in recalculateNoticeRequirement for Sick Leave
        if (this.leaveRequest.type !== LEAVE_TYPES.SICK_LEAVE) {
          this.isPostFiling = false;
        }
      }
    });
  }

  private recalculateNoticeRequirement() {
    if (!this.leaveRequest.startDate || !this.totalDays) return;

    const start = new Date(this.leaveRequest.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    const noticeDiff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Sick Leave: Waive all notice requirements, allow post-filing
    if (this.leaveRequest.type === LEAVE_TYPES.SICK_LEAVE) {
      this.noticeRequired = 0;
      this.isInsufficientNotice = false;
      this.isPostFiling = noticeDiff <= 0;
    }
    // Paid Leave and Leave Without Pay: New notice rules based on duration
    else if (
      this.leaveRequest.type === LEAVE_TYPES.PAID_TIME_OFF ||
      this.leaveRequest.type === LEAVE_TYPES.LEAVE_WITHOUT_PAY
    ) {
      if (this.totalDays === 1) {
        this.noticeRequired = 2;
      } else if (this.totalDays === 2) {
        this.noticeRequired = 3;
      } else {
        this.noticeRequired = 5;
      }
      this.isInsufficientNotice = noticeDiff < this.noticeRequired;
      this.isPostFiling = false;
    }
    // Birthday Leave, Maternity, Paternity: No advance notice required
    else {
      this.noticeRequired = 0;
      this.isInsufficientNotice = false;
      this.isPostFiling = false;
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const maxSizeMB = 10;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      if (file.size > maxSizeBytes) {
        Swal.fire({
          title: 'File Too Large',
          text: `Maximum file size is ${maxSizeMB}MB. Please upload a smaller file.`,
          icon: 'error',
        });
        event.target.value = '';
        return;
      }

      this.fileName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        this.leaveRequest.attachment = { name: file.name, data: reader.result };
        console.log('File uploaded, attachment set:', !!this.leaveRequest.attachment);
        this.cdr.detectChanges();
        setTimeout(() => this.cdr.detectChanges(), 100);
      };
      reader.onerror = () => {
        console.error('Error reading file');
      };
      reader.readAsDataURL(file);
    } else {
      this.removeFile();
    }
  }

  removeFile() {
    this.fileName = '';
    this.leaveRequest.attachment = null;
    this.cdr.detectChanges();
  }

  async onSubmit() {
    // Prevent duplicate submissions
    if (this.isSubmitting) {
      return;
    }

    if (this.totalDays <= 0) {
      this.showErrorToast = true;
      this.errorMessage = 'Please select valid leave dates.';
      this.cdr.detectChanges();
      setTimeout(() => {
        this.showErrorToast = false;
        this.cdr.detectChanges();
      }, 3000);
      return;
    }

    // Check if selected dates include holidays - just inform, don't restrict
    const holidaysInRange = this.getHolidaysInRange();
    let holidayNotice = '';
    if (holidaysInRange.length > 0) {
      const holidayList =
        holidaysInRange.length === 1
          ? holidaysInRange[0]
          : holidaysInRange.slice(0, -1).join(', ') +
            ' and ' +
            holidaysInRange[holidaysInRange.length - 1];
      holidayNotice = ` Note: ${holidayList} ${holidaysInRange.length === 1 ? 'is' : 'are'} included in your selected dates.`;
    }

    // Check for insufficient notice (applies to both Paid Time Off and Leave Without Pay)
    if (this.isInsufficientNotice) {
      this.showErrorToast = true;
      this.errorMessage = `Insufficient notice. ${this.leaveRequest.type} requires at least ${this.noticeRequired} days advance notice.`;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.showErrorToast = false;
        this.cdr.detectChanges();
      }, 3000);
      return;
    }

    // Check for duplicate/overlapping requests
    const hasDuplicate = await this.checkForDuplicateRequest();
    if (hasDuplicate) {
      this.showErrorToast = true;
      this.errorMessage = 'You already have a pending request for these dates.';
      this.cdr.detectChanges();
      setTimeout(() => {
        this.showErrorToast = false;
        this.cdr.detectChanges();
      }, 3000);
      return;
    }

    // Check for over-balance (Leave Without Pay has no balance check)
    if (this.leaveRequest.type !== LEAVE_TYPES.LEAVE_WITHOUT_PAY && this.isOverBalance) {
      this.showErrorToast = true;
      this.errorMessage = 'Insufficient leave balance for this request.';
      this.cdr.detectChanges();
      setTimeout(() => {
        this.showErrorToast = false;
        this.cdr.detectChanges();
      }, 3000);
      return;
    }

    // Sick Leave requires attachment (medical certificate/proof) for 3+ days
    if (
      this.leaveRequest.type === LEAVE_TYPES.SICK_LEAVE &&
      this.totalDays >= 3 &&
      !this.leaveRequest.attachment
    ) {
      this.showErrorToast = true;
      this.errorMessage =
        'Attachment is required for sick leave of 3 days or more. Please upload a medical certificate or proof of illness.';
      this.cdr.detectChanges();
      setTimeout(() => {
        this.showErrorToast = false;
        this.cdr.detectChanges();
      }, 3000);
      return;
    }

    // Set submitting state to prevent duplicate submissions
    this.isSubmitting = true;
    this.cdr.detectChanges();

    try {
      await this.leaveService.addRequest(this.leaveRequest);
      this.successMessage = `Your request has been filed for review.${holidayNotice}`;
      this.showSuccessToast = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.showSuccessToast = false;
        this.cdr.detectChanges();
        this.router.navigate(['/history']);
      }, 2000);
    } catch (error) {
      this.showErrorToast = true;
      this.errorMessage = 'Failed to submit request. Please try again.';
      this.cdr.detectChanges();
      setTimeout(() => {
        this.showErrorToast = false;
        this.cdr.detectChanges();
      }, 3000);
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }
}
