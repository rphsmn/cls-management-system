import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
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
    this.fetchData();
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private async fetchData() {
    this.isLoading = true;
    
    try {
      // Fetch all users from Firestore
      console.log('Fetching users from Firestore...');
      const usersSnapshot = await getDocs(collection(this.firestore, 'users'));
      console.log('Users fetched:', usersSnapshot.size);
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Fetch all leave requests (no filter to avoid index requirement)
      console.log('Fetching leave requests...');
      const leaveSnapshot = await getDocs(collection(this.firestore, 'leaveRequests'));
      console.log('Leave requests fetched:', leaveSnapshot.size);
      // Filter locally instead of using 'in' query which requires composite index
      this.leaveRequests = leaveSnapshot.docs
        .map(doc => doc.data() as LeaveRequest)
        .filter(req => req.status === 'Approved' || req.status === 'Awaiting HR Approval');

      // Build employee list with status
      this.employees = users.map(user => {
        const initials = this.getInitials(user.name || 'Unknown');
        const dept = user.department || user.dept || 'Unknown';
        const statusInfo = this.getEmployeeStatus(user.uid, user.name);
        
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

      // Extract unique departments
      const uniqueDepts = [...new Set(this.employees.map(e => e.dept))];
      this.departments = ['All Departments', ...uniqueDepts.sort()];

      this.calculateStats();
    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      this.isLoading = false;
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