import { Injectable, inject, OnDestroy } from '@angular/core';
import { 
  Firestore, 
  collection, 
  query, 
  orderBy,
  limit,
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  Unsubscribe
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, of, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth';

// Limit for initial load - loads most recent 100 requests
const REQUESTS_LIMIT = 100;

@Injectable({
  providedIn: 'root'
})
export class LeaveService implements OnDestroy {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  // Live Stream of all requests using BehaviorSubject
  private requestsSubject = new BehaviorSubject<any[]>([]);
  requests$: Observable<any[]> = this.requestsSubject.asObservable();
  
  private unsubscribe: Unsubscribe | null = null;
  private authSubscription: Subscription | null = null;
  
  // Track current user UID to detect user switches
  private currentUserUid: string | null = null;

  constructor() {
    // Initialize listener when user is authenticated - runs continuously to handle user switches
    this.authSubscription = this.authService.fbUser$.subscribe(fbUser => {
      if (fbUser) {
        // Re-initialize listener when user changes (login/logout/login as different user)
        if (this.currentUserUid !== fbUser.uid) {
          this.currentUserUid = fbUser.uid;
          this.initializeRealTimeListener();
        }
      } else {
        this.stopRealTimeListener();
        this.requestsSubject.next([]);
        this.currentUserUid = null;
      }
    });
  }

  private initializeRealTimeListener() {
    // Stop existing listener if any
    this.stopRealTimeListener();
    
    const requestsRef = collection(this.firestore, 'leaveRequests');
    // Add limit to prevent loading too many documents
    const q = query(requestsRef, orderBy('dateFiled', 'desc'), limit(REQUESTS_LIMIT));
    
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.requestsSubject.next(requests);
    });
  }

  private stopRealTimeListener() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  ngOnDestroy() {
    this.stopRealTimeListener();
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }
  }

  private async fetchAllRequests(): Promise<any[]> {
    const requestsRef = collection(this.firestore, 'leaveRequests');
    const snapshot = await getDocs(requestsRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // 2. Submit a new request to Firestore
  async addRequest(requestData: any) {
    const user = this.authService.currentUser;
    if (!user) throw new Error('Must be logged in to submit a request');

    const requestCollection = collection(this.firestore, 'leaveRequests');
    
    // We enrich the data here so the Dashboard knows who owns the request
    const enrichedRequest = {
      ...requestData,
      period: `${requestData.startDate} to ${requestData.endDate}`,
      uid: user.uid,
      employeeName: user.name,
      employeeId: user.employeeId || user.id,
      role: user.role,
      department: user.department,
      status: 'Pending',
      dateFiled: new Date().toISOString(),
      targetReviewer: this.getInitialReviewer(user.role)
    };

    return addDoc(requestCollection, enrichedRequest);
  }

  // 3. Update status (Approved/Rejected)
  async updateRequestStatus(requestId: string, newStatus: string, reviewerRole: string) {
    const requestDocRef = doc(this.firestore, `leaveRequests/${requestId}`);
    
    // Fetch the request to determine the employee's role
    const requestDoc = await getDoc(requestDocRef);
    const requestData = requestDoc.data();
    const employeeRole = (requestData?.['role'] || '').toUpperCase();
    
    const updateData: any = { status: newStatus };

    // Business Logic: Multi-level approval flow
    // Operations Admin staff: Ops Admin Supervisor → HR
    // Accounts staff: Account Supervisor → HR
    // Operations Admin Supervisor / Account Supervisor / IT Dev → Admin Manager → HR
    // HR → Admin Manager (HR NOT reviewed again after Admin Manager approval)
    // Admin Manager → HR (Admin Manager needs HR approval)
    if (newStatus === 'Approved') {
      const reviewerRoleLower = reviewerRole.toLowerCase();
      
      // Handle Operations Admin Supervisor approval
      if (reviewerRoleLower === 'operations admin supervisor') {
        // Ops Admin Supervisor approved - needs HR approval next
        updateData.status = 'Awaiting HR Approval';
        updateData.targetReviewer = 'HR';
      }
      // Handle Account Supervisor approval
      else if (reviewerRoleLower === 'account supervisor') {
        // Account Supervisor approved - needs HR approval next
        updateData.status = 'Awaiting HR Approval';
        updateData.targetReviewer = 'HR';
      }
      else if (reviewerRoleLower === 'admin manager') {
        // Admin Manager approved
        // Check if employee's role skips the HR review step:
        // - HR role: doesn't need another HR review (already reviewed by Admin Manager)
        // - Admin Manager role: doesn't need another Admin Manager review
        const skipsHrReview = (employeeRole === 'HR' || employeeRole === 'HUMAN RESOURCE OFFICER' || employeeRole === 'ADMIN MANAGER');
        
        if (skipsHrReview) {
          // Final approval - no more steps needed
          updateData.targetReviewer = 'None';
        } else {
          // Needs HR approval
          updateData.status = 'Awaiting HR Approval';
          updateData.targetReviewer = 'HR';
        }
      } else if (reviewerRoleLower === 'hr') {
        // HR approved → final approval
        updateData.targetReviewer = 'None';
      }
    } else if (newStatus === 'Rejected') {
      updateData.targetReviewer = 'None';
    }

    return updateDoc(requestDocRef, updateData);
  }

  private getInitialReviewer(role: string): string {
    const r = role.toUpperCase();
    // Map to handle various case formats and role names from database
    const reviewerMap: { [key: string]: string } = {
      // OPERATIONS ADMIN SUPERVISOR and ACCOUNT SUPERVISOR go to ADMIN MANAGER, then to HR
      'OPERATIONS ADMIN SUPERVISOR': 'Admin Manager',
      'ACCOUNT SUPERVISOR': 'Admin Manager',
      // Operations Admin staff go to OPERATIONS ADMIN SUPERVISOR
      'ADMIN OPERATION OFFICER': 'Operations Admin Supervisor',
      'ADMIN OPERATION ASSISTANT': 'Operations Admin Supervisor',
      // Accounts staff go to ACCOUNT SUPERVISOR
      'ACCOUNTING CLERK': 'Account Supervisor',
      'ACCOUNT RECEIVABLE SPECIALIST': 'Account Supervisor',
      'ACCOUNT PAYABLES SPECIALIST': 'Account Supervisor',
      // IT staff go to Admin Manager, then to HR
      'SENIOR IT DEVELOPER': 'Admin Manager',
      'IT ASSISTANT': 'Admin Manager',
      'IT DEVELOPER': 'Admin Manager',
      // HR goes to Admin Manager (HR NOT reviewed again after Admin Manager approval)
      'HUMAN RESOURCE OFFICER': 'Admin Manager',
      'HR': 'Admin Manager',
      // Admin Manager goes to HR (Admin Manager needs HR approval)
      'ADMIN MANAGER': 'HR',
      // Part-time employees go directly to HR
      'PART-TIME': 'HR'
    };
    // Try exact match first, then uppercase match
    if (reviewerMap[role]) return reviewerMap[role];
    if (reviewerMap[r]) return reviewerMap[r];
    // Default: go to HR
    return 'HR';
  }
}