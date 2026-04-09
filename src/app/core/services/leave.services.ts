import { Injectable, inject, OnDestroy } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  Unsubscribe,
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, of, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService, calculatePaidTimeOff } from './auth';
import { NotificationService } from './notification.service';

// Limit for initial load - loads most recent 500 requests to ensure all records are captured
const REQUESTS_LIMIT = 500;

@Injectable({
  providedIn: 'root',
})
export class LeaveService implements OnDestroy {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  // Live Stream of all requests using BehaviorSubject
  private requestsSubject = new BehaviorSubject<any[]>([]);
  requests$: Observable<any[]> = this.requestsSubject.asObservable();

  private unsubscribe: Unsubscribe | null = null;
  private authSubscription: Subscription | null = null;

  // Track current user UID to detect user switches
  private currentUserUid: string | null = null;

  constructor() {
    // Initialize listener when user is authenticated - runs continuously to handle user switches
    this.authSubscription = this.authService.fbUser$.subscribe((fbUser) => {
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
      const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
      targetReviewer: this.getInitialReviewer(user.role),
    };

    const docRef = await addDoc(requestCollection, enrichedRequest);

    // Create notification for supervisors
    console.log('[LeaveService] Creating notification, user.role:', user.role, 'user.name:', user.name);
    try {
      await this.notificationService.notifyNewLeaveRequest(
        user.name,
        user.uid,
        requestData.type,
        enrichedRequest.period,
        user.role
      );
      console.log('[LeaveService] Notification created successfully');
    } catch (err) {
      console.error('[LeaveService] Failed to create notification:', err);
    }

    return docRef;
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
      } else if (reviewerRoleLower === 'admin manager') {
        // Admin Manager approved
        // Check if employee's role skips the HR review step:
        // - HR role: doesn't need another HR review (already reviewed by Admin Manager)
        // - Admin Manager role: doesn't need another Admin Manager review
        const skipsHrReview =
          employeeRole === 'HR' ||
          employeeRole === 'HUMAN RESOURCE OFFICER' ||
          employeeRole === 'ADMIN MANAGER';

        if (skipsHrReview) {
          // Final approval - no more steps needed
          updateData.targetReviewer = 'None';
        } else {
          // Needs HR approval
          updateData.status = 'Awaiting HR Approval';
          updateData.targetReviewer = 'HR';
        }
      } else if (reviewerRoleLower === 'hr' || reviewerRoleLower.includes('human resource')) {
        // HR approved → final approval
        updateData.targetReviewer = 'None';

        // Deduct leave balance only on FINAL approval (when HR gives final approval)
        // Only deduct for Paid Time Off (not Leave Without Pay, birthday, etc.)
        await this.deductLeaveBalance(requestData);

        // Clear the user profile cache so the dashboard sees updated balance immediately
        this.authService.clearCache();

        // Sync user metadata to keep leaveBalanceNote in sync
        if (requestData?.['employeeId']) {
          await this.syncUserMetadata(requestData['employeeId']);
        }
      }

      // Note: Balance deduction on intermediate approvals was removed
      // Balance is now deducted only when HR gives final approval
    } else if (newStatus === 'Rejected') {
      // Include reviewer role in rejection status to track who rejected
      updateData.status = `Rejected by ${reviewerRole}`;
      updateData.targetReviewer = 'None';
    }

