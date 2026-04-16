# CLS HRIS - Human Resources Information System

A comprehensive Angular-based HR management system with Firebase backend for managing employee leave requests, approvals, tracking, and organization-wide employee status.

---

## Table of Contents

1. [Quick Overview](#quick-overview)
2. [For Employees](#for-employees)
3. [For Management](#for-management)
4. [For Developers](#for-developers)
5. [Troubleshooting](#troubleshooting)
6. [Support](#support)

---

## Quick Overview

| Aspect | Details |
|--------|---------|
| **Platform** | Web-based HR Portal |
| **Frontend** | Angular 17+ |
| **Backend** | Firebase Firestore |
| **Auth** | Firebase Authentication |
| **URL** | hris-corlogic.vercel.app|

### Navigation

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Overview, stats, quick links |
| `/file-leave` | File Leave | Submit leave request |
| `/history` | Leave History | View your leave history |
| `/approvals` | Approvals | Approve/reject requests |
| `/employees` | Employees | Employee directory |
| `/calendar` | Calendar | Team calendar |
| `/profile` | Profile | Your profile & info |
| `/audit-logs` | Audit Logs | Activity logs |

---

## For Employees

### Getting Started

#### Logging In
1. Go to the HRIS portal
2. Enter your **company email** and **password**
3. Click Sign In
4. Use "Forgot Password" if needed

> **Mobile-Friendly**: The portal is fully responsive. You can file leave, check your balance, view the calendar, and manage requests from your phone while on the go.

#### Navigation
- **Dashboard**: Leave balance summary, recent requests, quick actions
- **File Leave**: Submit new leave request
- **History**: View all your past leave requests
- **Profile**: View/update your information

---

### Leave Types

| Leave Type | Entitlement | Deducted? | Requirements |
|-----------|-------------|-----------|--------------|
| **Paid Time Off** | 6-9 days | Yes | ≥1 year service |
| **Sick Leave** | Same as PTO | Yes | No tenure requirement |
| **Birthday Leave** | 1 day | No | Must be in birth month |
| **Maternity Leave** | 105 days | No | Female employees only |
| **Paternity Leave** | 7 days | No | Male employees only |
| **Leave Without Pay** | Unlimited | No | No balance needed |

### Paid Time Off (PTO) - How It Works

```
< 1 year:      0 credits (cannot file PTO)
1 year:        5 base + 1 bonus = 6 credits
2 years:       7 base + 1 bonus = 8 credits
4+ years:      8 base + 1 bonus = 9 credits

Admin Manager / Account Supervisor: Fixed 10 days
```

**Key Points**:
- **Dynamic**: PTO is calculated fresh every time based on your `joinedDate` and today's date
- **Continuous**: No yearly reset. On Jan 1, it auto-calculates using that year's date
- **Automatic increase**: When you reach 2 years or 4 years of service, your total credits increase automatically
  - Example: At 1 year with 6 credits, you use 5 → 1 remaining
  - At 2 years: total becomes 8 → remaining becomes 3 (8 - 5 = 3)
- **Recalculated on**: Leave approval, login, dashboard load

---

### How to File a Leave Request

1. Click **File Leave** in sidebar
2. Select **Leave Type**
3. Choose **Start Date** and **End Date**
4. Provide **Reason**
5. For sick leave 3+ days: Upload medical certificate
6. Click **Submit Request**

**Requirements**:
- Paid Time Off: Must have ≥1 year of service
- Sick Leave: Available immediately
- Birthday Leave: Must be in your birth month
- Maternity/Paternity: Gender must be set in profile

---

### How to View Your History

1. Click **History** in sidebar
2. Filter by: Year, Month, Status, Leave Type
3. View: Type, Period, Days, Status, Date Filed

---

### How to View/Update Your Profile

1. Click **Profile** in sidebar
2. View: Name, Role, Department, Employee ID, Leave balances, Government IDs, Emergency contact
3. Click **Request Update** to submit changes

---

### Understanding Leave Status

| Status | Meaning |
|--------|---------|
| **Pending** | Submitted, waiting for approval |
| **Awaiting HR Approval** | Approved by supervisor, waiting for HR |
| **Approved** | Fully approved, leave is granted |
| **Rejected by [Role]** | Declined by approver |
| **Cancelled** | Withdrawn by employee |

---

## For Management

### Approval Workflow

#### Approval Chain by Role

| Employee Role | 1st Approver | 2nd Approver (Final) |
|--------------|-------------|---------------------|
| Operations Admin | Ops Admin Sup | HR |
| Accounts Staff | Account Sup | HR |
| IT Developer | Admin Manager | HR |
| HR | Admin Manager | - (Final) |
| Admin Manager | HR | - (Final) |
| Part-time | HR | - (Direct) |

#### How to Approve a Leave Request

1. Click **Approvals** in sidebar
2. View pending requests (filtered by your role)
3. Click on a request to see details
4. Click **Approve** or **Reject**
5. Confirm in dialog
6. Employee receives notification

#### Approval Status Flow

```
Pending
  ↓ (1st approval)
Awaiting [Role] Approval
  ↓ (2nd approval = Final)
Approved  ← Leave balance deducted here
  OR
Rejected by [Role]
```

**Important**: Leave balance is only deducted when HR gives the **final approval**.

---

### Managing Employee Directory

#### Viewing Employee Status

1. Navigate to **Employees**
2. Status types:
   - **Active** (green): In office
   - **On Leave** (blue): Currently on approved leave
   - **Upcoming Leave** (yellow): Leave starting within 3 days
   - **Absent** (red): Manually marked by HR

#### Marking Employees as Absent (HR Only)

HR can manually mark employees as absent for auditing:

1. Click on employee card (HR only)
2. Select **Mark as Absent**
3. Provide reason (optional)
4. Confirm

**How it works**:
- Shows as "Absent" for **3 days** from marking date
- After 3 days: UI auto-hides, but database record persists
- NOT automatically overwritten if employee files leave after
- HR must manually remove when needed

**To Remove**:
1. Click employee's card
2. Select **Remove Absent Status**

---

### Reporting & Compliance

#### Leave Reports (Calendar)

Management can see "Who is out this month":

1. Navigate to **Calendar**
2. View color-coded team calendar
3. Shows all approved leaves
4. Filter by employee or leave type

#### Audit Logs

All actions are logged for transparency:

- **Who** approved/rejected a request
- **When** the action was taken
- **What** changed (status, balance, etc.)

**Key logged actions**:
- `leave_submitted` - Employee files leave
- `leave_approved` - Manager approves
- `leave_rejected` - Manager rejects
- `leave_cancelled` - Employee cancels
- `absent_marked` - HR marks employee absent
- `profile_updated` - Profile changes

**To view**:
1. Click **Audit Logs**
2. Filter by: Time period, Action type, User

---

### Role Permissions Summary

| Role | Can File Leave | Can Approve | Can View All Employees | Can Mark Absent |
|------|--------------|-------------|---------------------|----------------|
| Part-time | No PTO | No | No | No |
| Staff | Yes | Level 1 | Department | No |
| Supervisor | Yes | Level 1-2 | Department | No |
| IT Developer | Yes | Level 2 | All | No |
| HR | Yes | Final | All | Yes |
| Admin Manager | Yes | Level 2/Final | All | Yes |

---

## For Developers

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17+ (standalone components) |
| Backend | Firebase Firestore (NoSQL) |
| Auth | Firebase Authentication |
| Hosting | Firebase Hosting / Vercel |
| Styling | Custom CSS with CSS variables |

### Project Structure

```
src/app/
├── core/
│   ├── components/main-layout/   # Main app shell
│   ├── services/                  # Auth, Leave, Notification, etc.
│   ├── guards/                    # AuthGuard
│   └── utils/                     # Date, Workday calculators
├── features/
│   ├── auth/                      # Login, Forgot/Reset Password
│   ├── dashboard/                # Main dashboard
│   ├── leave/                     # File Leave, History
│   ├── approvals/                # Approve/Reject requests
│   ├── employees/                # Employee directory
│   ├── calendar/                 # Team calendar
│   ├── profile/                  # User profile
│   ├── audit-logs/               # Activity logs
│   └── admin/                    # Admin functions
└── environments/                  # Firebase config
```

### Firestore Collections

| Collection | Description |
|-----------|------------|
| `users` | Employee profiles |
| `leaveRequests` | Leave request documents |
| `notifications` | In-app notifications |
| `auditLogs` | Activity logs |
| `companyEvents` | Holidays/events |

### User Document Schema

**Required fields**:
```javascript
{
  employeeId: "CLS-ADM00046",  // Unique ID
  name: "Rosalie G. Neptuno",
  email: "user@company.com",
  role: "Admin Operations",
  department: "Admin Operations",
  joinedDate: "2023-06-25"     // For PTO calculation
}
```

**Optional fields**:
```javascript
{
  gender: "male|female",       // For maternity/paternity
  birthday: "2001-06-25",      // For birthday leave
  birthdayLeave: 1,
  sickLeave: 10,
  leaveBalance: 6,
  leaveBalanceNote: "Total: 6, Used: 0, Remaining: 6",
  tin: "05-1700807-4",
  sss: "102502156109",
  philhealth: "121326048624",
  pagibig: "659-068-321-0000",
  mobileNo: "09123456789",
  address: "123 Main St, City",
  emergencyContactPerson: "John Doe",
  emergencyContactRelation: "Spouse",
  emergencyContactMobile: "09876543210"
}
```

### Leave Request Document Schema

```javascript
{
  uid: "firebase-auth-uid",
  employeeId: "CLS-ADM00046",
  employeeName: "Rosalie G. Neptuno",
  role: "Admin Operations",
  department: "Admin Operations",
  type: "Paid Time Off",
  startDate: "2026-04-20",
  endDate: "2026-04-22",
  period: "2026-04-20 to 2026-04-22",
  noOfDays: 3,
  daysDeducted: 3,          // 0.5 for half-day
  reason: "Personal matter",
  attachment: { name, data, type },
  status: "Pending",          // Pending, Approved, Rejected, Cancelled
  targetReviewer: "HR",       // Who should approve next
  dateFiled: "2026-04-16T08:00:00Z"
}
```

### Security Rules

```javascript
// firestore.rules
- users: Create=HR only, Read=self+HR, Update=self+HR
- leaveRequests: Create=Auth, Read=self+HR/Sup, Update=HR/Sup
- notifications: Read=owner+HR
- auditLogs: Read=HR only
```

### Key Services

| Service | File | Purpose |
|---------|------|---------|
| `AuthService` | `core/services/auth.ts` | Login, logout, user profile, PTO calculation |
| `LeaveService` | `core/services/leave.services.ts` | CRUD, approval workflow, balance |
| `NotificationService` | `core/services/notification.service.ts` | In-app notifications |
| `AuditService` | `core/services/audit.service.ts` | Activity logging |
| `HolidayService` | `core/services/holiday.service.ts` | Holiday dates |

### Core Logic: PTO Calculation

```typescript
// auth.ts:76-125
export function calculatePaidTimeOff(joinedDate: string, role: string): number {
  const yearsOfService = (today - joinDate) / 365.25;

  // Base credits by tenure
  let baseCredits = 0;
  if (yearsOfService >= 4) baseCredits = 8;
  else if (yearsOfService >= 2) baseCredits = 7;
  else if (yearsOfService >= 1) baseCredits = 5;

  // Add bonus credit for 1+ years
  let totalCredits = baseCredits;
  if (yearsOfService >= 1) totalCredits = baseCredits + 1;

  // Cap for Admin roles
  if (role === 'ADMIN MANAGER' || role === 'ACCOUNT SUPERVISOR') {
    totalCredits = Math.min(totalCredits, 10);
  }

  return totalCredits;
}
```

### Theming

The system uses **Custom CSS Specificity Chain** for Dark Theme:

- High-specificity CSS overrides ensure consistent **white-on-navy** contrast
- Dark theme: `--bg-primary: #0f172a` (navy), `--text-primary: #f8fafc` (white)
- CSS variables with `!important` where needed for component-level overrides

### Common Dev Tasks

#### Reset Employee Password
1. Firebase Console → Authentication
2. Find user by email
3. Click "Reset password"

#### Manually Adjust Leave Balance
1. Firestore Console → `users` collection
2. Update `leaveBalance` field
3. Update `leaveBalanceNote`: "Total: X, Used: Y, Remaining: Z"

#### Run Fix Scripts
```bash
node scripts/fix-uid-mismatch.js
node scripts/recalculate-leave-balances.js
node scripts/fix-all-uid-mismatches.js
```

### Support Contacts

| Role | Email |
|------|-------|
| HR | neptunorosalie25@gmail.com |
| Operations Supervisor | dhomsreantaso23@gmail.com |
| Account Supervisor | olympiab.oreste@gmail.com |
| Admin Manager | rizajane.amoncio@yahoo.com |

---

## Troubleshooting

### Login Issues

| Error | Solution |
|-------|---------|
| Invalid email format | Check email spelling |
| No account found | Verify user in Firestore `users` collection |
| Wrong password | Use Forgot Password or reset via Firebase Console |
| Account disabled | Contact HR |

### Leave Balance Issues

| Issue | Solution |
|-------|---------|
| Balance shows 0 | Check `joinedDate` in user profile |
| Balance incorrect | Run `recalculate-leave-balances.js` |
| Can't file PTO | Verify ≥1 year service |

### Approval Issues

| Issue | Solution |
|-------|---------|
| Can't see requests | Check if `targetReviewer` matches your role |
| Request stuck | Check approval chain in Audit Logs |
| Balance not deducted | Verify final approval was from HR |

### Performance

- Uses real-time listeners (Firestore onSnapshot)
- Large datasets may load slowly
- Pagination: 10/25/50 items per page

---

## Related Documentation

- [SYSTEM_GUIDE.md](./SYSTEM_GUIDE.md) - Detailed system reference
- [DAILY_SUMMARY.md](./DAILY_SUMMARY.md) - Development notes
- [TODO.md](./TODO.md) - Task list
