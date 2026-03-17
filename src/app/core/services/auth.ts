import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Attachment {
  name: string;
  data: string;
  type: string;
}

export interface User {
  id: string;
  name: string;
  role: string;
  department: string;
  credits: { paidLeave: number; birthdayLeave: number; sickLeave: number; };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly REQ_KEY = 'cls_leave_requests';
  private readonly USER_KEY = 'cls_user_session';

  private defaultUsers: User[] = [
    { id: 'OPS-ADM-STF', name: 'Reymart L. Prado', role: 'Operations Staff', department: 'Operations', credits: { paidLeave: 15, birthdayLeave: 1, sickLeave: 10 } },
    { id: 'OPS-ADM-SUP', name: 'Domingo N. Reantaso Jr.', role: 'Ops Supervisor', department: 'Operations', credits: { paidLeave: 15, birthdayLeave: 1, sickLeave: 10 } },
    { id: 'ACC-SUP', name: 'Olympia B. Oreste', role: 'Acc Supervisor', department: 'Accounts', credits: { paidLeave: 18, birthdayLeave: 1, sickLeave: 12 } },
    { id: 'ADM-MGR', name: 'Riza Jane A. Amoncio', role: 'Admin Manager', department: 'Administration', credits: { paidLeave: 20, birthdayLeave: 1, sickLeave: 15 } },
    { id: 'HR-001', name: 'Rosalie Neptuno', role: 'HR', department: 'HR', credits: { paidLeave: 18, birthdayLeave: 1, sickLeave: 12 } },
    { id: 'CLS-ACC', name: 'Accounts Employee', role: 'Accounts Staff', department: 'Accounts', credits: { paidLeave: 15, birthdayLeave: 1, sickLeave: 10 } },
    { id: 'CLS-DEV', name: 'Developer', role: 'It Developer', department: 'IT', credits: { paidLeave: 30, birthdayLeave: 1, sickLeave: 20 } },
    { id: 'MGR-001', name: 'Roy Belen', role: 'Manager', department: 'Management', credits: { paidLeave: 20, birthdayLeave: 1, sickLeave: 15 } }
  ];

  public currentUserSubject = new BehaviorSubject<User | null>(this.getInitialUser());
  currentUser$ = this.currentUserSubject.asObservable();
  private requestsSubject = new BehaviorSubject<any[]>(this.getSavedRequests());
  requests$ = this.requestsSubject.asObservable();

  private getInitialUser(): User | null {
    const saved = localStorage.getItem(this.USER_KEY);
    if (!saved) return null;
    try {
      const user = JSON.parse(saved);
      return (user && user.id) ? user : null;
    } catch { return null; }
  }

  private getSavedRequests(): any[] {
    const saved = localStorage.getItem(this.REQ_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  login(id: string, pass: string): boolean {
    const cleanId = id.trim().toUpperCase();
    const user = this.defaultUsers.find(u => u.id.toUpperCase() === cleanId);
    if (user) {
      this.currentUserSubject.next({ ...user });
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      return true;
    }
    return false;
  }

  logout() {
    this.currentUserSubject.next(null);
    localStorage.removeItem(this.USER_KEY);
  }

  addRequest(newRequest: any) {
    const user = this.currentUserSubject.value;
    if (!user) return;

    let firstReviewer = ''; 
    if (user.role === 'Operations Staff') firstReviewer = 'Ops Supervisor';
    else if (user.role === 'Accounts Staff') firstReviewer = 'Acc Supervisor';
    else if (['Ops Supervisor', 'Acc Supervisor', 'It Developer', 'HR'].includes(user.role)) firstReviewer = 'Admin Manager';
    else if (user.role === 'Admin Manager') firstReviewer = 'HR';
    else firstReviewer = 'HR';

    const enriched = { 
      ...newRequest, 
      id: Date.now(), 
      status: 'Pending', 
      employeeName: user.name,
      companyId: user.id,
      role: user.role,
      department: user.department,
      targetReviewer: firstReviewer,
      dateFiled: new Date().toISOString()
    };
    
    const updated = [enriched, ...this.requestsSubject.value];
    this.saveRequests(updated);
  }

  updateRequestStatus(requestId: number, action: string) {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) return;

    const updated = this.requestsSubject.value.map(req => {
      if (req.id === requestId) {
        if (action === 'Reject') return { ...req, status: 'Rejected', targetReviewer: 'None' };

        if (currentUser.role === 'Admin Manager') {
          if (req.role === 'HR') {
            this.deductCredits(req.employeeName, req.type, req.period);
            return { ...req, status: 'Approved', targetReviewer: 'None' };
          }
          return { ...req, status: 'Awaiting HR Approval', targetReviewer: 'HR' };
        }

        if (currentUser.role === 'HR') {
          this.deductCredits(req.employeeName, req.type, req.period);
          return { ...req, status: 'Approved', targetReviewer: 'None' };
        }

        if (['Ops Supervisor', 'Acc Supervisor'].includes(currentUser.role)) {
          return { ...req, status: 'Awaiting HR Approval', targetReviewer: 'HR' };
        }
      }
      return req;
    });

    this.saveRequests(updated);
  }

  private deductCredits(userName: string, leaveType: string, period: string) {
    const user = this.defaultUsers.find(u => u.name === userName);
    if (!user) return;

    let days = 1;
    if (period.includes(' - ') || period.includes(' to ')) {
      const parts = period.split(/ - | to /);
      const start = new Date(parts[0]);
      const end = new Date(parts[1]);
      days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const typeMap: { [key: string]: keyof User['credits'] } = {
      'Paid Leave': 'paidLeave',
      'Sick Leave': 'sickLeave',
      'Birthday Leave': 'birthdayLeave'
    };

    const creditKey = typeMap[leaveType];
    if (creditKey) {
      user.credits[creditKey] = Math.max(0, user.credits[creditKey] - days);
      if (this.currentUserSubject.value?.name === userName) {
        this.currentUserSubject.next({ ...user });
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }
    }
  }

  private saveRequests(requests: any[]) {
    this.requestsSubject.next(requests);
    localStorage.setItem(this.REQ_KEY, JSON.stringify(requests));
  }
}