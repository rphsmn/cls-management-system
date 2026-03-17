import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Observable, combineLatest, BehaviorSubject, startWith, map, tap } from 'rxjs';
import { AuthService, User } from '../../../core/services/auth';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent implements OnInit {
  // Observables for data streams
  currentUser$: Observable<User | null>;
  allFilteredRequests$: Observable<any[]>;
  paginatedRequests$: Observable<any[]>;
  
  // Pagination State
  itemsPerPage = 10;
  private currentPageSubject = new BehaviorSubject<number>(1);
  currentPage$ = this.currentPageSubject.asObservable();

  // Form Controls for Filters
  searchControl = new FormControl('', { nonNullable: true });
  monthControl = new FormControl(new Date().getMonth(), { nonNullable: true });
  yearControl = new FormControl(new Date().getFullYear(), { nonNullable: true });

  // Filter Options
  months = [
    { v: 0, l: 'Jan' }, { v: 1, l: 'Feb' }, { v: 2, l: 'Mar' }, { v: 3, l: 'Apr' },
    { v: 4, l: 'May' }, { v: 5, l: 'Jun' }, { v: 6, l: 'Jul' }, { v: 7, l: 'Aug' },
    { v: 8, l: 'Sep' }, { v: 9, l: 'Oct' }, { v: 10, l: 'Nov' }, { v: 11, l: 'Dec' }
  ];
  years = [2024, 2025, 2026];
  
  expandedReq: any = null;

  constructor(private authService: AuthService) {
    // 1. Initialize Current User
    this.currentUser$ = this.authService.currentUser$;
    
    // 2. Setup the Filtered Stream
    this.allFilteredRequests$ = combineLatest([
      this.authService.currentUser$,
      this.authService.requests$,
      this.searchControl.valueChanges.pipe(startWith(''), tap(() => this.resetPagination())),
      this.monthControl.valueChanges.pipe(startWith(this.monthControl.value), tap(() => this.resetPagination())),
      this.yearControl.valueChanges.pipe(startWith(this.yearControl.value), tap(() => this.resetPagination()))
    ]).pipe(
      map(([user, requests, term, selMonth, selYear]) => {
        if (!user || !requests) return [];
        
        const s = term?.toLowerCase() || '';
        const role = user.role?.toUpperCase() || '';

        return requests.filter(req => {
          // Search Logic
          const matchesSearch = 
            req.employeeName?.toLowerCase().includes(s) || 
            req.companyId?.toLowerCase().includes(s) ||
            req.type?.toLowerCase().includes(s);

          if (!matchesSearch) return false;

          // Date Filter Logic
          if (!this.checkPeriodMatch(req.period, Number(selMonth), Number(selYear))) return false;

          // Permission Logic: Staff only see their own
          if (role.includes('STAFF') || role.includes('DEV') || role.includes('IT')) {
             return req.companyId === user.id;
          }
          
          return true;
        });
      })
    );

    // 3. Setup Pagination Stream
    this.paginatedRequests$ = combineLatest([
      this.allFilteredRequests$, 
      this.currentPage$
    ]).pipe(
      map(([reqs, page]) => {
        const start = (page - 1) * this.itemsPerPage;
        return reqs.slice(start, start + this.itemsPerPage);
      })
    );
  }

  ngOnInit(): void {
    // Initialization logic if needed
  }

  private resetPagination() {
    this.currentPageSubject.next(1);
  }

  private checkPeriodMatch(period: string, selMonth: number, selYear: number): boolean {
    if (!period) return false;
    const sep = period.includes(' to ') ? ' to ' : ' - ';
    const dates = period.split(sep);
    const start = new Date(dates[0].trim());
    const end = dates[1] ? new Date(dates[1].trim()) : start;

    return (start.getMonth() === selMonth && start.getFullYear() === selYear) || 
           (end.getMonth() === selMonth && end.getFullYear() === selYear);
  }

  // --- UI Formatters ---

  getFormattedPeriod(period: string): string {
    if (!period) return 'N/A';
    const sep = period.includes(' to ') ? ' to ' : ' - ';
    
    if (!period.includes(sep)) {
      const singleDate = new Date(period.trim());
      if (isNaN(singleDate.getTime())) return period;
      return `1 Day (${singleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    }

    const parts = period.split(sep);
    const start = new Date(parts[0].trim());
    const end = new Date(parts[1].trim());

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return period;

    const diff = Math.ceil(Math.abs(end.getTime() - start.getTime()) / 86400000) + 1;
    const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endFmt = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `${diff} ${diff === 1 ? 'Day' : 'Days'} (${startFmt} - ${endFmt})`;
  }

  getSupervisorClass(r: any) { 
    if (r.status === 'Approved' || r.status.includes('HR')) return 'completed';
    return r.status === 'Rejected' && !r.status.includes('HR') ? 'rejected' : '';
  }

  getSupervisorIcon(r: any) { 
    const c = this.getSupervisorClass(r); 
    return c === 'completed' ? '✓' : c === 'rejected' ? '✕' : '?'; 
  }

  getHRClass(r: any) { 
    if (r.status === 'Approved') return 'completed';
    return r.status === 'Rejected' && r.status.includes('HR') ? 'rejected' : '';
  }

  getHRIcon(r: any) { 
    const c = this.getHRClass(r); 
    if (c === 'completed') return '✓';
    if (c === 'rejected') return '✕';
    return r.status.includes('HR Approval') ? '...' : '-'; 
  }
  
  getRelativeDate(d: any) { 
    const date = new Date(d); 
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    return date.toDateString() === yesterday.toDateString() ? 'Yesterday' : '';
  }
  
  toggleReason(r: any) { this.expandedReq = this.expandedReq === r ? null : r; }
  
  viewDocument(att: any) { 
    const newTab = window.open();
    newTab?.document.write(`<iframe src="${att.data}" frameborder="0" style="width:100%;height:100%;"></iframe>`); 
  }

  getLeaveIcon(t: string) { 
    const type = t?.toLowerCase() || '';
    if (type.includes('sick')) return '🤒';
    if (type.includes('birthday')) return '🎂';
    return '💰'; 
  }

  // --- Pagination Helpers ---
  getTotalPages(t: number) { return Math.ceil(t / this.itemsPerPage) || 1; }
  getStartRange(t: number) { return t === 0 ? 0 : (this.currentPageSubject.value - 1) * this.itemsPerPage + 1; }
  getEndRange(t: number) { return Math.min(this.currentPageSubject.value * this.itemsPerPage, t); }
  prevPage() { if (this.currentPageSubject.value > 1) this.currentPageSubject.next(this.currentPageSubject.value - 1); }
  nextPage(t: number) { if (this.currentPageSubject.value < this.getTotalPages(t)) this.currentPageSubject.next(this.currentPageSubject.value + 1); }
}