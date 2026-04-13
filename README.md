# CLS HRIS - Human Resources Information System

A comprehensive Angular-based HR management system with Firebase backend for managing employee leave requests, approvals, and tracking.

---

## Table of Contents

1. User Manual
2. Technical Documentation
3. System Architecture
4. API/Data Schema

---

# User Manual

A guide for HR personnel on how to use the CLS HRIS portal.

## Getting Started

### Logging In
1. Navigate to the HRIS portal URL
2. Enter your email and password
3. Click Sign In
4. If you forget your password, use Forgot Password to reset

### Navigation
- Dashboard: Overview and quick stats
- File Leave: Submit a leave request
- History: View your leave history
- Approvals: Approve/reject leave requests
- Calendar: View team calendar
- Employees: View employee directory
- Profile: Manage your profile
- Audit Logs: View system activity

---

## How to Approve a Leave Request
1. Log in and click Approvals in the sidebar
2. View pending leave requests
3. Click on a request to view details
4. To approve: Click Approve button
5. To reject: Click Reject button

### Approval Flow
| Employee Role | Approval Chain |
|---------------|----------------|
| Operations Admin | Supervisor to HR |
| Accounts Staff | Supervisor to HR |
| IT Developer | Admin Manager to HR |
| HR Staff | Admin Manager to HR |
| Admin Manager | HR (Final) |
| Part-time | HR (Direct) |

---

## How to File a Leave Request
1. Click File Leave in the sidebar
2. Select Leave Type from dropdown
3. Choose Start Date and End Date
4. Provide a Reason for leave
5. For sick leave 3+ days, upload medical certificate
6. Click Submit Request

### Leave Types
- Paid Time Off: Years of Service	Credit Entitlement
Upon 1 yr. in Service:	5 Days
2nd Year of Service:	7 Days
4 Years and above: 8 Days
Admin Manager/ Supervisor: 10 (fixed)

- Sick Leave: Same balance as PTO
- Birthday Leave: 1 day during birth month
- Maternity Leave: 105 days (female)
- Paternity Leave: 7 days (male)
- Leave Without Pay: Unlimited

---

## How to Update an Employee Profile
1. Click Profile to update your own
2. Click Employees (admin) to update others

---

## How to View Audit Logs
1. Click Audit Logs in the sidebar
2. Use filters (Time Presets, Month/Year, Action Type)

---

# Technical Documentation

## Project Setup

### Prerequisites
- Node.js 18+
- npm 9+
- Firebase project

### Installation
npm install
npm start

### Building
npm run build

---

## Environment Variables

Configure in src/environments/environment.ts:
- apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
- appTitle: CLS HRIS
- hrEmail, operationsAdminSupervisorEmail, accountSupervisorEmail, adminManagerEmail

---

## Key Scripts
/scripts folder contains maintenance scripts.

---

# System Architecture

## Overview
Angular 21+ SPA with Firebase backend (Firestore + Auth).

## Frontend to Backend Communication
- AuthService: User authentication
- LeaveService: Leave request CRUD
- HolidayService: Holiday calendar
- NotificationService: In-app notifications
- AuditService: Audit logging
- EmployeeUpdateService: Employee management

### Real-time Data
Uses Firestore onSnapshot for real-time updates with BehaviorSubject.

---

## Multi-Level Approval Logic

### Workflow
1. Employee submits request
2. First-level reviewer approves/rejects
3. If approved, moves to next level (HR)
4. HR approval is final - balance is deducted

### Approval Chain
| Employee Role | Level 1 | Level 2 |
|---------------|---------|---------|
| Operations Admin | Ops Admin Supervisor | HR |
| Accounts | Account Supervisor | HR |
| IT Developer | Admin Manager | HR |
| HR | Admin Manager | None |
| Admin Manager | HR | None |
| Part-time | HR | None |

### Status Values
- Pending: Awaiting review
- Awaiting HR Approval: Passed first level
- Approved: Final, balance deducted
- Rejected: Denied
- Cancelled: Withdrawn

---

# API/Data Schema

## Firestore Collections

### 1. users
- uid, id, employeeId, email, name, role, department
- joinedDate, birthday, gender
- leaveBalance, birthdayLeave
- phone, address, emergencyContactName, emergencyContactPhone

### 2. leaveRequests
- id, type, startDate, endDate, period, reason, daysDeducted
- attachment: {name, data}
- uid, employeeId, employeeName, role, department
- status, targetReviewer
- dateFiled, dateApproved, cancelledBy

### 3. auditLogs
- id, action, details
- userId, performedByName
- targetUserId, targetUserName
- metadata, timestamp

### 4. notifications
- id, type, title, message
- targetUserId, targetRole
- isRead, createdAt

### 5. holidays
- id, name, date
- type: regular | special-non-working | special-working
- isRecurring

---

## Leave Type Constants
- PAID_TIME_OFF: Paid Time Off
- SICK_LEAVE: Sick Leave
- BIRTHDAY_LEAVE: Birthday Leave
- MATERNITY_LEAVE: Maternity Leave
- PATERNITY_LEAVE: Paternity Leave
- LEAVE_WITHOUT_PAY: Leave Without Pay

---

## Technology Stack
- Frontend: Angular 21+
- Styling: Custom CSS with CSS Variables
- Backend: Firebase (Firestore, Auth)
- Notifications: SweetAlert2
- PDF: jsPDF + autoTable

---

## License
Internal use only - CLS Human Resources
