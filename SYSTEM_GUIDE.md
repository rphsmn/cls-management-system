# CLS HRIS - Comprehensive System Guide

A complete reference guide for employees, management, and developers working with the Clark Learning System Human Resources Information System.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Employee Setup Process](#employee-setup-process)
4. [Leave Management](#leave-management)
5. [Approval Workflow](#approval-workflow)
6. [Core Features](#core-features)
7. [Management & Reporting](#management--reporting)
8. [Employee Directory](#employee-directory)
9. [Profile & Updates](#profile--updates)
10. [Technical Architecture](#technical-architecture)
11. [Common Tasks](#common-tasks)
12. [Troubleshooting](#troubleshooting)

---

## System Overview

The CLS HRIS is an Angular-based Human Resources Information System with Firebase (Firestore) backend for managing:

- **Leave Requests**: Submitting, tracking, and managing employee leave
- **Approvals**: Multi-level approval workflow for leave requests
- **Employee Directory**: Organization-wide employee status tracking
- **Profile Management**: Employee information and government IDs
- **Audit Logging**: Full activity tracking for compliance

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17+ |
| Backend | Firebase Firestore |
| Authentication | Firebase Auth |
| Hosting | Firebase Hosting / Vercel |
| Database | Cloud Firestore (NoSQL) |

### Navigation Routes

| Route | Component | Description |
|------|----------|------------|
| `/dashboard` | Dashboard | Overview with stats and quick actions |
| `/file-leave` | File Leave | Submit new leave request |
| `/history` | Leave History | View personal leave history |
| `/approvals` | Approvals | Approve/reject leave requests |
| `/employees` | Employee Status | Employee directory |
| `/calendar` | Calendar | Team calendar view |
| `/profile` | Profile | View/update personal info |
| `/audit-logs` | Audit Logs | System activity logs |
| `/admin/employee-update` | Employee Update | Bulk employee data updates |

---

## User Roles & Permissions

### Role Hierarchy

| Role | Can File Leave | Can Approve | Can View All Employees | Can Mark Absent |
|------|--------------|-------------|---------------------|----------------|
| Part-time | No PTO | No | No | No |
| Operations Admin | Yes | Level 1 | Department | No |
| Accounts Staff | Yes | Level 1 | Department | No |
| Operations Admin Supervisor | Yes | Level 1-2 | Department | No |
| Account Supervisor | Yes | Level 1-2 | Department | No |
| IT Developer | Yes | Level 2 | All | No |
| HR / Human Resource Officer | Yes | Final | All | Yes |
| Admin Manager | Yes | Level 2 / Final | All | Yes |

### Department Codes

- `CLS-ADM` - Admin Department
- `CLS-ACC` - Accounts Department
- `CLS-DEC` - Decoration / Design Department
- `CLS-DEV` - IT Development
- `CLS-MGT` - Management

---

## Employee Setup Process

### 1. Create Firebase Auth Account

Since there's no self-registration, HR must create accounts manually:

```javascript
// Via Firebase Console or Admin SDK
// Email format: company email (e.g., firstname.lastname@company.com)
// Password: Initially set by HR, user can change via Forgot Password
```

### 2. Create User Profile in Firestore

Create a document in `users` collection with these required fields:

| Field | Type | Description |
|-------|------|------------|
| `employeeId` | string | Unique ID (e.g., CLS-ADM00046) |
| `name` | string | Full name |
| `email` | string | Company email |
| `role` | string | Job title/role |
| `department` | string | Department name |
| `joinedDate` | timestamp | Start date (for PTO calculation) |

Optional fields:

| Field | Type | Description |
|-------|------|------------|
| `gender` | string | "male" or "female" (for maternity/paternity) |
| `birthday` | string | Date for birthday leave |
| `birthdayLeave` | number | Default: 1 |
| `sickLeave` | number | Default: 10 |
| `leaveBalance` | number | Calculated PTO |
| `leaveBalanceNote` | string | "Total: X, Used: Y, Remaining: Z" |
| `tin` | string | Tax Identification Number |
| `sss` | string | SSS Number |
| `philhealth` | string | PhilHealth Number |
| `pagibig` | string | Pag-IBIG Number |
| `mobileNo` | string | Mobile number |
| `address` | string | Home address |
| `emergencyContactPerson` | string | Emergency contact name |
| `emergencyContactRelation` | string | Relationship |
| `emergencyContactMobile` | string | Emergency contact phone |

### 3. Verify Role & Department

The role determines the approval chain. Ensure the role matches one of the predefined roles in the system:

- `Operations Admin`
- `Operations Admin Supervisor`
- `Operations Admin Assistant`
- `Operations Admin Officer`
- `Admin Compliance Officer`
- `Accounting Clerk`
- `Account Supervisor`
- `Account Receivable Specialist`
- `Account Payables Specialist`
- `IT Developer`
- `Senior IT Developer`
- `IT Assistant`
- `HR` / `Human Resource Officer`
- `Admin Manager`
- `Managing Director`
- `Part-time`

---

## Leave Management

### Leave Types & Entitlements

| Leave Type | Entitlement | Deduction | Notes |
|-----------|-------------|----------|-------|
| **Paid Time Off** | Based on tenure | Yes | Auto-calculated |
| **Sick Leave** | Same as PTO | Yes | Shares balance with PTO |
| **Birthday Leave** | 1 day | No | Must be in birth month |
| **Maternity Leave** | 105 days | No | Female employees only |
| **Paternity Leave** | 7 days | No | Male employees only |
| **Leave Without Pay** | Unlimited | No | No balance required |

### Paid Time Off (PTO) Calculation

```
< 1 year:      0 credits (cannot file PTO)
1 year:        5 base + 1 bonus = 6 credits
2 years:       7 base + 1 bonus = 8 credits
4+ years:      8 base + 1 bonus = 9 credits

Admin Manager / Account Supervisor: Fixed 10 days
```

**How It Works**:
- **Dynamic calculation** - PTO is NOT stored as a static value. It's calculated fresh every time based on current date and joinedDate.
- **No yearly reset** - Continuous, not reset annually. On Jan 1 of any year, it automatically calculates using that year's date.
- **Automatic increase** - When an employee's years of service reaches a milestone (1yr → 2yr → 4yr), their total credits automatically increase.
  - Example: Employee at 1yr (6 credits) uses 5 → has 1 remaining
  - At 2yr mark: total becomes 8 → remaining becomes 3 (8 - 5 = 3)
- **Recalculated on**: Leave approval, user login, dashboard load

### Filing a Leave Request

1. Navigate to **File Leave**
2. Select leave type from dropdown
3. Select start and end dates
4. Provide reason
5. For sick leave 3+ days: Upload medical certificate
6. Click **Submit Request**

**Requirements**:
- Must have ≥1 year of service for Paid Time Off
- Sick leave available immediately (no tenure requirement)
- Birthday leave: Must be in birth month
- Maternity/Paternity: Must have gender specified

### Half-Day Leave

The system supports half-day leave filing:

- Set `isHalfDay` flag or `daysDeducted: 0.5`
- Only applies to single-day leaves

---

## Approval Workflow

### Approval Chain by Role

| Employee Role | First Approver | Second Approver | Final Approver |
|--------------|---------------|---------------|---------------|
| Operations Admin | Ops Admin Sup | HR | - |
| Accounts Staff | Account Sup | HR | - |
| IT Developer | Admin Manager | HR | - |
| HR | Admin Manager | - | HR |
| Admin Manager | HR | - | HR |
| Part-time | HR | - | HR |

### Approval Status Flow

```
Pending
  ↓ (1st approval)
Awaiting [Role] Approval
  ↓ (2nd approval)
Approved  ← Balance deducted at this step
  OR
Rejected by [Role]
```

### Approving a Request

1. Go to **Approvals** page
2. View pending requests (filtered by your role)
3. Click on a request to view details
4. Click **Approve** or **Reject**
5. Confirmation dialog appears
6. Employee receives notification

### Cancelling a Request (Employee)

Only pending requests can be cancelled:

1. Go to **History**
2. Find the pending request
3. Click **Cancel**
4. Request marked as Cancelled
5. Balance restored if previously approved

---

## Core Features

### Dashboard

- Leave balance summary (PTO, Sick Leave, Birthday Leave)
- Recent leave requests
- Quick links to File Leave, History, Approvals
- Team status (Working / On Leave / Absent)

### Leave History

- View all personal leave requests
- Filters: Year, Month, Status, Leave Type
- Shows: Type, Period, Days, Status, Date Filed

### Calendar

- Team calendar view
- Color-coded by leave type
- Shows approved leaves only

### Employee Directory

- All employees with status
- Status types: Active, On Leave, Upcoming Leave, Absent
- Filter by department
- Search by name
- **HR Only**: Can mark employees as Absent (for auditing)

### Profile Management

- View personal information
- Update request functionality
- Government IDs (TIN, SSS, PhilHealth, Pag-IBIG)
- Emergency contact information

### Audit Logs

- Full activity tracking
- Filter by: Time period, Action type, User
- Actions logged: Leave submitted, approved, rejected, profile updates

---

## Management & Reporting

### Leave Reports (Calendar View)

Management can view "Who is out this month":

1. Navigate to **Calendar**
2. View color-coded team calendar
3. Shows all approved leaves for the month
4. Filter by employee or leave type
5. Helps with resource planning and coverage

### Audit Compliance

All approval/rejection actions are logged in **Audit Logs** for transparency:

- Who approved/rejected a request
- When the action was taken
- Previous status vs new status
- Filter by date range, user, or action type

**Key logged actions**:
- `leave_submitted` - Employee files leave
- `leave_approved` - Manager approves
- `leave_rejected` - Manager rejects
- `leave_cancelled` - Employee cancels
- `absent_marked` - HR marks employee absent
- `profile_updated` - Profile data changed

---

## Employee Directory

### Viewing Employee Status

1. Navigate to **Employees**
2. View status cards:
   - **Active** (green): In office
   - **On Leave** (blue): Currently on approved leave
   - **Upcoming Leave** (yellow): Leave starting within 3 days
   - **Absent** (red): Manually marked by HR

### Marking Employees as Absent (HR Only)

HR can manually mark employees as absent for auditing:

1. Click on employee card (HR only)
2. Select **Mark as Absent**
3. Provide reason (optional)
4. Confirmation dialog
5. Employee shows as Absent for 3 days

**Absent Status Logic**:
- Database record persists indefinitely (does NOT auto-delete)
- **Display logic**: Shows as "Absent" only if `absentDate` is within the last 3 days
- After 3 days: UI automatically hides the Absent status and falls back to "Active" or "On Leave" (if approved leave exists)
- **NOT automatically overwritten** by emergency leave or any leave filed after
- If employee files leave after being marked absent, HR should **manually remove** the absent status to reflect accurate status
- Use case: Employee didn't file leave but is absent, no prior notice, or emergency situations

**Technical Implementation**:
- `manuallyAbsent: true` - flag stored in Firestore
- `absentDate: "2026-04-16"` - date when marked
- `absentReason: "..."` - optional reason
- UI checks: `if (absentDate >= today - 3 days)` → show Absent

**To Remove Absent Status**:
1. Click on the employee's card
2. Select **Remove Absent Status**
3. Confirmation dialog
4. Sets `manuallyAbsent: false` and clears `absentDate`
5. Status immediately changes back to Active or On Leave (if approved leave exists)

**Note**: HR can remove at any time. After 3 days, the UI will automatically hide the Absent status, but the database record remains until manually cleared.

---

## Profile & Updates

### Viewing Your Profile

1. Click **Profile** in sidebar
2. View:
   - Name, Role, Department
   - Employee ID
   - Leave balances
   - Government IDs
   - Emergency contact

### Requesting Profile Update

1. Go to **Profile**
2. Click **Request Update**
3. Fill form with new information
4. Submit for HR review

### Bulk Employee Updates (Admin)

HR/Admin can perform bulk updates via `/admin/employee-update`:

- Parse employee data from tab-separated format
- Update: Name, Birthday, TIN, SSS, PhilHealth, Pag-IBIG

---

## Technical Architecture

### Firestore Collections

| Collection | Description |
|-----------|------------|
| `users` | Employee profiles |
| `leaveRequests` | Leave request documents |
| `notifications` | User notifications |
| `auditLogs` | System activity logs |
| `companyEvents` | Company events/holidays |

### Data Relationships

```
users (1) ──→ leaveRequests (many)
  ↓
  └── notifications (many)

users (1) ──→ auditLogs (many)
```

### Security Rules Summary

| Collection | Create | Read | Update |
|------------|--------|------|--------|
| users | HR only | Self + HR | Self + HR |
| leaveRequests | Auth users | Self + HR/Sup | HR + Supervisors |
| notifications | System | Owner + HR | Owner + HR |
| auditLogs | System | HR only | System only |

### Key Services

| Service | Purpose |
|---------|--------|
| `AuthService` | Authentication, user profile, PTO calculation |
| `LeaveService` | Leave CRUD, approval workflow, balance management |
| `NotificationService` | In-app notifications |
| `AuditService` | Activity logging |
| `HolidayService` | Holiday date management |
| `EmployeeUpdateService` | Bulk employee updates |

### Theming & Styling

The system utilizes a **Custom CSS Specificity Chain** for its Dark Theme implementation:

- High-specificity CSS overrides ensure consistent **white-on-navy** contrast
- Theme styles target layout components directly to prevent conflicts
- Dark theme applies `--bg-primary: #0f172a` (navy) and `--text-primary: #f8fafc` (white)
- CSS variables defined in component stylesheets with `!important` where needed

### API Reference

## Common Tasks

### How to: Reset Employee Password

1. Go to Firebase Console → Authentication
2. Find user by email
3. Click "Reset password"
4. User receives password reset email

### How to: Manually Adjust Leave Balance

1. Go to Firestore Console
2. Find user in `users` collection
3. Update `leaveBalance` field
4. Update `leaveBalanceNote` with format: "Total: X, Used: Y, Remaining: Z"

### How to: Bulk Import Employees

Use the employee update service or manually import via Firestore:

```javascript
// Sample user document
{
  employeeId: "CLS-ADM00046",
  name: "Rosalie G. Neptuno",
  email: "rosalie.neptuno@company.com",
  role: "Admin Operations",
  department: "Admin Operations",
  joinedDate: "2023-06-25",
  gender: "female",
  birthday: "2001-06-25",
  birthdayLeave: 1,
  sickLeave: 10
}
```

### How to: Fix UID Mismatch

If user cannot access their account:

1. Run `scripts/fix-uid-mismatch.js`
2. Or manually check:
   - Compare Firebase Auth UID with `users` collection document
   - Update reference in all collections

### How to: View All Leave Requests

1. Go to **History** page
2. Use filters (year, month, status, type)
3. Export data if needed

---

## Troubleshooting

### Login Issues

| Error | Solution |
|-------|---------|
| Invalid email format | Check email spelling |
| No account found | Verify user exists in Firestore `users` collection |
| Wrong password | Use Forgot Password or reset via Firebase Console |
| Account disabled | Contact HR to enable |

### Leave Balance Issues

| Issue | Solution |
|-------|---------|
| Balance shows 0 | Check joinedDate in user profile |
| Balance incorrect | Run `recalculate-leave-balances.js` |
| PTO not available | Verify ≥1 year service |

### Approval Issues

| Issue | Solution |
|-------|---------|
| Can't see requests | Verify targetReviewer matches your role |
| Request stuck | Check approval chain in logs |
| Balance not deducted | Verify final approval was from HR |

### Performance Issues

- App uses real-time listeners (Firestore onSnapshot)
- Large datasets may load slowly
- Pagination used for history (10/25/50 items)

---

## Support Contacts

| Role | Email |
|------|-------|
| HR | neptunorosalie25@gmail.com |
| Operations Supervisor | dhomsreantaso23@gmail.com |
| Account Supervisor | olympiab.oreste@gmail.com |
| Admin Manager | rizajane.amoncio@yahoo.com |

---

## Related Documentation

- [README.md](./README.md) - Basic setup and configuration
- [DAILY_SUMMARY.md](./DAILY_SUMMARY.md) - Development notes
- [TODO.md](./TODO.md) - Task list
- Firestore Console - Database management
- Firebase Console - Auth and hosting