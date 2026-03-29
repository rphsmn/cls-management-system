import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, map, combineLatest, of, switchMap, debounceTime, distinctUntilChanged, shareReplay } from 'rxjs';
import { AuthService, calculatePaidTimeOff, hasCompletedOneYear, isPartTimeEmployee, canFilePaidLeave, canFileMaternityPaternity, LEAVE_TYPES } from '../../core/services/auth';
import { LeaveService } from '../../core/services/leave.services';
import { calculateWorkdays } from '../../core/utils/workday-calculator.util';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import Swal from 'sweetalert2';
import confetti from 'canvas-confetti';

interface CompanyStats {
  totalEmployees: number;
  onLeaveToday: number;
  pendingRequests: number;
  upcomingLeaves: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private leaveService = inject(LeaveService);
  private firestore = inject(Firestore);
  
  currentUser$: Observable<any>;
  requests$: Observable<any[]>; 
  companyStats$: Observable<CompanyStats | null>;
  greeting: string = '';
  today: Date = new Date();
  
  // Pre-compute holidays once to avoid repeated localStorage access
  private holidayList: string[] = [];

  constructor() {
    // Load holidays once
    try {
      this.holidayList = JSON.parse(localStorage.getItem('company_holidays') || '[]');
    } catch (e) {
      this.holidayList = [];
    }
    
    // Company Stats for MANAGING DIRECTOR
    this.companyStats$ = combineLatest([
      this.authService.currentUser$,
      this.leaveService.requests$
    ]).pipe(
      debounceTime(100),
      switchMap(async ([user, requests]) => {
        if (!user || user.role !== 'MANAGING DIRECTOR') {
          return null;
        }
        
        // Fetch employee count
        const usersSnapshot = await getDocs(collection(this.firestore, 'users'));
        const totalEmployees = usersSnapshot.size;
        
        // Calculate today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        // Calculate dates for "upcoming" (next 7 days)
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        // Count employees on leave today
        const onLeaveToday = requests.filter(req => {
          if (req.status !== 'Approved' && req.status !== 'Awaiting HR Approval') return false;
          const startDate = new Date(req.startDate);
          const endDate = new Date(req.endDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          return today >= startDate && today <= endDate;
        }).length;
        
        // Count pending requests
        const pendingRequests = requests.filter(req => 
          req.status === 'Pending' || req.status === 'Awaiting HR Approval'
        ).length;
        
        // Count upcoming leaves (next 7 days)
        const upcomingLeaves = requests.filter(req => {
          if (req.status !== 'Approved') return false;
          const startDate = new Date(req.startDate);
          startDate.setHours(0, 0, 0, 0);
          return startDate > today && startDate <= nextWeek;
        }).length;
        
        return {
          totalEmployees,
          onLeaveToday,
          pendingRequests,
          upcomingLeaves
        };
      }),
      shareReplay(1)
    );
    
    // 1. Calculate Credits for the logged-in user using Firestore data
    // Use shareReplay to avoid recalculating for multiple subscribers
    this.currentUser$ = combineLatest([
      this.authService.currentUser$,
      this.leaveService.requests$
    ]).pipe(
      debounceTime(100), // Debounce to prevent rapid recalculations
      map(([user, allRequests]) => {
        if (!user) return null;

        // Filter requests belonging to this user
        const myRequests = allRequests.filter(req => req.uid === user.uid || req.employeeName === user.name);

        // Calculate days from request (using calculateWorkdays for accuracy)
        const calculateDays = (reqList: any[]) => {
          return reqList.reduce((sum, req) => {
            if (req.daysRequested) return sum + req.daysRequested;
            if (req.period) return sum + calculateWorkdays(req.period, this.holidayList);
            return sum + 1;
          }, 0);
        };

        // Check if employee is part-time
        const isPartTime = isPartTimeEmployee(user.department);
        
        // Calculate Paid Time Off dynamically based on joinedDate and role
        // Part-time employees get 0 PTO
        const paidTimeOffTotal = isPartTime ? 0 : calculatePaidTimeOff(user.joinedDate, user.role);
        const hasOneYearCompleted = hasCompletedOneYear(user.joinedDate);
        
        // Check if it's birth month for birthday leave availability
        // Handle both Firestore Timestamp and string date formats
        const getMonth = (dateValue: any): number => {
          if (!dateValue) return -1;
          if (dateValue.toDate) return dateValue.toDate().getMonth(); // Firestore Timestamp
          if (typeof dateValue === 'string' || dateValue instanceof Date) return new Date(dateValue).getMonth();
          return -1;
        };
        const birthMonth = getMonth(user.birthday);
        const currentMonth = new Date().getMonth();
        const isBirthMonth = birthMonth === currentMonth;

        // Get leave type counts
        const paidTimeOffUsed = calculateDays(myRequests.filter(r => r.type === LEAVE_TYPES.PAID_TIME_OFF && r.status === 'Approved'));
        const paidTimeOffPending = calculateDays(myRequests.filter(r => r.type === LEAVE_TYPES.PAID_TIME_OFF && (r.status === 'Pending' || r.status === 'Awaiting HR Approval')));
        
        const birthdayLeaveUsed = calculateDays(myRequests.filter(r => r.type === LEAVE_TYPES.BIRTHDAY_LEAVE && r.status === 'Approved'));
        const birthdayLeavePending = calculateDays(myRequests.filter(r => r.type === LEAVE_TYPES.BIRTHDAY_LEAVE && (r.status === 'Pending' || r.status === 'Awaiting HR Approval')));
        
        const maternityLeaveUsed = calculateDays(myRequests.filter(r => r.type === LEAVE_TYPES.MATERNITY_LEAVE && r.status === 'Approved'));
        const maternityLeavePending = calculateDays(myRequests.filter(r => r.type === LEAVE_TYPES.MATERNITY_LEAVE && (r.status === 'Pending' || r.status === 'Awaiting HR Approval')));
        
        const paternityLeaveUsed = calculateDays(myRequests.filter(r => r.type === LEAVE_TYPES.PATERNITY_LEAVE && r.status === 'Approved'));
        const paternityLeavePending = calculateDays(myRequests.filter(r => r.type === LEAVE_TYPES.PATERNITY_LEAVE && (r.status === 'Pending' || r.status === 'Awaiting HR Approval')));

        return {
          ...user,
          isPartTime,
          // Dynamic Paid Time Off (calculated, not stored)
          paidTimeOff: {
            total: paidTimeOffTotal,
            used: paidTimeOffUsed,
            pending: paidTimeOffPending,
            remaining: paidTimeOffTotal - paidTimeOffUsed
          },
          // Birthday Leave (stored as flat field)
          birthdayLeave: {
            total: user.birthdayLeave || 1,
            used: birthdayLeaveUsed,
            pending: birthdayLeavePending,
            remaining: (user.birthdayLeave || 1) - birthdayLeaveUsed,
            isAvailable: isBirthMonth
          },
          // Others: Maternity/Paternity (based on gender and non part-time)
          others: {
            maternity: {
              total: 105,
              used: maternityLeaveUsed,
              pending: maternityLeavePending,
              remaining: 105 - maternityLeaveUsed,
              isVisible: (user.gender || '').trim().toLowerCase() === 'female' && canFileMaternityPaternity(user.department, user.gender)
            },
            paternity: {
              total: 7,
              used: paternityLeaveUsed,
              pending: paternityLeavePending,
              remaining: 7 - paternityLeaveUsed,
              isVisible: (user.gender || '').trim().toLowerCase() === 'male' && canFileMaternityPaternity(user.department, user.gender)
            }
          },
          // Employee eligibility for filing leaves
          // Managing Director cannot file leaves at all
          canFilePaidLeaves: user.role.toUpperCase() !== 'MANAGING DIRECTOR' && canFilePaidLeave(user.joinedDate, user.department, user.role),
          canFileLeave: user.role.toUpperCase() !== 'MANAGING DIRECTOR' && hasOneYearCompleted,
          isAdminOrSupervisor: ['ADMIN MANAGER', 'ACCOUNT SUPERVISOR', 'OPERATIONS ADMIN SUPERVISOR', 'HR', 'HUMAN RESOURCE OFFICER'].includes(user.role.toUpperCase())
        };
      }),
      shareReplay(1) // Cache the last value for multiple subscribers
    );

    // 2. Personal Activity Stream (Strictly Filtered)
    this.requests$ = this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return this.leaveService.requests$.pipe(
          debounceTime(100),
          map(requests => {
            return requests
              .filter(req => req.uid === user.uid || req.employeeName === user.name)
              .sort((a, b) => new Date(b.dateFiled).getTime() - new Date(a.dateFiled).getTime())
              .slice(0, 5);
          }),
          shareReplay(1)
        );
      })
    );
  }

  ngOnInit() {
    const hour = new Date().getHours();
    if (hour < 12) this.greeting = 'Good Morning';
    else if (hour < 18) this.greeting = 'Good Afternoon';
    else this.greeting = 'Good Evening';
    
    // Check for birthday and show greeting popup
    this.checkBirthday();
  }
  
  private checkBirthday() {
    const user = this.authService.currentUser;
    if (!user || !user.birthday) return;
    
    // Parse birthday and check if it's today
    const birthdayDate = new Date(user.birthday);
    const todayDate = new Date();
    
    // Check if month and day match (ignore year)
    if (birthdayDate.getMonth() === todayDate.getMonth() && 
        birthdayDate.getDate() === todayDate.getDate()) {
      
      // Fire confetti from both sides
      this.fireConfetti();
      
      // Play Happy Birthday audio using YouTube embed (hidden)
      this.playBirthdaySong();
      
      // Show birthday greeting popup with custom design
      Swal.fire({
        title: 'Happy Birthday!',
        html: `
          <div style="
            background: linear-gradient(135deg, #1a5336 0%, #2d7a50 100%);
            border-radius: 16px;
            padding: 32px 24px;
            margin: -24px -24px 20px -24px;
            position: relative;
            overflow: hidden;
          ">
            <div style="
              position: absolute;
              top: 10px;
              left: 20px;
              font-size: 48px;
              opacity: 0.15;
            ">🎂</div>
            <div style="
              position: absolute;
              bottom: -20px;
              right: -10px;
              font-size: 80px;
              opacity: 0.1;
            ">🎈</div>
            <div style="position: relative; z-index: 1; text-align: center;">
              <div style="
                font-size: 56px;
                margin-bottom: 16px;
                text-shadow: 0 4px 20px rgba(0,0,0,0.2);
              ">🎂</div>
              <div style="
                color: white;
                font-size: 22px;
                font-weight: 700;
                margin-bottom: 8px;
                text-shadow: 0 2px 10px rgba(0,0,0,0.2);
              ">${user.name}</div>
              <div style="
                color: rgba(255,255,255,0.9);
                font-size: 14px;
                font-style: italic;
              ">Wishing you all the best today!</div>
            </div>
          </div>
          <div style="
            text-align: center;
            padding: 0 8px;
          ">
            <div style="
              font-size: 16px;
              color: #1a5336;
              font-weight: 600;
              margin-bottom: 8px;
            ">From your Cor Logic Family</div>
            <div style="
              display: inline-flex;
              gap: 8px;
              margin-top: 12px;
            ">
              <span style="font-size: 20px;">💚</span>
              <span style="font-size: 20px;">🎉</span>
              <span style="font-size: 20px;">🎊</span>
              <span style="font-size: 20px;">✨</span>
              <span style="font-size: 20px;">💚</span>
            </div>
          </div>
        `,
        confirmButtonColor: '#1a5336',
        confirmButtonText: 'Thank You!',
        background: '#ffffff',
        color: '#1e293b',
        padding: '0',
        width: '380px',
        allowOutsideClick: false
      });
    }
  }
  
  private playBirthdaySong() {
    // Create a hidden YouTube iframe to play the birthday song
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://www.youtube.com/embed/nAw2ooeubSQ?autoplay=1&controls=0&loop=1&playlist=nAw2ooeubSQ';
    iframe.width = '1';
    iframe.height = '1';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media';
    document.body.appendChild(iframe);
    
    // Auto-cleanup after 30 seconds
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 30000);
  }
  
  private fireConfetti() {
    // Confetti from left side
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0, y: 0.6 },
      colors: ['#1a5336', '#2d7a50', '#f59e0b', '#ef4444', '#3b82f6']
    });
    
    // Confetti from right side
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 1, y: 0.6 },
      colors: ['#1a5336', '#2d7a50', '#f59e0b', '#ef4444', '#3b82f6']
    });
    
    // Center burst after a short delay
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#1a5336', '#f59e0b']
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#1a5336', '#f59e0b']
      });
    }, 250);
  }
  
  ngOnDestroy() {
    // Observables in this component use async pipe or shareReplay, 
    // which handle their own cleanup. No manual subscription management needed.
  }
}