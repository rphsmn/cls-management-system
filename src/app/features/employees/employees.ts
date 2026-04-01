import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth';

interface Employee {
  id: string;
  name: string;
  dept: string;
  initials: string;
  status: 'In Office' | 'On Leave' | 'Upcoming Leave';
  leaveType?: string;
  leaveDate?: string;
}

interface LeaveRequest {
  uid: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  status: string;
}

@Component({
  selector: 'app-employee-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.html',
  styleUrls: ['./employees.css']
})
export class EmployeeStatusComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private subscription: Subscription | null = null;

  searchQuery: string = '';
  selectedDept: string = 'All Departments';
  
  employees: Employee[] = [];
  leaveRequests: LeaveRequest[] = [];
  departments: string[] = ['All Departments'];
  isLoading = true;

  workingToday = 0;
  awayToday = 0;

  ngOnInit() {
    console.log('EmployeeStatusComponent: ngOnInit called');
    this.fetchData();
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private async fetchData() {
    console.log('EmployeeStatusComponent: fetchData called');
    this.isLoading = true;
    
    try {
      // Initialize subscription container
      this.subscription = new Subscription();
      console.log('EmployeeStatusComponent: Subscription container initialized');

      // Store users data to be shared across listeners
      let usersData: any[] = [];

      // Set up real-time listener for users
      const usersRef = collection(this.firestore, 'users');
      console.log('EmployeeStatusComponent: Setting up users listener');
      const unsubscribeUsers = onSnapshot(usersRef, (usersSnapshot) => {
        console.log('EmployeeStatusComponent: Users snapshot received, size:', usersSnapshot.size);
        usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        console.log('EmployeeStatusComponent: Users data:', usersData);
        this.buildEmployeeList(usersData);
      }, (error) => {
        console.error('EmployeeStatusComponent: Users listener error:', error);
      });
      
      // Add users unsubscribe to subscription container
      this.subscription.add(() => unsubscribeUsers());
      console.log('EmployeeStatusComponent: Users listener added to subscription');

      // Set up real-time listener for leave requests (independent of users listener)
      const leaveRef = collection(this.firestore, 'leaveRequests');
      console.log('EmployeeStatusComponent: Setting up leave requests listener');
      const unsubscribeLeave = onSnapshot(leaveRef, (leaveSnapshot) => {
        console.log('EmployeeStatusComponent: Leave requests snapshot received, size:', leaveSnapshot.size);
        // Filter locally instead of using 'in' query which requires composite index
        this.leaveRequests = leaveSnapshot.docs
          .map(doc => doc.data() as LeaveRequest)
          .filter(req => req.status === 'Approved' || req.status === 'Awaiting HR Approval');
        console.log('EmployeeStatusComponent: Filtered leave requests:', this.leaveRequests);
        this.buildEmployeeList(usersData);
      }, (error) => {
        console.error('EmployeeStatusComponent: Leave requests listener error:', error);
      });
      
      // Add leave unsubscribe to subscription container
      this.subscription.add(() => unsubscribeLeave());
      console.log('EmployeeStatusComponent: Leave listener added to subscription');
    } catch (error) {
      console.error('EmployeeStatusComponent: Error setting up real-time listeners:', error);
      this.isLoading = false;
    }
  }

  private buildEmployeeList(users: any[]) {
    console.log('EmployeeStatusComponent: buildEmployeeList called with users:', users);
    console.log('EmployeeStatusComponent: Current isLoading state before build:', this.isLoading);
    if (!users || users.length === 0) {
      console.log('EmployeeStatusComponent: No users data available yet');
      return;
    }

    // Build employee list with status
    this.employees = users.map(user => {
      const initials = this.getInitials(user.name || 'Unknown');
      const dept = user.department || user.dept || 'Unknown';
      const statusInfo = this.getEmployeeStatus(user.id, user.name);
      
      return {
        id: user.id,
        name: user.name || 'Unknown',
        dept: dept,
        initials: initials,
        status: statusInfo.status || 'In Office',
        leaveType: statusInfo.leaveType,
        leaveDate: statusInfo.leaveDate
      } as Employee;
    });
    console.log('EmployeeStatusComponent: Employees built:', this.employees);

    // Extract unique departments
    const uniqueDepts = [...new Set(this.employees.map(e => e.dept))];
    this.departments = ['All Departments', ...uniqueDepts.sort()];
    console.log('EmployeeStatusComponent: Departments:', this.departments);

    this.calculateStats();
    console.log('EmployeeStatusComponent: Stats calculated - workingToday:', this.workingToday, 'awayToday:', this.awayToday);
    
    // Only set isLoading to false if we have a reasonable number of users
    // This prevents showing partial data when Firebase is still loading
    if (users.length > 1) {
      this.isLoading = false;
      console.log('EmployeeStatusComponent: isLoading set to false (users.length > 1)');
      console.log('EmployeeStatusComponent: Current isLoading state after setting to false:', this.isLoading);
      // Manually trigger change detection to ensure UI updates
      this.cdr.detectChanges();
      console.log('EmployeeStatusComponent: Change detection triggered');
    } else {
      console.log('EmployeeStatusComponent: Keeping isLoading true - only', users.length, 'user(s) loaded so far');
      console.log('EmployeeStatusComponent: Current isLoading state after keeping true:', this.isLoading);
    }
  }

  private getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  private getEmployeeStatus(uid: string, name: string): Partial<Employee> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const userRequests = this.leaveRequests.filter(r => r.uid === uid);
    
    for (const request of userRequests) {
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      if (today >= startDate && today <= endDate) {
        // Employee is currently on leave
        return {
          status: 'On Leave',
          leaveType: request.leaveType || 'Leave',
          leaveDate: request.startDate === request.endDate 
            ? request.startDate 
            : `${request.startDate} to ${request.endDate}`
        };
      }

      // Check for upcoming leave (within next 3 days)
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      if (startDate > today && startDate <= threeDaysFromNow) {
        return {
          status: 'Upcoming Leave',
          leaveType: request.leaveType || 'Leave',
          leaveDate: request.startDate === request.endDate 
            ? request.startDate 
            : `${request.startDate} to ${request.endDate}`
        };
      }
    }

    // No leave found - employee is in office
    return { status: 'In Office' };
  }

  calculateStats() {
    this.workingToday = this.employees.filter(e => e.status === 'In Office').length;
    this.awayToday = this.employees.filter(e => e.status === 'On Leave' || e.status === 'Upcoming Leave').length;
  }

  get filteredEmployees() {
    return this.employees.filter(e => {
      const matchesSearch = e.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                            e.dept.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesDept = this.selectedDept === 'All Departments' || e.dept === this.selectedDept;
      return matchesSearch && matchesDept;
    });
  }
}