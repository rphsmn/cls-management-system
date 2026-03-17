import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Observable, combineLatest, BehaviorSubject, startWith, map } from 'rxjs';
import { AuthService, User } from '../../../core/services/auth';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent {
  currentUser$: Observable<User | null>;
  allFilteredRequests$: Observable<any[]>;
  paginatedRequests$: Observable<any[]>;
  itemsPerPage = 10;
  private currentPageSubject = new BehaviorSubject<number>(1);
  currentPage$ = this.currentPageSubject.asObservable();
  searchControl = new FormControl('');
  expandedReq: any = null;

  constructor(private authService: AuthService) {
    this.currentUser$ = this.authService.currentUser$;
    
    this.allFilteredRequests$ = combineLatest([
      this.authService.currentUser$,
      this.authService.requests$,
      this.searchControl.valueChanges.pipe(startWith(''))
    ]).pipe(
      map(([user, requests, term]) => {
        if (!user) return [];
        const s = term?.toLowerCase() || '';
        
        // Normalize role for comparison
        const role = user.role?.toUpperCase() || '';

        return requests.filter(req => {
          const matches = req.employeeName?.toLowerCase().includes(s) || 
                          req.companyId?.toLowerCase().includes(s) ||
                          req.type?.toLowerCase().includes(s);

          // If User is Staff or Dev, they only see their own records
          if (role.includes('STAFF') || role.includes('DEV') || role.includes('IT')) {
             return matches && req.companyId === user.id;
          }
          
          // Managers/HR see all filtered records
          return matches;
        });
      })
    );

    this.paginatedRequests$ = combineLatest([this.allFilteredRequests$, this.currentPage$]).pipe(
      map(([reqs, page]) => reqs.slice((page - 1) * this.itemsPerPage, page * this.itemsPerPage))
    );
  }

  /**
   * Updated to match Approvals display style:
   * Result: "2 Days (Mar 19 - Mar 20)"
   */
  getFormattedPeriod(period: string): string {
    if (!period) return 'N/A';
    
    const sep = period.includes(' to ') ? ' to ' : ' - ';
    
    // If it's a single date string without a separator
    if (!period.includes(sep)) {
      const singleDate = new Date(period);
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

  // --- Status & UI Helpers ---

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
    if (t.includes('Sick')) return '🤒';
    if (t.includes('Birthday')) return '🎂';
    return '💰'; 
  }

  // --- Pagination Helpers ---
  getTotalPages(t: number) { return Math.ceil(t / this.itemsPerPage) || 1; }
  getStartRange(t: number) { return t === 0 ? 0 : (this.currentPageSubject.value - 1) * this.itemsPerPage + 1; }
  getEndRange(t: number) { return Math.min(this.currentPageSubject.value * this.itemsPerPage, t); }
  prevPage() { if (this.currentPageSubject.value > 1) this.currentPageSubject.next(this.currentPageSubject.value - 1); }
  nextPage(t: number) { if (this.currentPageSubject.value < this.getTotalPages(t)) this.currentPageSubject.next(this.currentPageSubject.value + 1); }
}