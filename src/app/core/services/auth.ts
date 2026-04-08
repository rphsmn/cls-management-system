import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import {
  Auth,
  user,
  User as FirebaseUser,
  signOut,
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  docData,
  updateDoc,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, of, from, Subscription } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { calculateWorkdays } from '../utils/workday-calculator.util';

export interface Attachment {
  name: string;
  data: string;
  type: string;
}

export interface User {
  uid: string;
  id: string;
  employeeId?: string; // Employee ID like "CLS-ADM00046"
  name: string;
  role: string;
  department: string;
  dept?: string; // Alternative field name
  email: string;
  birthday?: string; // For birthday leave availability
  joinedDate?: string; // ISO date string for calculating years of service
  gender?: 'male' | 'female'; // For maternity/paternity leave visibility
  birthdayLeave: number;
  sickLeave?: number; // Sick leave balance (default to a fixed number like 10)
  leaveBalance?: number; // Stored leave balance (years of service + 1 extra)
  // Government IDs
  tin?: string; // Tax Identification Number
  sss?: string; // Social Security System
  philhealth?: string; // PhilHealth number
  pagibig?: string; // Pag-IBIG number
  // Note: paidTimeoff is calculated dynamically based on joinedDate and role
  // Note: others (maternity/paternity) is fixed based on gender
}

// Constants for leave types
export const LEAVE_TYPES = {
  PAID_TIME_OFF: 'Paid Time Off',
  SICK_LEAVE: 'Sick Leave',
  BIRTHDAY_LEAVE: 'Birthday Leave',
  MATERNITY_LEAVE: 'Maternity Leave',
  PATERNITY_LEAVE: 'Paternity Leave',
  LEAVE_WITHOUT_PAY: 'Leave Without Pay',
} as const;

// Calculate Paid Time Off based on years of service and role
export function calculatePaidTimeOff(joinedDate: string | undefined, role: string): number {
  // ADMIN MANAGER and ACCOUNT SUPERVISOR get fixed 10 days
  if (role === 'ADMIN MANAGER' || role === 'ACCOUNT SUPERVISOR') {
    return 10;
  }

  if (!joinedDate) return 0;

  // Handle both Firestore Timestamp and string date formats
  const getDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue.toDate) return dateValue.toDate(); // Firestore Timestamp
    if (typeof dateValue === 'string' || dateValue instanceof Date) return new Date(dateValue);
    return new Date();
  };

  const joinDate = getDate(joinedDate);
  // Handle invalid dates explicitly
  if (isNaN(joinDate.getTime())) return 0;

  const today = new Date();
  const yearsOfService = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  // Years of Service Credit Entitlement (BASE - without extra)
  // Upon 1 yr. in Service: 5 Days
  // 2nd Year of Service: 7 Days
  // 4 Years and above: 8 Days
  let baseCredits = 0;
  if (yearsOfService >= 4) {
    baseCredits = 8;
  } else if (yearsOfService >= 2) {
    baseCredits = 7;
  } else if (yearsOfService >= 1) {
    baseCredits = 5;
  }

  // Add 1 extra credit for all employees (regardless of years of service)
  // This means: 1yr = 5+1=6, 2yr+ = 7+1=8, 4yr+ = 8+1=9
  // Admin Manager and Account Supervisor also get 1 extra (making it 10+1=11, but we'll cap at 10)
  let totalCredits = baseCredits + 1;

  // Cap at 10 for Admin Manager and Account Supervisor
  if (role === 'ADMIN MANAGER' || role === 'ACCOUNT SUPERVISOR') {
    totalCredits = Math.min(totalCredits, 10);
  }

  return totalCredits;
}

// Check if employee has completed 1 year of service
export function hasCompletedOneYear(joinedDate: string | undefined): boolean {
  if (!joinedDate) return false;

  // Handle both Firestore Timestamp and string date formats
  const getDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue.toDate) return dateValue.toDate(); // Firestore Timestamp
    if (typeof dateValue === 'string' || dateValue instanceof Date) return new Date(dateValue);
    return new Date();
  };

  const joinDate = getDate(joinedDate);
  // Handle invalid dates explicitly
  if (isNaN(joinDate.getTime())) return false;

  const today = new Date();
  const yearsOfService = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  return yearsOfService >= 1;
}

