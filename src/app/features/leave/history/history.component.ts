import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Observable, combineLatest, BehaviorSubject, startWith, map, tap, debounceTime, shareReplay, Subscription } from 'rxjs';
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
  monthControl = new FormControl(new Date().getMonth(), { nonNullable: true });
  yearControl = new FormControl(new Date().getFullYear(), { nonNullable: true });

  months = [{ v: 0, l: 'Jan' }, { v: 1, l: 'Feb' }, { v: 2, l: 'Mar' }, { v: 3, l: 'Apr' }, { v: 4, l: 'May' }, { v: 5, l: 'Jun' }, { v: 6, l: 'Jul' }, { v: 7, l: 'Aug' }, { v: 8, l: 'Sep' }, { v: 9, l: 'Oct' }, { v: 10, l: 'Nov' }, { v: 11, l: 'Dec' }];
  years = [2024, 2025, 2026];
  expandedReq: any = null;

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
      )
    ]).pipe(
      map(([user, requests, term, selMonth, selYear]) => {
        if (!user || !requests) return [];
        const userRoleUpper = user.role.toUpperCase();
        return requests.filter(req => {
          if (!req.period) return false; // Skip requests without period
          // HR, Admin Manager, and Managing Director can see all requests, others only see their own
          const canSee = (userRoleUpper === 'HR' || userRoleUpper === 'ADMIN MANAGER' || 
                         userRoleUpper === 'HUMAN RESOURCE OFFICER' || userRoleUpper === 'MANAGING DIRECTOR') || req.uid === user.uid;
          const matchesSearch = req.employeeName?.toLowerCase().includes(term.toLowerCase()) || req.type?.toLowerCase().includes(term.toLowerCase());
          const start = new Date(req.period.split(' to ')[0]);
          return canSee && matchesSearch && start.getMonth() === selMonth && start.getFullYear() === selYear;
        });
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

  // --- RESTORED HELPER METHODS FOR HTML ---
  getFormattedPeriod(period: string): string {
    const diff = calculateWorkdays(period, this.holidayList);
    const start = new Date(period.split(' to ')[0]);
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
    if (role === 'ADMIN OPERATION OFFICER' || role === 'ADMIN OPERATION ASSISTANT') return ['Ops Admin', 'HR'];
    
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
    
    // For Part-Time employees (1 step): HR only
    if (role === 'PART-TIME') {
      if (index === 0) {
        if (status === 'Approved') return 'completed';
        if (status.includes('Rejected')) return 'rejected';
        return 'pending';
      }
    }
    
    // For Operations Admin staff (2 steps): Ops Admin Supervisor → HR
    if (role === 'ADMIN OPERATION OFFICER' || role === 'ADMIN OPERATION ASSISTANT') {
      if (index === 0) {
        // Only mark as completed when status is explicitly Approved by Ops Admin Supervisor
        // Awaiting HR Approval means it's still pending HR review
        if (status === 'Approved') return 'completed';
        if (status === 'Rejected' && !status.includes('HR')) return 'rejected';
        return 'pending';
      }
      if (index === 1) {
        // HR step: completed only when status is Approved (final)
        // Pending when awaiting HR approval
        if (status === 'Approved') return 'completed';
        if (status.includes('Rejected')) return 'rejected';
        return status === 'Awaiting HR Approval' ? 'pending' : '';
      }
    }
    
    // For Accounts staff (2 steps): Account Supervisor → HR
    if (role === 'ACCOUNTING CLERK' || role === 'ACCOUNT RECEIVABLE SPECIALIST' || role === 'ACCOUNT PAYABLES SPECIALIST') {
      if (index === 0) {
        // Only mark as completed when status is explicitly Approved by Acct Supervisor
        // Awaiting HR Approval means it's still pending HR review
        if (status === 'Approved') return 'completed';
        if (status === 'Rejected' && !status.includes('HR')) return 'rejected';
        return 'pending';
      }
      if (index === 1) {
        // HR step: completed only when status is Approved (final)
        if (status === 'Approved') return 'completed';
        if (status.includes('Rejected')) return 'rejected';
        return status === 'Awaiting HR Approval' ? 'pending' : '';
      }
    }
    
    // For Supervisors / IT Dev (2 steps): Admin Manager → HR
    if (role === 'OPERATIONS ADMIN SUPERVISOR' || role === 'ACCOUNT SUPERVISOR' || 
        role === 'SENIOR IT DEVELOPER' || role === 'IT ASSISTANT' || role === 'IT DEVELOPER') {
      if (index === 0) {
        // Only mark as completed when status is explicitly Approved by Admin Manager
        // Awaiting HR Approval means it's still pending HR review
        if (status === 'Approved') return 'completed';
        if (status.includes('Rejected') && !status.includes('HR')) return 'rejected';
        return 'pending';
      }
      if (index === 1) {
        // HR step: completed only when status is Approved (final)
        if (status === 'Approved') return 'completed';
        if (status.includes('Rejected')) return 'rejected';
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
    return '💰'; 
  }
  toggleReason(r: any) { this.expandedReq = this.expandedReq === r ? null : r; }
  viewDocument(att: any) { window.open()?.document.write(`<iframe src="${att.data}" style="width:100%;height:100%;"></iframe>`); }
}