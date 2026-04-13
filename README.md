# CLS HRIS — Human Resources Information System

A comprehensive, high-fidelity **Angular-based** management system integrated with a **Firebase** backend. Designed to streamline employee leave requests, multi-level approvals, and immutable audit tracking.

---

## 📑 Table of Contents
1. [User Manual](#user-manual)
2. [Technical Documentation](#technical-documentation)
3. [System Architecture](#system-architecture)
4. [API & Data Schema](#api-data-schema)

---

# 👤 User Manual
*A comprehensive guide for HR personnel and staff.*

## 🏁 Getting Started
### **Logging In**
1. Navigate to the portal URL.
2. Enter your corporate email and password.
3. If credentials are lost, utilize the **Forgot Password** link for a secure reset.

### **Sidebar Navigation**
* **Dashboard:** High-level overview and quick statistics.
* **File Leave:** Interface for submitting new leave requests.
* **History:** Personal log of all previous leave submissions.
* **Approvals:** (Admin/Supervisor only) Management of pending requests.
* **Calendar:** Centralized team availability view.
* **Employees:** Corporate directory and profile management.
* **Audit Logs:** Security-focused system activity tracking.

---

## ✅ How to Approve a Leave Request
1. Click **Approvals** in the sidebar.
2. Review the list of pending requests.
3. Select a request to view detailed reasons and attachments.
4. **Approve:** Finalizes the step or moves to the next level.
5. **Reject:** Denies the request (requires a reason).

### **Approval Workflow Logic**
| Employee Role | Approval Chain |
| :--- | :--- |
| **Operations Admin** | Supervisor → HR |
| **Accounts Staff** | Supervisor → HR |
| **IT Developer** | Admin Manager → HR |
| **HR Staff** | Admin Manager → HR |
| **Admin Manager** | HR (Final) |
| **Part-time** | HR (Direct) |

---

## 📝 How to File a Leave Request
1. Select **File Leave** from the sidebar.
2. Choose the **Leave Type** and set your date range.
3. **Requirement:** For Sick Leave exceeding 3 days, a medical certificate upload is mandatory.
4. Submit the request for the automated approval chain to begin.

### **Leave Entitlements (PTO/Sick Leave)**
| Tenure / Role | Credit Entitlement |
| :--- | :--- |
| **Upon 1 Year in Service** | 5 Days |
| **2nd Year of Service** | 7 Days |
| **4 Years and above** | 8 Days |
| **Admin Manager / Supervisor** | 10 Days (Fixed) |

* **Birthday Leave:** 1 Day (usable during birth month).
* **Maternity/Paternity:** 105 days (F) / 7 days (M).
* **Leave Without Pay (LWOP):** Unlimited (subject to approval).

---

# 🛠 Technical Documentation

## **Project Setup**
### **Prerequisites**
* Node.js 18+
* npm 9+
* Active Firebase Project

### **Installation & Deployment**
```bash
# Install dependencies
npm install

# Serve locally (localhost:4200)
npm start

# Production Build
npm run build
