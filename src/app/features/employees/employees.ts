import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  onSnapshot,
  Unsubscribe,
  doc,
  updateDoc,
} from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import Swal from 'sweetalert2';

interface Employee {
  id: string;
  name: string;
  dept: string;
  initials: string;
  status: 'In Office' | 'On Leave' | 'Upcoming Leave' | 'Absent';
  leaveType?: string;
  leaveDate?: string;
  absentReason?: string;
}

interface LeaveRequest {
  uid?: string;
  employeeId?: string;
  period: string;
  leaveType: string;
  status: string;
}

@Component({
  selector: 'app-employee-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.html',
  styleUrls: ['./employees.css'],
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

  // Current user for checking permissions
  get currentUser() {
    return this.authService.currentUser;
  }

  // Check if current user is HR or Admin Manager (can mark employees as absent)
  get isAdminOrHR(): boolean {
    const role = this.currentUser?.role?.toUpperCase() || '';
    return ['ADMIN MANAGER', 'HR', 'HUMAN RESOURCE OFFICER'].includes(role);
  }

  // Set an employee as Absent (manually marked by HR/Admin)
  async setEmployeeAbsent(employee: Employee) {
    if (!this.isAdminOrHR) {
      Swal.fire({
        title: 'Access Denied',
        text: 'Only HR and Admin Manager can mark employees as Absent.',
        icon: 'error',
      });
      return;
    }

    // Show confirmation dialog with reason input
    const result = await Swal.fire({
      title: 'Mark as Absent',
      html: `
        <div style="text-align: left; margin-bottom: 16px;">
          <p>Mark <strong>${employee.name}</strong> as Absent?</p>
          <p style="font-size: 13px; color: #666;">This will mark them as absent in the AWAY / ON LEAVE section.</p>
        </div>
        <div style="text-align: left;">
          <label for="absent-reason" style="display: block; margin-bottom: 6px; font-weight: 500;">Reason (optional):</label>
          <textarea id="absent-reason" class="swal2-textarea" placeholder="e.g., No prior leave filed, sudden illness, emergency..."></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Mark Absent',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      preConfirm: () => {
        const reasonInput = document.getElementById('absent-reason') as HTMLTextAreaElement;
        return reasonInput?.value || '';
      },
    });

    if (!result.isConfirmed || result.isDismissed) {
      return;
    }

    const reason = result.value || '';

    try {
      // Update the user document in Firestore
      const userDocRef = doc(this.firestore, 'users', employee.id);
      await updateDoc(userDocRef, {
        manuallyAbsent: true,
        absentDate: new Date().toISOString().split('T')[0],
        absentReason: reason,
        markedAbsentBy: this.currentUser?.name,
        markedAbsentAt: new Date().toISOString(),
      });

      Swal.fire({
        title: 'Marked Absent',
        text: `${employee.name} has been marked as Absent.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('[EmployeeStatus] Error marking absent:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to mark employee as Absent. Please try again.',
        icon: 'error',
      });
    }
  }

  // Toggle absent status - set or remove based on current status
  async toggleAbsentStatus(employee: Employee) {
    if (!this.isAdminOrHR) return;

    if (employee.status === 'Absent') {
      await this.removeAbsentStatus(employee);
    } else {
      await this.setEmployeeAbsent(employee);
    }
  }

  // Remove Absent status from an employee
  async removeAbsentStatus(employee: Employee) {
    if (!this.isAdminOrHR) {
      return;
    }

    const result = await Swal.fire({
      title: 'Remove Absent Status',
      html: `<p>Remove Absent status from <strong>${employee.name}</strong>?</p>`,
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#16a34a',
    });

    if (!result.isConfirmed || result.isDismissed) {
      return;
    }

    try {
      const userDocRef = doc(this.firestore, 'users', employee.id);
      await updateDoc(userDocRef, {
        manuallyAbsent: false,
        absentDate: null,
        absentReason: null,
        markedAbsentBy: null,
        markedAbsentAt: null,
      });

      Swal.fire({
        title: 'Status Removed',
        text: `${employee.name} is no longer marked as Absent.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('[EmployeeStatus] Error removing absent status:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to remove Absent status. Please try again.',
        icon: 'error',
      });
    }
  }

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
      // Initialize subscription container
      this.subscription = new Subscription();

      // Store users data to be shared across listeners
      let usersData: any[] = [];

      // Set up real-time listener for users
      const usersRef = collection(this.firestore, 'users');
      const unsubscribeUsers = onSnapshot(
        usersRef,
        (usersSnapshot) => {
          usersData = usersSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as any[];

          this.buildEmployeeList(usersData);
        },
        (error) => {
          console.error('[EmployeeStatus] Users listener error:', error);
        },
      );

      // Add users unsubscribe to subscription container
      this.subscription.add(() => unsubscribeUsers());

      // Set up real-time listener for leave requests (independent of users listener)
      const leaveRef = collection(this.firestore, 'leaveRequests');
      const unsubscribeLeave = onSnapshot(
        leaveRef,
        (leaveSnapshot) => {
          // Filter locally instead of using 'in' query which requires composite index
          const allRequests: any[] = leaveSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          this.leaveRequests = allRequests.filter(
            (req) => req.status === 'Approved' || req.status === 'Awaiting HR Approval',
          );

          this.buildEmployeeList(usersData);
        },
        (error) => {
          console.error('[EmployeeStatus] Leave requests listener error:', error);
        },
      );

      // Add leave unsubscribe to subscription container
      this.subscription.add(() => unsubscribeLeave());
    } catch (error) {
      console.error('[EmployeeStatus] fetchData error:', error);
      this.isLoading = false;
    }
  }

  private buildEmployeeList(users: any[]) {
    if (!users || users.length === 0) {
      return;
    }

    // Build employee list with status
    this.employees = users.map((user) => {
      const initials = this.getInitials(user.name || 'Unknown');
      const dept = user.department || user.dept || 'Unknown';
      const statusInfo = this.getEmployeeStatus(user);

      return {
        id: user.id,
        name: user.name || 'Unknown',
        dept: dept,
        initials: initials,
        status: statusInfo.status || 'In Office',
        leaveType: statusInfo.leaveType,
        leaveDate: statusInfo.leaveDate,
      } as Employee;
    });

    // Extract unique departments
    const uniqueDepts = [...new Set(this.employees.map((e) => e.dept))];
    this.departments = ['All Departments', ...uniqueDepts.sort()];

    this.calculateStats();

    // Only set isLoading to false if we have a reasonable number of users
    // This prevents showing partial data when Firebase is still loading
    if (users.length > 1) {
      this.isLoading = false;
      // Manually trigger change detection to ensure UI updates
      this.cdr.detectChanges();
    }
  }

  private getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  private getEmployeeStatus(user: any): Partial<Employee> {
    const userId = user.id;
    const name = user.name;
    const employeeId = user.employeeId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if manually marked as absent FIRST (takes priority over other statuses)
    if (user.manuallyAbsent === true) {
      const absentDate = user.absentDate ? new Date(user.absentDate) : null;
      // Check if absent date is today or in the past (within last 3 days for tolerance)
      if (absentDate) {
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        if (absentDate >= threeDaysAgo) {
          return {
            status: 'Absent',
            leaveType: user.absentReason || 'Absent (No Leave Filed)',
            leaveDate: user.absentDate,
            absentReason: user.absentReason,
          };
        }
      }
    }

    // Match on employeeId if available, otherwise fall back to uid
    const userRequests = this.leaveRequests.filter((r) => {
      if (employeeId && r.employeeId) {
        return r.employeeId === employeeId;
      }
      return r.uid === userId;
    });

    for (const request of userRequests) {
      // Parse the period field (format: "2026-03-23 to 2026-05-24")
      if (!request.period) {
        continue;
      }

      const sep = request.period.includes(' to ') ? ' to ' : ' - ';
      const parts = request.period.split(sep);
      const startDate = new Date(parts[0]);
      const endDate = parts[1] ? new Date(parts[1]) : startDate;
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      if (today >= startDate && today <= endDate) {
        // Employee is currently on leave
        return {
          status: 'On Leave',
          leaveType: request.leaveType || 'Leave',
          leaveDate: request.period,
        };
      }

      // Check for upcoming leave (within next 3 days)
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      if (startDate > today && startDate <= threeDaysFromNow) {
        return {
          status: 'Upcoming Leave',
          leaveType: request.leaveType || 'Leave',
          leaveDate: request.period,
        };
      }
    }

    // No leave found - employee is in office
    return { status: 'In Office' };
  }

  calculateStats() {
    this.workingToday = this.employees.filter((e) => e.status === 'In Office').length;
    this.awayToday = this.employees.filter(
      (e) => e.status === 'On Leave' || e.status === 'Upcoming Leave' || e.status === 'Absent',
    ).length;
  }

  get filteredEmployees() {
    return this.employees.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        e.dept.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesDept = this.selectedDept === 'All Departments' || e.dept === this.selectedDept;
      return matchesSearch && matchesDept;
    });
  }
}
