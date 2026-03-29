# Daily Summary - March 24, 2026

## Performance Optimizations Completed

### 1. Leave Request Loading
- **Issue**: Loading ALL leave requests was causing slow page loads
- **Fix**: Added `limit(100)` to Firestore query to load only the 100 most recent requests
- **File**: [`src/app/core/services/leave.services.ts`](src/app/core/services/leave.services.ts:53)

### 2. Auth Service Improvements
- **Issue**: Memory leaks from unclosed subscriptions, redundant Firestore queries
- **Fix**: Added proper cleanup, user profile caching (1 min), and duplicate prevention
- **File**: [`src/app/core/services/auth.ts`](src/app/core/services/auth.ts:98)

### 3. Dashboard Performance
- **Issue**: Expensive recalculations on every data change
- **Fix**: Added debouncing (100ms), shareReplay caching, pre-computed holiday list
- **File**: [`src/app/features/dashboard/dashboard.ts`](src/app/features/dashboard/dashboard.ts:25)

### 4. History Component
- **Issue**: Filter operations running too frequently
- **Fix**: Added debouncing (200ms), cached pagination results
- **File**: [`src/app/features/leave/history/history.component.ts`](src/app/features/leave/history/history.component.ts:36)

---

## New Features Summary

### Leave Request System
- Employees can file leave requests (Paid Time Off, Birthday Leave, Maternity/Paternity Leave, Leave Without Pay)
- Paid Time Off is calculated dynamically based on years of service (5/7/8 days)
- Birthday Leave is available during birth month only
- Multi-level approval workflow based on employee role

### HR Capabilities (New Today)
✅ HR can file their own leave requests
✅ HR can add company events to the calendar page
✅ HR can view all employee leave requests
✅ HR can approve/reject leave requests

### Calendar Features
- Company events can be added by HR
- Holiday listings stored in localStorage
- Visual calendar view for scheduling

---

## Impact
- Faster initial page load (loading 100 records vs potentially thousands)
- Reduced memory usage with proper subscription cleanup
- Smoother UI interactions with debouncing
- No redundant Firestore queries with caching