// Check if employee is part-time (based on department)
export function isPartTimeEmployee(department: string | undefined): boolean {
  if (!department) return false;
  // Normalize: remove hyphens and spaces, convert to lowercase for consistent comparison
  const dept = department.toLowerCase().replace(/[-\s]/g, '');
  return dept === 'parttime';
}

// Check if employee can file paid leaves (Paid Time Off)
// Part-time employees and those with < 1 year service cannot file PTO
// Managing Director does not need to file leaves
export function canFilePaidLeave(
  joinedDate: string | undefined,
  department: string | undefined,
  role: string,
): boolean {
  // Supervisors, Admin Manager, HR always can (but Managing Director doesn't need to file)
  const roleUpper = role.toUpperCase();
  if (
    roleUpper === 'ADMIN MANAGER' ||
    roleUpper === 'ACCOUNT SUPERVISOR' ||
    roleUpper === 'OPERATIONS ADMIN SUPERVISOR' ||
    roleUpper === 'HR' ||
    roleUpper === 'HUMAN RESOURCE OFFICER'
  ) {
    return true;
  }
  // Part-time employees cannot
  if (isPartTimeEmployee(department)) {
    return false;
  }
  // Must have completed 1 year
  return hasCompletedOneYear(joinedDate);
}

// Check if employee can file maternity/paternity leave
// Based on gender and part-time status
export function canFileMaternityPaternity(
  department: string | undefined,
  gender: string | undefined,
): boolean {
  // Part-time employees cannot
  if (isPartTimeEmployee(department)) {
    return false;
  }
  // Must have gender specified
  if (!gender) return false;
  const g = gender.toLowerCase().trim();
  return g === 'male' || g === 'female';
}

// Check if employee can file Sick Leave
// All employees can file Sick Leave (no 1 year requirement), except Managing Director
export function canFileSickLeave(role: string): boolean {
  // Managing Director cannot file leaves at all
  if (role.toUpperCase() === 'MANAGING DIRECTOR') {
    return false;
  }
  return true;
}

// Cache for user profile to avoid repeated Firestore queries
let userProfileCache: { user: User | null; email: string | null; timestamp: number } = {
  user: null,
  email: null,
  timestamp: 0,
};
const CACHE_DURATION = 10000; // 10 seconds cache for faster updates

