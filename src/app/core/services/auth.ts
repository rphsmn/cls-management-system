import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// Defining the interface here so other files can import it directly from auth.ts
export interface User {
  id: string;
  name: string;
  password?: string;
  role: string;
  credits: {
    paidLeave: number;
    birthdayLeave: number;
    sickLeave: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly REQ_KEY = 'cls_leave_requests';
  private readonly USER_KEY = 'cls_user_session';

  private users: User[] = [
    { id: 'MGR-001', name: 'Sarah Johnson', password: 'password123', role: 'Manager', credits: { paidLeave: 20, birthdayLeave: 1, sickLeave: 15 } },
    { id: 'HR-001', name: 'Jennifer Lee', password: 'password123', role: 'HR', credits: { paidLeave: 18, birthdayLeave: 1, sickLeave: 12 } },
    { id: 'ADM-001', name: 'Admin Boss', password: 'password123', role: 'Admin Manager', credits: { paidLeave: 20, birthdayLeave: 1, sickLeave: 15 } },
    { id: 'OPS-SUP', name: 'Ops Supervisor', password: 'password123', role: 'Ops Sup', credits: { paidLeave: 15, birthdayLeave: 1, sickLeave: 10 } },
    { id: 'OPS-STF', name: 'Ralph', password: 'password123', role: 'Ops Staff', credits: { paidLeave: 15, birthdayLeave: 1, sickLeave: 10 } }
  ];

  private currentUserSubject = new BehaviorSubject<User | null>(this.getInitialUser());
  currentUser$ = this.currentUserSubject.asObservable();

  private requestsSubject = new BehaviorSubject<any[]>(this.getSavedRequests());
  requests$ = this.requestsSubject.asObservable();

  constructor() {}

  private getInitialUser(): User | null {
    const saved = localStorage.getItem(this.USER_KEY);
    return saved ? JSON.parse(saved) as User : null;
  }

  private getSavedRequests(): any[] {
    const saved = localStorage.getItem(this.REQ_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  login(id: string, pass: string): boolean {
    const user = this.users.find(u => u.id === id && u.password === pass);
    if (user) {
      this.currentUserSubject.next({ ...user } as User);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      return true;
    }
    return false;
  }

  logout() {
    this.currentUserSubject.next(null);
    localStorage.removeItem(this.USER_KEY);
  }

  private syncRequests() {
    localStorage.setItem(this.REQ_KEY, JSON.stringify(this.requestsSubject.value));
  }

  addRequest(request: any) {
    const user = this.currentUserSubject.value;
    if (!user) return;

    const requestWithUser = { 
      ...request, 
      requesterName: user.name, 
      requesterRole: user.role,
      status: 'Pending',
      stage: 'Initial',
      targetReviewer: this.getInitialReviewer(user.role) 
    };
    
    const updated = [requestWithUser, ...this.requestsSubject.value];
    this.requestsSubject.next(updated);
    this.syncRequests();
  }

private getInitialReviewer(role: string): string {
  switch (role) {
    case 'Ops Staff': return 'Ops Sup';
    case 'Acc Staff': return 'Acc Sup';
    // For Supervisors and IT Devs, the Admin Manager reviews first
    case 'Ops Sup':
    case 'Acc Sup':
    case 'IT Dev': return 'Admin Manager'; 
    case 'HR': return 'Admin Manager';
    case 'Admin Manager': return 'HR';
    default: return 'HR';
  }
}

updateRequestStatus(requestToUpdate: any, newStatus: string) {
  const currentRequests = this.requestsSubject.value.map(req => {
    const isMatch = req.dateFiled === requestToUpdate.dateFiled && 
                    req.requesterName === requestToUpdate.requesterName;

    if (isMatch) {
      if (newStatus === 'Rejected') return { ...req, status: 'Rejected', targetReviewer: 'None' };
      
      if (newStatus === 'Approved') {
        // STEP 1: If Ops/Acc Sup approved Staff request -> Send to HR
        if (req.targetReviewer === 'Ops Sup' || req.targetReviewer === 'Acc Sup') {
          return { ...req, status: 'Awaiting HR Approval', targetReviewer: 'HR' };
        }

        // STEP 2: If Admin Manager approved Ops/Acc Sup/IT request -> Send to HR
        if (req.targetReviewer === 'Admin Manager' && 
           (req.requesterRole === 'Ops Sup' || req.requesterRole === 'Acc Sup' || req.requesterRole === 'IT Dev' || req.requesterRole === 'HR')) {
          return { ...req, status: 'Awaiting HR Approval', targetReviewer: 'HR' };
        }

        // STEP 3: If Admin Manager approved a request from an Admin Manager -> Send to HR
        if (req.targetReviewer === 'Admin Manager' && req.requesterRole === 'Admin Manager') {
            return { ...req, status: 'Awaiting HR Approval', targetReviewer: 'HR' };
        }
        
        // FINAL STEP: If HR approves (and they were the last step) -> Fully Approved
        return { ...req, status: 'Approved', targetReviewer: 'None' };
      }
    }
    return req;
  });

  this.requestsSubject.next(currentRequests);
  this.syncRequests();
}
}