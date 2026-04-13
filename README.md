# CLS HRIS - Human Resources Information System

A comprehensive Angular-based HR management system with Firebase backend for managing employee leave requests, approvals, and tracking.

---

## Table of Contents

1. [User Manual](#user-manual)
2. [Technical Documentation](#technical-documentation)
3. [System Architecture](#system-architecture)
4. [API/Data Schema](#apidata-schema)

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
- **Paid Time Off:** - Upon 1 yr. in Service: 5 Days
    - 2nd Year of Service: 7 Days
    - 4 Years and above: 8 Days
    - Admin Manager/ Supervisor: 10 (fixed)
- **Sick Leave:** Same balance as PTO
- **Birthday Leave:** 1 day during birth month
- **Maternity Leave:** 105 days (female)
- **Paternity Leave:** 7 days (male)
- **Leave Without Pay:** Unlimited

---

## How to Update an Employee Profile
1. Navigate to Profile to request to update your information

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
```bash
npm install
npm start
