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
  getDoc,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import Swal from 'sweetalert2';

interface Employee {
  id: string;
  name: string;
  dept: string;
  initials: string;
  employeeId?: string;
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
  private router = inject(Router);
  private subscription: Subscription | null = null;

  searchQuery: string = '';
  selectedDept: string = 'All Departments';

  employees: Employee[] = [];
  leaveRequests: LeaveRequest[] = [];
  departments: string[] = ['All Departments'];
  isLoading = true;

  workingToday = 0;
  awayToday = 0;

  selectedEmployee: any = null;
  selectedEmployeeProfile: any = null;
  showEmployeeMenu = false;
  menuPosition = { x: 0, y: 0 };
  showPrivateInfo = false;
  expandedFields: { [key: string]: boolean } = {};

  // Current user for checking permissions
  get currentUser() {
    return this.authService.currentUser;
  }

  // Check if current user is HR only (can mark employees as absent)
  // Only HR can mark absences - Auditing purpose
  get isAdminOrHR(): boolean {
    const role = this.currentUser?.role?.toUpperCase() || '';
    return ['HR', 'HUMAN RESOURCE OFFICER'].includes(role);
  }

  // Set an employee as Absent (manually marked by HR/Admin)
  async setEmployeeAbsent(employee: Employee) {
    if (!this.isAdminOrHR) {
      Swal.fire({
        title: 'Access Denied',
        text: 'Only HR can mark employees as Absent.',
        icon: 'error',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Mark as Absent',
      html: `
        <div style="text-align: left;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #1a5336 0%, #2d7a4e 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px;">${employee.initials}</div>
            <div style="flex: 1;">
              <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">${employee.name}</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #64748b;">${employee.dept}</p>
            </div>
          </div>
          <p style="font-size: 13px; color: #64748b; margin: 0 0 16px;">This will mark them as absent in the AWAY / ON LEAVE section.</p>
          <div style="margin-top: 8px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">Reason (optional)</label>
            <textarea 
              id="absent-reason" 
              style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 14px; color: #1e293b; background: #f8fafc; min-height: 80px; resize: none; width: 100%; box-sizing: border-box; font-family: inherit;"
              placeholder="e.g., No prior leave filed, sudden illness, emergency..."
            ></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Mark Absent',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      width: '400px',
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

  private usersData: any[] = [];
  private lastUsersHash = '';
  private lastLeaveHash = '';
  private rebuildCount = 0;

  private async fetchData() {
    this.isLoading = true;

    try {
      this.subscription = new Subscription();

      const usersRef = collection(this.firestore, 'users');
      const unsubscribeUsers = onSnapshot(
        usersRef,
        (usersSnapshot) => {
          const startTime = performance.now();
          const newUsersData = usersSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as any[];

          const newHash = this.hashData(newUsersData);
          if (newHash === this.lastUsersHash) {
            console.log('[EmployeeStatus] Users: no change detected, skipping rebuild');
            return;
          }
          this.lastUsersHash = newHash;
          this.usersData = newUsersData;

          console.log(
            `[EmployeeStatus] Users updated: ${newUsersData.length} users, hash: ${newHash.substring(0, 8)}`,
          );
          this.buildEmployeeList();
          console.log(
            `[EmployeeStatus] Users rebuild took: ${(performance.now() - startTime).toFixed(2)}ms`,
          );
        },
        (error) => {
          console.error('[EmployeeStatus] Users listener error:', error);
        },
      );

      this.subscription.add(() => unsubscribeUsers());

      const leaveRef = collection(this.firestore, 'leaveRequests');
      const unsubscribeLeave = onSnapshot(
        leaveRef,
        (leaveSnapshot) => {
          const startTime = performance.now();
          const allRequests: any[] = leaveSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          const newHash = this.hashData(allRequests);
          if (newHash === this.lastLeaveHash) {
            console.log('[EmployeeStatus] Leave: no change detected, skipping rebuild');
            return;
          }
          this.lastLeaveHash = newHash;

          this.leaveRequests = allRequests.filter(
            (req) => req.status === 'Approved' || req.status === 'Awaiting HR Approval',
          );

          console.log(
            `[EmployeeStatus] Leave updated: ${this.leaveRequests.length} requests, hash: ${newHash.substring(0, 8)}`,
          );
          this.buildEmployeeList();
          console.log(
            `[EmployeeStatus] Leave rebuild took: ${(performance.now() - startTime).toFixed(2)}ms`,
          );
        },
        (error) => {
          console.error('[EmployeeStatus] Leave requests listener error:', error);
        },
      );

      this.subscription.add(() => unsubscribeLeave());
    } catch (error) {
      console.error('[EmployeeStatus] fetchData error:', error);
      this.isLoading = false;
    }
  }

  private hashData(data: any[]): string {
    let hash = 0;
    const str = JSON.stringify(data);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private buildEmployeeList() {
    this.rebuildCount++;
    const rebuildNum = this.rebuildCount;
    const startTime = performance.now();
    console.log(`[EmployeeStatus] buildEmployeeList START #${rebuildNum}`);

    const users = this.usersData;
    if (!users || users.length === 0) {
      console.log('[EmployeeStatus] buildEmployeeList: no users data, returning');
      return;
    }

    const leaveRequests = this.leaveRequests;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.employees = users.map((user) => {
      const initials = this.getInitials(user.name || 'Unknown');
      const dept = user.department || user.dept || 'Unknown';

      let status: Employee['status'] = 'In Office';
      let leaveType: string | undefined;
      let leaveDate: string | undefined;

      if (user.manuallyAbsent === true) {
        const absentDate = user.absentDate ? new Date(user.absentDate) : null;
        if (absentDate) {
          const threeDaysAgo = new Date(today);
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          if (absentDate >= threeDaysAgo) {
            status = 'Absent';
            leaveType = user.absentReason || 'Absent (No Leave Filed)';
            leaveDate = user.absentDate;
          }
        }
      }

      if (status === 'In Office') {
        const employeeId = user.employeeId;
        const userId = user.id;

        const userRequests = leaveRequests.filter((r) => {
          if (employeeId && r.employeeId) {
            return r.employeeId === employeeId;
          }
          return r.uid === userId;
        });

        for (const request of userRequests) {
          if (!request.period) continue;

          const sep = request.period.includes(' to ') ? ' to ' : ' - ';
          const parts = request.period.split(sep);
          const startDate = new Date(parts[0]);
          const endDate = parts[1] ? new Date(parts[1]) : startDate;
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);

          if (today >= startDate && today <= endDate) {
            status = 'On Leave';
            leaveType = request.leaveType || 'Leave';
            leaveDate = request.period;
            break;
          }

          const threeDaysFromNow = new Date(today);
          threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

          if (startDate > today && startDate <= threeDaysFromNow) {
            status = 'Upcoming Leave';
            leaveType = request.leaveType || 'Leave';
            leaveDate = request.period;
            break;
          }
        }
      }

      return {
        id: user.id,
        name: user.name || 'Unknown',
        dept: dept,
        initials: initials,
        employeeId: user.employeeId,
        status,
        leaveType,
        leaveDate,
      } as Employee;
    });

    const uniqueDepts = [...new Set(this.employees.map((e) => e.dept))];
    this.departments = ['All Departments', ...uniqueDepts.sort()];

    this.calculateStats();

    if (users.length > 1) {
      this.isLoading = false;
      this.cdr.detectChanges();
    }

    console.log(
      `[EmployeeStatus] buildEmployeeList END #${rebuildNum}: ${(performance.now() - startTime).toFixed(2)}ms for ${this.employees.length} employees`,
    );
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

  onEmployeeCardClick(event: MouseEvent, employee: Employee) {
    if (!this.isAdminOrHR) return;

    event.preventDefault();
    event.stopPropagation();

    this.selectedEmployee = employee;
    this.showPrivateInfo = false;
    this.showEmployeeMenu = true;
  }

  menuFlipDirection = false;

  togglePrivateInfo() {
    this.showPrivateInfo = !this.showPrivateInfo;
  }

  toggleFieldExpand(fieldKey: string) {
    if (this.expandedFields[fieldKey]) {
      delete this.expandedFields[fieldKey];
    } else {
      this.expandedFields[fieldKey] = true;
    }
  }

  isFieldExpanded(fieldKey: string): boolean {
    return this.expandedFields[fieldKey] === true;
  }

  async copyToClipboard(text: string, event: MouseEvent) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      Swal.fire({
        title: 'Copied!',
        text: `${text} copied to clipboard`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  closeEmployeeMenu() {
    this.showEmployeeMenu = false;
    this.selectedEmployee = null;
    this.selectedEmployeeProfile = null;
    this.expandedFields = {};
  }

  async viewEmployeeProfile() {
    if (!this.selectedEmployee) {
      return;
    }

    const emp = this.selectedEmployee;

    try {
      const userRef = doc(this.firestore, 'users', emp.id);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        const joinDate = userData['joinedDate']?.toDate
          ? userData['joinedDate'].toDate()
          : new Date(userData['joinedDate']);
        const today = new Date();
        const yearsOfService =
          (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

        this.selectedEmployeeProfile = {
          ...userData,
          dept: userData['dept'] || '-',
          joinedDate: userData['joinedDate'],
          yearsOfService:
            yearsOfService >= 1
              ? `${Math.floor(yearsOfService)} year(s) ${Math.round((yearsOfService % 1) * 12)} month(s)`
              : 'Less than 1 year',
        };
        this.expandedFields = {};

        setTimeout(() => {
          this.cdr.detectChanges();
        }, 0);
      }
    } catch (error) {
      console.error('Error fetching employee profile:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to load employee profile.',
        icon: 'error',
      });
    }
  }

  markAsAbsentFromMenu() {
    if (!this.selectedEmployee) return;
    const emp = this.selectedEmployee;
    this.showEmployeeMenu = false;
    this.setEmployeeAbsent(emp);
  }
}
