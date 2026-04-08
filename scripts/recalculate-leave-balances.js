/**
 * Script to recalculate leave balances based on approved leave requests:
 * - Calculates total credits based on years of service + 1
 * - Subtracts all approved "Paid Time Off" leaves to get remaining balance
 * - Also processes pending leaves to show accurate pending deductions
 *
 * Usage: node scripts/recalculate-leave-balances.js
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  getCountFromServer,
  query,
  where,
} = require('firebase/firestore');

// Firebase config from environment.prod.ts (production)
const firebaseConfig = {
  apiKey: 'AIzaSyDhvTtu2a_CC3DdkIfA49qJWr5-cYpKvU0',
  authDomain: 'cor-logic-hris.firebaseapp.com',
  projectId: 'cor-logic-hris',
  storageBucket: 'cor-logic-hris.firebasestorage.app',
  messagingSenderId: '611895985104',
  appId: '1:611895985104:web:13747d65663a005a61afd5',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore();

function calculatePaidTimeOff(joinedDate, role) {
  if (!joinedDate) return 0;

  const joinDate = new Date(joinedDate);
  if (isNaN(joinDate.getTime())) return 0;

  const today = new Date();
  const yearsOfService = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  // Base credits: 1yr=5, 2yr=7, 4yr+=8
  let baseCredits = 0;
  if (yearsOfService >= 4) {
    baseCredits = 8;
  } else if (yearsOfService >= 2) {
    baseCredits = 7;
  } else if (yearsOfService >= 1) {
    baseCredits = 5;
  }

  // Add 1 extra credit for all employees
  let totalCredits = baseCredits + 1;

  // Cap at 10 for Admin Manager and Account Supervisor
  if (role === 'ADMIN MANAGER' || role === 'ACCOUNT SUPERVISOR') {
    totalCredits = Math.min(totalCredits, 10);
  }

  return totalCredits;
}

async function calculateApprovedLeaveDays(employeeId) {
  try {
    const requestsRef = collection(db, 'leaveRequests');

    // Query for approved Paid Time Off
    const q = query(
      requestsRef,
      where('employeeId', '==', employeeId),
      where('type', '==', 'Paid Time Off'),
      where('status', '==', 'Approved'),
    );

    const snapshot = await getDocs(q);
    let totalDays = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const days = data.noOfDays || data.totalDays || 1;
      totalDays += days;
      console.log(`    - Approved: ${data.period} (${days} day(s))`);
    });

    return totalDays;
  } catch (e) {
    console.log(`    Error calculating approved days: ${e.message}`);
    return 0;
  }
}

async function calculatePendingLeaveDays(employeeId) {
  try {
    const requestsRef = collection(db, 'leaveRequests');

    // Query for pending Paid Time Off (Pending, Awaiting HR Approval, Awaiting Admin Manager Approval)
    const q = query(
      requestsRef,
      where('employeeId', '==', employeeId),
      where('type', '==', 'Paid Time Off'),
    );

    const snapshot = await getDocs(q);
    let totalDays = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const status = data.status || '';
      if (
        status.includes('Pending') ||
        status === 'Awaiting HR Approval' ||
        status === 'Awaiting Admin Manager Approval'
      ) {
        const days = data.noOfDays || data.totalDays || 1;
        totalDays += days;
        console.log(`    - Pending: ${data.period} (${days} day(s)) - ${status}`);
      }
    });

    return totalDays;
  } catch (e) {
    console.log(`    Error calculating pending days: ${e.message}`);
    return 0;
  }
}

async function recalculateLeaveBalances() {
  console.log('\n========================================');
  console.log('Recalculating Leave Balances');
  console.log('========================================\n');

  try {
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    console.log(`Found ${usersSnapshot.size} users\n`);

    let updatedCount = 0;
    let noChangeCount = 0;
    let errorCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const email = userData.email || '';
      const name = userData.name || 'Unknown';
      const role = userData.role || '';
      const joinedDate = userData.joinedDate || '';
      const employeeId = userData.employeeId || 'N/A';
      const currentLeaveBalance = userData.leaveBalance || 0;

      // Skip users without employeeId or joinedDate
      if (!employeeId || employeeId === 'N/A' || !joinedDate) {
        console.log(`${employeeId} | ${name} - SKIPPED (no employeeId or joinedDate)`);
        noChangeCount++;
        continue;
      }

      // Calculate total credits based on years of service
      const totalCredits = calculatePaidTimeOff(joinedDate, role);

      if (totalCredits === 0) {
        console.log(`${employeeId} | ${name} - SKIPPED (no credits - joined: ${joinedDate})`);
        noChangeCount++;
        continue;
      }

      // Calculate used (approved) days
      console.log(`\n${employeeId} | ${name}`);
      console.log(`  Role: ${role}`);
      console.log(`  Joined: ${joinedDate}`);
      console.log(`  Current leaveBalance: ${currentLeaveBalance}`);
      console.log(`  Calculated total credits: ${totalCredits}`);
      console.log(`  Approved leaves:`);

      const approvedDays = await calculateApprovedLeaveDays(employeeId);
      console.log(`  Total approved days: ${approvedDays}`);

      // Calculate pending days
      console.log(`  Pending leaves:`);
      const pendingDays = await calculatePendingLeaveDays(employeeId);
      console.log(`  Total pending days: ${pendingDays}`);

      // Calculate remaining balance
      const remaining = totalCredits - approvedDays;
      const expectedBalance = remaining;

      console.log(`  Calculated remaining: ${remaining}`);

      // Check if update needed
      if (expectedBalance !== currentLeaveBalance) {
        console.log(`  >> NEEDS UPDATE: ${currentLeaveBalance} -> ${expectedBalance}`);

        // Update in Firestore
        const userRef = doc(db, 'users', userDoc.id);
        await updateDoc(userRef, {
          leaveBalance: expectedBalance,
          leaveBalanceNote: `Total: ${totalCredits}, Used: ${approvedDays}, Pending: ${pendingDays}, Remaining: ${expectedBalance}`,
        });

        updatedCount++;
      } else {
        console.log(`  >> No change needed`);
        noChangeCount++;
      }
    }

    console.log('\n========================================');
    console.log('Summary:');
    console.log(`  Updated: ${updatedCount} employees`);
    console.log(`  No change: ${noChangeCount} employees`);
    console.log(`  Errors: ${errorCount} employees`);
    console.log('========================================\n');

    console.log('Done! Leave balances have been recalculated based on approved leave requests.');
    console.log('Each employee now has: Total Credits - Approved Days = Remaining Balance');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
recalculateLeaveBalances()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
