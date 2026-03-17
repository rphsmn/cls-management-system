import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, map, combineLatest, startWith, BehaviorSubject, tap } from 'rxjs';
import { AuthService, User } from '../../core/services/auth';
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
  
  currentUser$: Observable<User | null> = this.authService.currentUser$;
  allFilteredRequests$: Observable<any[]>;
  paginatedRequests$: Observable<any[]>;
  
  itemsPerPage = 10;
  private currentPageSubject = new BehaviorSubject<number>(1);
  currentPage$ = this.currentPageSubject.asObservable();
  
  searchControl = new FormControl('');
  expandedReq: any = null;

  constructor() {
    this.allFilteredRequests$ = combineLatest([
      this.authService.currentUser$,
      this.authService.requests$,
      this.searchControl.valueChanges.pipe(
        startWith(''),
        // Reset to page 1 whenever user types
        tap(() => this.currentPageSubject.next(1))
      )
    ]).pipe(
      map(([user, allRequests, searchTerm]) => {
        if (!user || !allRequests) return [];
        
        const term = searchTerm?.toLowerCase().trim() || '';
        const myRole = user.role?.toUpperCase().trim() || '';

        return allRequests.filter(req => {
          // 1. IMPROVED SEARCH LOGIC (Now matches History page)
          const matchesSearch = 
            req.employeeName?.toLowerCase().includes(term) || 
            req.companyId?.toLowerCase().includes(term) ||
            req.type?.toLowerCase().includes(term); // Added Leave Type to search

          if (!matchesSearch || req.companyId === user.id) return false;

          const reqRole = req.role?.toUpperCase().trim() || '';
          const status = req.status;

          // --- ROLE HIERARCHY LOGIC ---
          if (myRole === 'OPS-ADM-SUP' || myRole === 'OPS SUPERVISOR') {
            return status === 'Pending' && (reqRole === 'OPS-ADM-STF' || reqRole === 'OPERATIONS STAFF');
          }

          if (myRole === 'ACC-ADM-SUP' || myRole === 'ACC SUPERVISOR') {
            return status === 'Pending' && (reqRole === 'ACC-ADM-STF' || reqRole === 'ACCOUNTS STAFF');
          }

          if (myRole === 'ADM-MGR' || myRole === 'ADMIN MANAGER') {
            const managedRoles = [
              'OPS-ADM-SUP', 'OPS SUPERVISOR',
              'ACC-ADM-SUP', 'ACC SUPERVISOR',
              'IT-DEV', 'IT DEVELOPER',
              'HR-ADM', 'HR'
            ];
            return status === 'Pending' && managedRoles.includes(reqRole);
          }

          if (myRole === 'HR-ADM' || myRole === 'HR') {
            const isAdminManager = (reqRole === 'ADM-MGR' || reqRole === 'ADMIN MANAGER');
            const isEscalated = status === 'Awaiting HR Approval' || status === 'Awaiting Final HR Approval';
            return (isAdminManager && status === 'Pending') || isEscalated;
          }

          return false;
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

  // --- ACTIONS ---

updateStatus(req: any, action: string) {
  const isApprove = action === 'Approve';
  Swal.fire({
    title: `<div style="color: #1a5336; font-weight: 800; font-size: 24px; margin-bottom: 10px;">Confirm ${action}?</div>`,
    html: `<div style="font-size: 15px; color: #64748b;">Process leave for <strong>${req.employeeName}</strong>?</div>`,
    
    // CHANGE THIS LINE: 'warning' (orange) -> 'error' (red)
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
        this.authService.updateRequestStatus(req.id, action);
        Swal.fire({ 
          toast: true, 
          position: 'top-end', 
          showConfirmButton: false, 
          timer: 2000, 
          icon: 'success', 
          title: `Request ${action === 'Approve' ? 'Approved' : 'Rejected'}` 
        });
      }
    });
  }

  // --- UI HELPERS ---

  getFormattedPeriod(period: string): string {
    if (!period) return 'N/A';
    const separator = period.includes(' to ') ? ' to ' : ' - ';
    if (!period.includes(separator)) return period;
    const parts = period.split(separator);
    const start = new Date(parts[0].trim());
    const end = new Date(parts[1].trim());
    const diff = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${diff} ${diff === 1 ? 'Day' : 'Days'} (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
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
    const icons: any = { 'Birthday Leave': '🎂', 'Sick Leave': '🤒', 'Paid Leave': '💰' };
    return icons[type] || '📄';
  }
}