import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';
import { AuthService, calculatePaidTimeOff, hasCompletedOneYear, isPartTimeEmployee, canFilePaidLeave, canFileMaternityPaternity, LEAVE_TYPES } from '../../../core/services/auth';
import { LeaveService } from '../../../core/services/leave.services';
import { calculateWorkdays } from '../../../core/utils/workday-calculator.util';
import { Observable, combineLatest, map, take, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-file-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './file-leave.html',
  styleUrls: ['./file-leave.css'],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate('0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('0.3s ease-in', style({ transform: 'translateY(-100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class FileLeaveComponent implements OnInit {
  private authService = inject(AuthService);
  private leaveService = inject(LeaveService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);

  // Expose LEAVE_TYPES to template
  LEAVE_TYPES = LEAVE_TYPES;
  
  // Cache holiday list to avoid repeated API calls
  private holidayList: any[] = [];
  private holidaysLoaded = false;
  holidaysInRange: string[] = [];
  
  liveCredits$: Observable<any>;
  minDate: string = new Date().toISOString().split('T')[0];
  totalDays: number = 0;
  isOverBalance: boolean = false;
  isInsufficientNotice: boolean = false;
  noticeRequired: number = 0;
  showSuccessToast = false;
  showErrorToast = false;
  errorMessage = '';
  fileName = '';
  
  leaveRequest: {
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachment: any;
  } = {
    type: LEAVE_TYPES.PAID_TIME_OFF,
    startDate: '',
    endDate: '',
    reason: '',
    attachment: null
  };

  constructor() {
    // Fetch holidays from API for consistency with calendar component
    this.fetchHolidays();
    
    this.liveCredits$ = combineLatest([
      this.authService.currentUser$,
      this.leaveService.requests$
    ]).pipe(
      map(([user, allRequests]) => {
        if (!user) return null;
        const myRequests = allRequests.filter(req => req.uid === user.uid && req.period);
        
        const calc = (type: string, status: 'approved' | 'pending') => {
          return myRequests
            .filter(r => r.type === type && (status === 'approved' ? r.status === 'Approved' : r.status.includes('Pending')))
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
        const canFileMaternityPaternityLeaves = canFileMaternityPaternity(user.department, user.gender);
        
        return {
          ...user,
          isPartTime,
          // Dynamic balance calculations
          balances: {
            [LEAVE_TYPES.PAID_TIME_OFF]: { 
              rem: paidTimeOffTotal - calc(LEAVE_TYPES.PAID_TIME_OFF, 'approved'), 
              pen: calc(LEAVE_TYPES.PAID_TIME_OFF, 'pending'),
              total: paidTimeOffTotal
            },
            [LEAVE_TYPES.BIRTHDAY_LEAVE]: { 
              rem: user.birthdayLeave - calc(LEAVE_TYPES.BIRTHDAY_LEAVE, 'approved'), 
              pen: calc(LEAVE_TYPES.BIRTHDAY_LEAVE, 'pending'),
              total: user.birthdayLeave
            },
            [LEAVE_TYPES.MATERNITY_LEAVE]: { 
              rem: 105 - calc(LEAVE_TYPES.MATERNITY_LEAVE, 'approved'), 
              pen: calc(LEAVE_TYPES.MATERNITY_LEAVE, 'pending'),
              total: 105
            },
            [LEAVE_TYPES.PATERNITY_LEAVE]: { 
              rem: 7 - calc(LEAVE_TYPES.PATERNITY_LEAVE, 'approved'), 
              pen: calc(LEAVE_TYPES.PATERNITY_LEAVE, 'pending'),
              total: 7
            },
            [LEAVE_TYPES.LEAVE_WITHOUT_PAY]: { 
              rem: Infinity, // Unlimited
              pen: 0,
              total: Infinity
            }
          },
          // Additional flags
          canFilePaidLeaves,
          canFileMaternityPaternityLeaves,
          isBirthMonth,
          // Managing Director cannot file leaves at all
          canFileLeave: !['MANAGING DIRECTOR'].includes(user.role.toUpperCase()),
          isAdminOrSupervisor: ['ADMIN MANAGER', 'ACCOUNT SUPERVISOR', 'OPERATIONS ADMIN SUPERVISOR', 'HR', 'HUMAN RESOURCE OFFICER'].includes(user.role.toUpperCase()),
          isFemale: (user.gender || '').trim().toLowerCase() === 'female',
          isMale: (user.gender || '').trim().toLowerCase() === 'male'
        };
      })
    );
  }

  private fetchHolidays() {
    if (this.holidaysLoaded) return;
    
    const currentYear = new Date().getFullYear();
    console.log('Fetching holidays for year:', currentYear);
    forkJoin([
      this.http.get<any[]>(`https://date.nager.at/api/v3/PublicHolidays/${currentYear}/PH`).pipe(catchError(() => of([]))),
      this.http.get<any[]>(`https://date.nager.at/api/v3/PublicHolidays/${currentYear}/AU`).pipe(catchError(() => of([])))
    ]).subscribe(([phData, auData]) => {
      console.log('Received PH holidays:', phData.length, 'AU holidays:', auData.length);
      const processedPH = phData.map(h => ({ date: h.date, name: h.name, region: 'ph', type: this.mapHolidayType(h.name) }));
      const processedAU = auData.map(h => ({ date: h.date, name: h.name, region: 'au', type: this.mapHolidayType(h.name) }));
      
      // Deduplicate holidays - if same date appears in both PH and AU (like Christmas),
      // merge them into a single entry with both regions
      const holidayMap = new Map<string, any>();
      
      processedPH.forEach(h => {
        holidayMap.set(h.date, { ...h, region: 'ph/au' });
      });
      
      processedAU.forEach(h => {
        if (holidayMap.has(h.date)) {
          // Date already exists (e.g., Christmas) - mark as shared
          const existing = holidayMap.get(h.date);
          existing.region = 'ph/au';
          existing.name = h.name; // Keep the name (same for both countries)
        } else {
          holidayMap.set(h.date, h);
        }
      });
      
      this.holidayList = Array.from(holidayMap.values());
      this.holidaysLoaded = true;
      console.log('Holidays loaded:', this.holidayList.length, 'holidays');
      console.log('Sample holiday dates:', this.holidayList.slice(0, 5).map(h => h.date));
    });
  }

  private mapHolidayType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('edsa')) return 'special-work';
    if (lower.includes('ninoy') || lower.includes('chinese')) return 'special-non';
    return 'regular';
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['date']) {
        this.leaveRequest.startDate = params['date'];
        this.leaveRequest.endDate = params['date'];
        this.calculateDays();
      } else {
        // Default: calculate notice requirement even without dates
        this.recalculateNoticeRequirement();
      }
    });
  }

  calculateDays() {
    if (this.leaveRequest.startDate && this.leaveRequest.endDate) {
      const period = `${this.leaveRequest.startDate} to ${this.leaveRequest.endDate}`;
      this.totalDays = calculateWorkdays(period, this.holidayList);
      
      const start = new Date(this.leaveRequest.startDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      const noticeDiff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Paid Time Off requires advance notice based on duration
      if (this.leaveRequest.type === LEAVE_TYPES.PAID_TIME_OFF) {
        this.noticeRequired = this.totalDays <= 2 ? 3 : (this.totalDays === 3 ? 5 : 7);
        this.isInsufficientNotice = noticeDiff < this.noticeRequired;
      }
      // Leave Without Pay also requires the same advance notice policy as Paid Time Off
      else if (this.leaveRequest.type === LEAVE_TYPES.LEAVE_WITHOUT_PAY) {
        this.noticeRequired = this.totalDays <= 2 ? 3 : (this.totalDays === 3 ? 5 : 7);
        this.isInsufficientNotice = noticeDiff < this.noticeRequired;
      }
      // Other leave types (Birthday, Maternity, Paternity) don't require advance notice
      else {
        this.noticeRequired = 0;
        this.isInsufficientNotice = false;
      }
      
      // Update holidays in range for display
      this.holidaysInRange = this.getHolidaysInRange();
      
      this.checkBalance();
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
    
    console.log('Checking holidays in range:', this.leaveRequest.startDate, 'to', this.leaveRequest.endDate);
    console.log('Holiday list loaded:', this.holidaysLoaded, 'Count:', this.holidayList.length);
    console.log('Start date type:', typeof this.leaveRequest.startDate, 'Value:', this.leaveRequest.startDate);
    
    const start = new Date(this.leaveRequest.startDate);
    const end = new Date(this.leaveRequest.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const holidays: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = this.formatLocalDate(current);
      console.log('Checking date:', dateStr, 'against holiday list');
      const holiday = this.holidayList.find((h: any) => 
        h.date === dateStr && (h.type === 'regular' || h.type === 'special-non')
      );
      if (holiday && !holidays.includes(holiday.name)) {
        console.log('Found holiday:', holiday.name, 'on', dateStr);
        holidays.push(holiday.name);
      }
      current.setDate(current.getDate() + 1);
    }
    console.log('Holidays found:', holidays);
    return holidays;
  }
  
  onLeaveTypeChange() {
    // Recalculate days to apply new leave type rules
    // Note: calculateDays() already handles notice requirement and balance check
    if (this.leaveRequest.startDate && this.leaveRequest.endDate) {
      this.calculateDays();
    }
  }

  checkBalance() {
    this.liveCredits$.pipe(take(1)).subscribe(user => {
      if (user) {
        // Leave Without Pay has no balance check
        if (this.leaveRequest.type === LEAVE_TYPES.LEAVE_WITHOUT_PAY) {
          this.isOverBalance = false;
        } else {
          const balance = user.balances[this.leaveRequest.type];
          this.isOverBalance = balance ? this.totalDays > balance.rem : false;
        }
        // Recalculate notice requirement for current leave type
        this.recalculateNoticeRequirement();
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

    // Leave Without Pay requires the same advance notice policy as Paid Time Off
    if (this.leaveRequest.type === LEAVE_TYPES.LEAVE_WITHOUT_PAY) {
      this.noticeRequired = this.totalDays <= 2 ? 3 : (this.totalDays === 3 ? 5 : 7);
      this.isInsufficientNotice = noticeDiff < this.noticeRequired;
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.fileName = file.name;
      const reader = new FileReader();
      reader.onload = () => this.leaveRequest.attachment = { name: file.name, data: reader.result };
      reader.readAsDataURL(file);
    }
  }

  removeFile() {
    this.fileName = '';
    this.leaveRequest.attachment = null;
  }

  async onSubmit() {
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
    
    // Check if selected dates include holidays
    const holidaysInRange = this.getHolidaysInRange();
    if (holidaysInRange.length > 0) {
      this.showErrorToast = true;
      const holidayList = holidaysInRange.length === 1 
        ? holidaysInRange[0] 
        : holidaysInRange.slice(0, -1).join(', ') + ' and ' + holidaysInRange[holidaysInRange.length - 1];
      this.errorMessage = `Hey! Just a heads up - ${holidayList} ${holidaysInRange.length === 1 ? 'is' : 'are'} coming up on your selected dates. Feel free to pick different days for your leave!`;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.showErrorToast = false;
        this.cdr.detectChanges();
      }, 3000);
      return;
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
    
    await this.leaveService.addRequest(this.leaveRequest);
    this.showSuccessToast = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showSuccessToast = false;
      this.cdr.detectChanges();
      this.router.navigate(['/history']);
    }, 2000);
  }
}