import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import { Auth, user, User as FirebaseUser, signOut, signInWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs, doc, docData, updateDoc } from '@angular/fire/firestore';
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
  employeeId?: string;  // Employee ID like "CLS-ADM00046"
  name: string;
  role: string;
  department: string;
  dept?: string;        // Alternative field name
  email: string;
  birthday?: string; // For birthday leave availability
  joinedDate?: string; // ISO date string for calculating years of service
  gender?: 'male' | 'female'; // For maternity/paternity leave visibility
  birthdayLeave: number;
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
  BIRTHDAY_LEAVE: 'Birthday Leave',
  MATERNITY_LEAVE: 'Maternity Leave',
  PATERNITY_LEAVE: 'Paternity Leave',
  LEAVE_WITHOUT_PAY: 'Leave Without Pay'
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
  
  // Years of Service Credit Entitlement
  // Upon 1 yr. in Service: 5 Days
  // 2nd Year of Service: 7 Days
  // 4 Years and above: 8 Days
  if (yearsOfService >= 4) {
    return 8;
  } else if (yearsOfService >= 2) {
    return 7;
  } else if (yearsOfService >= 1) {
    return 5;
  }
  
  return 0; // Less than 1 year - no PTO credits
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
export function canFilePaidLeave(joinedDate: string | undefined, department: string | undefined, role: string): boolean {
  // Supervisors, Admin Manager, HR always can (but Managing Director doesn't need to file)
  const roleUpper = role.toUpperCase();
  if (roleUpper === 'ADMIN MANAGER' || roleUpper === 'ACCOUNT SUPERVISOR' || 
      roleUpper === 'OPERATIONS ADMIN SUPERVISOR' || roleUpper === 'HR' || 
      roleUpper === 'HUMAN RESOURCE OFFICER') {
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
export function canFileMaternityPaternity(department: string | undefined, gender: string | undefined): boolean {
  // Part-time employees cannot
  if (isPartTimeEmployee(department)) {
    return false;
  }
  // Must have gender specified
  if (!gender) return false;
  const g = gender.toLowerCase().trim();
  return g === 'male' || g === 'female';
}

// Cache for user profile to avoid repeated Firestore queries
let userProfileCache: { user: User | null; email: string | null; timestamp: number } = {
  user: null,
  email: null,
  timestamp: 0
};
const CACHE_DURATION = 60000; // 1 minute cache

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
      this.authSubscription = this.fbUser$.pipe(
        switchMap(fbUser => {
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
          if (userProfileCache.email === fbUser.email && 
              userProfileCache.user && 
              now - userProfileCache.timestamp < CACHE_DURATION) {
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
              setTimeout(() => reject(new Error('Firestore query timeout')), 10000)
            )
          ]);
          
          return from(queryWithTimeout).pipe(
            map(snapshot => {
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
                // Government IDs
                tin: userDoc['tin'] || undefined,
                sss: userDoc['sss'] || undefined,
                philhealth: userDoc['philhealth'] || undefined,
                pagibig: userDoc['pagibig'] || undefined
              };
              
              // Update cache
              userProfileCache = {
                user: transformedUser,
                email: fbUser.email,
                timestamp: now
              };
              
              this.isLoadingSubject.next(false);
              return transformedUser;
            }),
            catchError(err => {
              this.isLoadingSubject.next(false);
              this.currentUserSubject.next(null);
              return of(null);
            })
          );
        }),
        map(user => {
          this.currentUserSubject.next(user);
          return user;
        })
      ).subscribe();
    });
  }
  
  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  async login(email: string, pass: string): Promise<boolean> {
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
}