    return updateDoc(requestDocRef, updateData);
  }

  // Cancel a pending request
  async cancelRequest(
    requestId: string,
    cancelledBy: string = 'Employee',
    cancellationReason: string = '',
  ) {
    const requestDocRef = doc(this.firestore, `leaveRequests/${requestId}`);
    // Get the current document to preserve previous status
    const docSnap = await getDoc(requestDocRef);
    const currentData = docSnap.exists() ? docSnap.data() : {};

    // Restore leave balance if this was an approved leave
    await this.restoreLeaveBalance(currentData);

    // Sync user metadata to keep leaveBalanceNote in sync
    if (currentData?.['employeeId']) {
      await this.syncUserMetadata(currentData['employeeId']);
    }

    return updateDoc(requestDocRef, {
      status: 'Cancelled',
      targetReviewer: 'None',
      dateCancelled: new Date().toISOString(),
      cancelledBy: cancelledBy,
      cancellationReason: cancellationReason,
      // Save previous state for audit trail
      previousStatus: currentData?.['status'] || null,
      previousTargetReviewer: currentData?.['targetReviewer'] || null,
    });
  }

  // Restore leave balance when leave is cancelled
  private async restoreLeaveBalance(requestData: any) {
    if (!requestData) return;

    const leaveType = requestData['type'] || '';
    const status = requestData['status'] || '';

    // Only restore balance if leave was previously approved (not pending)
    if (status !== 'Approved') return;

    // Only restore for Paid Time Off and Sick Leave
    const leaveTypeLower = leaveType.toLowerCase();
    if (!leaveTypeLower.includes('paid time off') && !leaveTypeLower.includes('sick leave')) return;

    const employeeId = requestData['employeeId'];

    if (!employeeId) {
      console.log('Cannot restore leave: no employeeId found');
      return;
    }

    // Find the employee's user document
    const usersRef = collection(this.firestore, 'users');
    const userQuery = query(usersRef, where('employeeId', '==', employeeId));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.log(`Cannot restore leave: employee not found with ID ${employeeId}`);
      return;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const role = userData['role'] || '';
    const joinedDate = userData['joinedDate'];

    // Calculate total credits using the proper formula
    const totalCredits = calculatePaidTimeOff(joinedDate, role);

    // Get all approved leave requests to calculate used days from scratch
    const requestsRef = collection(this.firestore, 'leaveRequests');
    const requestsQuery = query(
      requestsRef,
      where('employeeId', '==', employeeId),
      where('status', '==', 'Approved'),
    );
    const requestsSnapshot = await getDocs(requestsQuery);

    let usedDays = 0;
    for (const reqDoc of requestsSnapshot.docs) {
      const reqData = reqDoc.data();
      const reqLeaveType = (reqData['type'] || '').toLowerCase();
      if (reqLeaveType.includes('paid time off') || reqLeaveType.includes('sick leave')) {
        const days = reqData['daysDeducted'] ?? reqData['noOfDays'] ?? 1;
        usedDays += days;
      }
    }

    // Calculate new balance
    const newBalance = Math.max(0, totalCredits - usedDays);

    // Update the user's leave balance with consistent format
    const userRef = doc(this.firestore, 'users', userDoc.id);
    await updateDoc(userRef, {
      leaveBalance: newBalance,
      leaveBalanceNote: `Total: ${totalCredits}, Used: ${usedDays}, Remaining: ${newBalance}`,
    });

    console.log(
      `Restored leave for ${employeeId}. Total: ${totalCredits}, Used: ${usedDays}, Remaining: ${newBalance}`,
    );
  }

  // Deduct leave balance when leave is approved
  private async deductLeaveBalance(requestData: any) {
    if (!requestData) return;

    const leaveType = requestData['type'] || '';

    // Exclude Birthday Leave - it should NOT deduct from balance
    if (leaveType === 'Birthday Leave') {
      return;
    }

    // Only deduct for Paid Time Off and Sick Leave (they share the same balance)
    const leaveTypeLower = leaveType.toLowerCase();
    if (!leaveTypeLower.includes('paid time off') && !leaveTypeLower.includes('sick leave')) {
      return;
    }

    // Get the number of days to deduct - use daysDeducted (0.5/1.0) if available
    const noOfDays = requestData['daysDeducted'] ?? requestData['noOfDays'] ?? 1;
    const employeeId = requestData['employeeId'];

    if (!employeeId) {
      console.log('Cannot deduct leave: no employeeId found');
      return;
    }

    // Find the employee's user document
    const usersRef = collection(this.firestore, 'users');
    const userQuery = query(usersRef, where('employeeId', '==', employeeId));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.log(`Cannot deduct leave: employee not found with ID ${employeeId}`);
      return;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const role = userData['role'] || '';
    const joinedDate = userData['joinedDate'];

    // Calculate total credits using the proper formula
    const totalCredits = calculatePaidTimeOff(joinedDate, role);

    // Get all approved leave requests to calculate used days from scratch
    const requestsRef = collection(this.firestore, 'leaveRequests');
    const requestsQuery = query(
      requestsRef,
      where('employeeId', '==', employeeId),
      where('status', '==', 'Approved'),
    );
    const requestsSnapshot = await getDocs(requestsQuery);

    let usedDays = 0;
    for (const reqDoc of requestsSnapshot.docs) {
      const reqData = reqDoc.data();
      const reqLeaveType = (reqData['type'] || '').toLowerCase();
      if (reqLeaveType.includes('paid time off') || reqLeaveType.includes('sick leave')) {
        const days = reqData['daysDeducted'] ?? reqData['noOfDays'] ?? 1;
        usedDays += days;
      }
    }

    // Calculate new balance
    const newBalance = Math.max(0, totalCredits - usedDays);

    // Update the user's leave balance with consistent format
    const userRef = doc(this.firestore, 'users', userDoc.id);
    await updateDoc(userRef, {
      leaveBalance: newBalance,
      leaveBalanceNote: `Total: ${totalCredits}, Used: ${usedDays}, Remaining: ${newBalance}`,
    });

    console.log(
      `Deducted leave for ${employeeId}. Total: ${totalCredits}, Used: ${usedDays}, Remaining: ${newBalance}`,
    );
  }

  private getInitialReviewer(role: string): string {
    // Normalize: uppercase, trim, and collapse multiple spaces to single space
    const r = role.toUpperCase().trim().replace(/\s+/g, ' ');

    // Map to handle various case formats and role names from database
    const reviewerMap: { [key: string]: string } = {
      // OPERATIONS ADMIN SUPERVISOR and ACCOUNT SUPERVISOR go to ADMIN MANAGER, then to HR
      'OPERATIONS ADMIN SUPERVISOR': 'Admin Manager',
      'ACCOUNT SUPERVISOR': 'Admin Manager',
      // Operations Admin staff go to OPERATIONS ADMIN SUPERVISOR
      'ADMIN OPERATION OFFICER': 'Operations Admin Supervisor',
      'ADMIN OPERATION ASSISTANT': 'Operations Admin Supervisor',
      'ADMIN COMPLIANCE OFFICER': 'Operations Admin Supervisor',
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
      HR: 'Admin Manager',
      // Admin Manager goes to HR (Admin Manager needs HR approval)
      'ADMIN MANAGER': 'HR',
      // Part-time employees go directly to HR
      'PART-TIME': 'HR',
    };

    // Try uppercase match first (most common case from database)
    if (reviewerMap[r]) {
      console.log('Found match for uppercase role:', r, '-> reviewer:', reviewerMap[r]);
      return reviewerMap[r];
    }
    // Try exact match as fallback
    if (reviewerMap[role]) {
      console.log('Found match for exact role:', role, '-> reviewer:', reviewerMap[role]);
      return reviewerMap[role];
    }
    // Default: go to HR

    return 'HR';
  }

  async syncUserMetadata(employeeId: string): Promise<void> {
    const usersRef = collection(this.firestore, 'users');
    const userQuery = query(usersRef, where('employeeId', '==', employeeId));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.log(`Cannot sync metadata: employee not found with ID ${employeeId}`);
      return;
    }

    const userDoc = userSnapshot.docs[0];
    const userDocRef = doc(this.firestore, 'users', userDoc.id);
    const userData = userDoc.data();
    const role = userData['role'] || '';
    const joinedDate = userData['joinedDate'];

    const totalCredits = calculatePaidTimeOff(joinedDate, role);

    const requestsRef = collection(this.firestore, 'leaveRequests');
    const requestsQuery = query(
      requestsRef,
      where('employeeId', '==', employeeId),
      where('status', '==', 'Approved'),
    );
    const requestsSnapshot = await getDocs(requestsQuery);

    let usedDays = 0;
    for (const reqDoc of requestsSnapshot.docs) {
      const reqData = reqDoc.data();
      const leaveType = (reqData['type'] || '').toLowerCase();
      if (leaveType.includes('paid time off') || leaveType.includes('sick leave')) {
        const days = reqData['daysDeducted'] ?? reqData['noOfDays'] ?? 1;
        usedDays += days;
      }
    }

    const newBalance = Math.max(0, totalCredits - usedDays);

    await updateDoc(userDocRef, {
      leaveBalance: newBalance,
      leaveBalanceNote: `Total: ${totalCredits}, Used: ${usedDays}, Remaining: ${newBalance}`,
    });

    console.log(
      `Synced metadata for employee ${employeeId}: Total: ${totalCredits}, Used: ${usedDays}, Remaining: ${newBalance}`,
    );
  }
}
