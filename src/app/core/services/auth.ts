import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly REQ_KEY = 'cls_leave_requests';
  private readonly USER_KEY = 'cls_user_session';

  // The official hierarchy for Cor Logics Solution Inc.
  // (roles may include: 'Manager', 'HR', 'Employee' plus Ops/Acc/IT/ Admin titles)
  // Additional roles that could be added for advanced workflow:
  // 'Ops Staff', 'Ops Sup', 'Acc Staff', 'Acc Sup', 'IT Dev', 'Admin Manager'
  // Updated User list with the new specialized roles
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

  private getInitialUser(): User | null {
    const saved = localStorage.getItem(this.USER_KEY);
    return saved ? JSON.parse(saved) : null;
  }

  private getSavedRequests(): any[] {
    const saved = localStorage.getItem(this.REQ_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  login(id: string, pass: string): boolean {
    const user = this.users.find(u => u.id === id && u.password === pass);
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
      stage: 'Initial', // Tracks if it's at the 1st or 2nd approval level
      targetReviewer: this.getInitialReviewer(user.role) 
    };
    
    const updated = [requestWithUser, ...this.requestsSubject.value];
    this.requestsSubject.next(updated);
    this.syncRequests();
  }

  updateRequestStatus(requestToUpdate: any, newStatus: string) {
    const currentRequests = this.requestsSubject.value.map(req => {
      if (req.dateFiled === requestToUpdate.dateFiled && req.requesterName === requestToUpdate.requesterName) {
        
        if (newStatus === 'Rejected') {
          return { ...req, status: 'Rejected', targetReviewer: 'None' };
        }

        // Logic for "Approved" hand-off
        if (newStatus === 'Approved') {
          if (req.stage === 'Initial') {
            // First approval done, move to Final Review (usually HR)
            return { 
              ...req, 
              stage: 'Final', 
              status: 'Awaiting HR Approval', 
              targetReviewer: 'HR' 
            };
          } else {
            // Second/Final approval done: Math happens here
            const days = this.calculateDays(req.range);
            this.deductCredits(req.type, days, req.requesterName);
            return { ...req, status: 'Approved', targetReviewer: 'None' };
          }
        }
      }
      return req;
    });
    this.requestsSubject.next(currentRequests);
    this.syncRequests();
  }

  private calculateDays(range: string): number {
    const parts = range.split(' to ');
    if (parts.length !== 2) return 1;
    const start = new Date(parts[0]);
    const end = new Date(parts[1]);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end
    return Math.max(1, diffDays);
  }

  // Determine who gets the request first based on your rules
  private getInitialReviewer(role: string): string {
    switch (role) {
      case 'Ops Staff': return 'Ops Sup';
      case 'Account Staff': return 'Acc Sup';
      case 'Ops Sup':
      case 'Acc Sup':
      case 'IT Dev': return 'Manager';
      case 'HR': return 'Admin Manager';
      case 'Admin Manager': return 'HR';
      default: return 'Manager';
    }
  }

  private deductCredits(leaveType: string, days: number, name: string) {
    // We find the user being approved, not necessarily the one logged in
    const targetUser = this.users.find(u => u.name === name);
    if (!targetUser) return;

    let key: 'paidLeave' | 'sickLeave' | 'birthdayLeave';
    if (leaveType === 'Paid Leave') key = 'paidLeave';
    else if (leaveType === 'Sick Leave') key = 'sickLeave';
    else key = 'birthdayLeave';

    targetUser.credits[key] = Math.max(0, targetUser.credits[key] - days);

    // If the person being approved is the one currently logged in, update their view too
    const currentUser = this.currentUserSubject.value;
    if (currentUser && currentUser.name === name) {
      this.currentUserSubject.next({ ...targetUser });
      localStorage.setItem(this.USER_KEY, JSON.stringify(targetUser));
    }
  }

  // Getter for the HR/Manager to see the whole team
  get allStaff() {
    return this.users;
  }
}