// Clear cache function
function clearUserProfileCache() {
  userProfileCache = { user: null, email: null, timestamp: 0 };
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  public fbUser$: Observable<FirebaseUser | null> = user(this.auth);
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(true);

  // Observable for loading state
  isLoading$ = this.isLoadingSubject.asObservable();

  // 1. The Observable for async pipes in HTML
  currentUser$ = this.currentUserSubject.asObservable();

  // 2. THE FIX: The Getter for direct access in TS files (Guards, Services)
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Sync user metadata - recalculates leave balance from leaveRequests and updates Firestore
  // This ensures leaveBalanceNote is always congruent with actual leave data
  async syncUserMetadata(user: User): Promise<void> {
    if (!user || !user.employeeId) return;

    try {
      const usersRef = collection(this.firestore, 'users');
      const userQuery = query(usersRef, where('employeeId', '==', user.employeeId));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) return;

      const userDoc = userSnapshot.docs[0];

      // Get all leave requests for this user
      const requestsRef = collection(this.firestore, 'leaveRequests');
      const requestsQuery = query(requestsRef, where('employeeId', '==', user.employeeId));
      const requestsSnapshot = await getDocs(requestsQuery);

      // Calculate total used from approved Paid Time Off + Sick Leave
      let usedDays = 0;
      requestsSnapshot.docs.forEach((reqDoc) => {
        const reqData = reqDoc.data();
        if (
          reqData['status'] === 'Approved' &&
          (reqData['type'] === 'Paid Time Off' || reqData['type'] === 'Sick Leave')
        ) {
          usedDays += reqData['daysDeducted'] || 0;
        }
      });

      // Calculate total credits based on role and years of service
      const totalCredits = calculatePaidTimeOff(user.joinedDate, user.role);
      const remaining = Math.max(0, totalCredits - usedDays);

      // Update Firestore with current data
      await updateDoc(doc(this.firestore, 'users', userDoc.id), {
        leaveBalance: remaining,
        leaveBalanceNote: `Total: ${totalCredits}, Used: ${usedDays}, Remaining: ${remaining}`,
      });

      console.log(
        `[Sync] ${user.name}: Total: ${totalCredits}, Used: ${usedDays}, Remaining: ${remaining}`,
      );
    } catch (error) {
      console.error('[Sync] Error syncing user metadata:', error);
    }
  }

  private authSubscription: Subscription | null = null;
  private initialized = false;

  constructor() {
    // Don't initialize Firebase subscription here - it causes issues with injection context
    // The subscription will be initialized when ngOnInit is called
    // For now, set initial loading to false so the app can boot
    this.isLoadingSubject.next(false);
  }

  /**
   * Initialize the Firebase auth subscription.
   * This must be called after Angular is fully bootstrapped to avoid injection context issues.
   * Call this in the app component's ngOnInit.
   */
  initializeAuthSubscription(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Run Firebase subscription inside Angular's zone to ensure proper change detection
    this.ngZone.run(() => {
      this.authSubscription = this.fbUser$
        .pipe(
          switchMap((fbUser) => {
            // Immediately set loading true when auth state changes
            this.isLoadingSubject.next(true);

            if (!fbUser) {
              this.currentUserSubject.next(null);
              this.isLoadingSubject.next(false);
              clearUserProfileCache();
              return of(null);
            }

            // Check cache before making Firestore query
            // Always clear cache if email changed (different user logging in)
            const now = Date.now();
            if (
              userProfileCache.email === fbUser.email &&
              userProfileCache.user &&
              now - userProfileCache.timestamp < CACHE_DURATION
            ) {
              this.isLoadingSubject.next(false);
              return of(userProfileCache.user);
            }

            // Clear stale cache for different user
            if (userProfileCache.email !== fbUser.email) {
              clearUserProfileCache();
            }

            // Query users collection by email with timeout
            const usersRef = collection(this.firestore, 'users');
            const q = query(usersRef, where('email', '==', fbUser.email));

            // Create a promise that rejects after 10 seconds to prevent hanging
            const queryWithTimeout = Promise.race([
              getDocs(q),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Firestore query timeout')), 10000),
              ),
            ]);

            return from(queryWithTimeout).pipe(
              map((snapshot) => {
                if (snapshot.empty) {
                  this.isLoadingSubject.next(false);
                  return null;
                }

                // Get the first matching document
                const userDoc = snapshot.docs[0].data();
                const docId = snapshot.docs[0].id;

                // Transform the data to match our User interface
                const transformedUser: User = {
                  uid: fbUser.uid,
                  id: docId,
                  employeeId: userDoc['employeeId'] || undefined,
                  name: userDoc['name'] || '',
                  role: userDoc['role'] || '',
                  department: userDoc['department'] || userDoc['dept'] || '',
                  email: userDoc['email'] || fbUser.email || '',
                  birthday: userDoc['birthday'] || undefined,
                  joinedDate: userDoc['joinedDate'] || undefined,
                  gender: userDoc['gender'] || undefined,
                  birthdayLeave: userDoc['birthdayLeave'] || userDoc['birthdayleave'] || 1,
                  sickLeave: userDoc['sickLeave'] !== undefined ? userDoc['sickLeave'] : 10, // Default 10 days sick leave
                  leaveBalance:
                    userDoc['leaveBalance'] !== undefined ? userDoc['leaveBalance'] : undefined,
                  // Government IDs
                  tin: userDoc['tin'] || undefined,
                  sss: userDoc['sss'] || undefined,
                  philhealth: userDoc['philhealth'] || undefined,
                  pagibig: userDoc['pagibig'] || undefined,
                };

                // Update cache
                userProfileCache = {
                  user: transformedUser,
                  email: fbUser.email,
                  timestamp: now,
                };

                this.isLoadingSubject.next(false);
                return transformedUser;
              }),
              catchError((err) => {
                this.isLoadingSubject.next(false);
                this.currentUserSubject.next(null);
                return of(null);
              }),
            );
          }),
          map((user) => {
            this.currentUserSubject.next(user);
            // Sync user metadata when user loads (self-healing for manual Firestore edits)
            if (user) {
              this.syncUserMetadata(user);
            }
            return user;
          }),
        )
        .subscribe();
    });
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  async login(email: string, pass: string, rememberMe: boolean = false): Promise<boolean> {
    // Set persistence before signing in
    // LOCAL = persists until explicitly logged out (Remember Me checked)
    // SESSION = persists only for current session/tab (Remember Me unchecked)
    await setPersistence(
      this.auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence,
    );

    // Immediately set loading to true to show authenticating state
    this.isLoadingSubject.next(true);

    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
      // Firebase auth succeeded - the subscription will handle setting loading to false
      // after fetching the user profile from Firestore
      return true;
    } catch (error) {
      // Reset loading state on auth failure
      this.isLoadingSubject.next(false);
      return false;
    }
  }

  async logout() {
    try {
      // Immediately set loading to false to unblock UI
      this.isLoadingSubject.next(false);
      // Clear user state immediately to prevent stale data in guards
      this.currentUserSubject.next(null);
      // Clear cache on logout to prevent stale data when logging in as different user
      clearUserProfileCache();

      // Sign out from Firebase
      await signOut(this.auth);
    } catch (error) {
      // Ensure loading is reset even if signOut fails
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Force refresh user profile from Firestore (bypasses cache)
   * Useful when user data has been updated in Firestore
   */
  async refreshUserProfile(): Promise<void> {
    const fbUser = this.currentUser;
    if (!fbUser) return;

    // Clear cache to force fresh data
    clearUserProfileCache();

    // Re-fetch user profile
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('email', '==', fbUser.email));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0].data();
      const docId = snapshot.docs[0].id;

      const transformedUser: User = {
        uid: fbUser.uid,
        id: docId,
        employeeId: userDoc['employeeId'] || undefined,
        name: userDoc['name'] || '',
        role: userDoc['role'] || '',
        department: userDoc['department'] || userDoc['dept'] || '',
        email: userDoc['email'] || fbUser.email || '',
        birthday: userDoc['birthday'] || undefined,
        joinedDate: userDoc['joinedDate'] || undefined,
        gender: userDoc['gender'] || undefined,
        birthdayLeave: userDoc['birthdayLeave'] || userDoc['birthdayleave'] || 1,
        sickLeave: userDoc['sickLeave'] !== undefined ? userDoc['sickLeave'] : 10,
        leaveBalance: userDoc['leaveBalance'] !== undefined ? userDoc['leaveBalance'] : undefined,
        tin: userDoc['tin'] || undefined,
        sss: userDoc['sss'] || undefined,
        philhealth: userDoc['philhealth'] || undefined,
        pagibig: userDoc['pagibig'] || undefined,
      };

      // Update cache and subject
      userProfileCache = {
        user: transformedUser,
        email: fbUser.email,
        timestamp: Date.now(),
      };
      this.currentUserSubject.next(transformedUser);
    }
  }

  async deductCredits(userUid: string, leaveType: string, period: string) {
    const userProfile = this.currentUser; // Uses the getter
    if (!userProfile) return;

    const holidayList = JSON.parse(localStorage.getItem('company_holidays') || '[]');
    const daysToDeduct = calculateWorkdays(period, holidayList);

    // Only deduct from birthday leave - Paid Time Off is not stored, it's calculated dynamically
    if (leaveType === LEAVE_TYPES.BIRTHDAY_LEAVE) {
      const newBirthdayLeave = Math.max(0, (userProfile.birthdayLeave || 0) - daysToDeduct);

      const userDocRef = doc(this.firestore, `users/${userUid}`);
      await updateDoc(userDocRef, { birthdayLeave: newBirthdayLeave });
    }
    // Note: Paid Time Off, Maternity, Paternity, Leave Without Pay are not deducted from stored credits
    // They are either unlimited (Leave Without Pay) or managed separately
  }

  clearCache(): void {
    clearUserProfileCache();
  }
}
