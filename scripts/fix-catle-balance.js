/**
 * Script to fix Catle's leave balance based on years of service logic
 * Catle: joined 21-Oct-24, ~1.5 years of service = 5 + 1 = 6 total credits
 * Used: 4.5 days, Remaining should be: 1.5 days
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyDhvTtu2a_CC3DdkIfA49qJWr5-cYpKvU0',
  authDomain: 'cor-logic-hris.firebaseapp.com',
  projectId: 'cor-logic-hris',
  storageBucket: 'cor-logic-hris.firebasestorage.app',
  messagingSenderId: '611895985104',
  appId: '1:611895985104:web:13747d65663a005a61afd5',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore();

async function fixCatleBalance() {
  console.log('Fixing Catle leave balance based on years of service...\n');

  // Find Catle
  const q = query(collection(db, 'users'), where('employeeId', '==', 'CLS-DEV00044'));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.log('Catle not found!');
    return;
  }

  const userDoc = snap.docs[0];
  const userData = userDoc.data();

  console.log('Current data:');
  console.log('  Name:', userData.name);
  console.log('  Role:', userData.role);
  console.log('  joinedDate:', userData.joinedDate);
  console.log('  Current leaveBalance:', userData.leaveBalance);

  // Calculate total based on years of service
  const joinDate = new Date(userData.joinedDate);
  const today = new Date('2026-04-08'); // Use current date
  const yearsOfService = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  console.log('  Years of service:', yearsOfService.toFixed(2), 'years');

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
  const totalCredits = baseCredits + 1;

  console.log('  Base credits:', baseCredits);
  console.log('  +1 extra credit');
  console.log('  Total credits:', totalCredits);

  // Get used days from leave requests
  const leaveQ = query(collection(db, 'leaveRequests'), where('employeeId', '==', 'CLS-DEV00044'));
  const leaveSnap = await getDocs(leaveQ);

  let usedDays = 0;
  for (const d of leaveSnap.docs) {
    const data = d.data();
    const type = data.type || '';
    const status = data.status || '';
    // Handle both "Paid Time Off" and "Paid Time off" (case variation)
    const isPaidLeave = type.toLowerCase().includes('paid time');

    if (isPaidLeave && status === 'Approved') {
      const days = data.daysDeducted ?? data.noOfDays ?? 0;
      console.log(
        `  Leave: ${data.period} - daysDeducted: ${data.daysDeducted}, type: ${data.type}`,
      );
      if (days > 0) usedDays += days;
    }
  }

  console.log('  Total used:', usedDays, 'days');

  const remaining = totalCredits - usedDays;
  console.log('  Calculated remaining:', remaining, 'days');

  // Update Firestore
  const userRef = doc(db, 'users', userDoc.id);
  await updateDoc(userRef, {
    leaveBalance: remaining,
    leaveBalanceNote: `Total: ${totalCredits} (${yearsOfService.toFixed(2)} yrs service), Used: ${usedDays}, Remaining: ${remaining}`,
  });

  console.log('\nUpdated leaveBalance to:', remaining);
}

fixCatleBalance()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
