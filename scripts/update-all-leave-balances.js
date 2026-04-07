/**
 * Script to update all employees' leave balances based on new logic:
 * - Years of Service: 1yr=5, 2yr=7, 4yr+=8
 * - Plus 1 extra leave credit for all employees
 * - Admin Manager and Account Supervisor get 10 fixed (no extra)
 * - Skips Ranilyn (student/intern)
 * 
 * Usage: node scripts/update-all-leave-balances.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

// Firebase config from environment.prod.ts (production)
const firebaseConfig = {
  apiKey: "AIzaSyDhvTtu2a_CC3DdkIfA49qJWr5-cYpKvU0",
  authDomain: "cor-logic-hris.firebaseapp.com",
  projectId: "cor-logic-hris",
  storageBucket: "cor-logic-hris.firebasestorage.app",
  messagingSenderId: "611895985104",
  appId: "1:611895985104:web:13747d65663a005a61afd5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Skip these employees (student/interns)
const SKIP_EMPLOYEES = ['CLS-ADM00051']; // Ranilyn

function calculatePaidTimeOff(joinedDate, role) {
  // ADMIN MANAGER and ACCOUNT SUPERVISOR get fixed 10 days (no extra)
  if (role === 'ADMIN MANAGER' || role === 'ACCOUNT SUPERVISOR') {
    return 10;
  }
  
  if (!joinedDate) return 0;
  
  const joinDate = new Date(joinedDate);
  if (isNaN(joinDate.getTime())) return 0;
  
  const today = new Date();
  const yearsOfService = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  
  // Years of Service Credit Entitlement
  // Upon 1 yr. in Service: 5 Days
  // 2nd Year of Service: 7 Days
  // 4 Years and above: 8 Days
  let baseCredits = 0;
  if (yearsOfService >= 4) {
    baseCredits = 8;
  } else if (yearsOfService >= 2) {
    baseCredits = 7;
  } else if (yearsOfService >= 1) {
    baseCredits = 5;
  }
  
  // Add 1 extra credit for all employees
  return baseCredits + 1;
}

async function updateAllLeaveBalances() {
  console.log('\n========================================');
  console.log('Updating All Employees Leave Balances');
  console.log('(Skipping student/interns)');
  console.log('========================================\n');

  try {
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    console.log(`Found ${usersSnapshot.size} users\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const name = userData.name || 'Unknown';
      const role = userData.role || '';
      const joinedDate = userData.joinedDate || '';
      const employeeId = userData.employeeId || 'N/A';
      
      // Skip student/interns
      if (SKIP_EMPLOYEES.includes(employeeId)) {
        console.log(`${employeeId} | ${name} - SKIPPED (student/intern)`);
        skippedCount++;
        continue;
      }
      
      // Calculate new leave balance
      const newBalance = calculatePaidTimeOff(joinedDate, role);
      
      if (newBalance > 0) {
        console.log(`${employeeId} | ${name}`);
        console.log(`  Role: ${role}`);
        console.log(`  Joined: ${joinedDate || 'N/A'}`);
        console.log(`  New Balance: ${newBalance}`);
        
        // Update in Firestore
        const userRef = doc(db, 'users', userDoc.id);
        await updateDoc(userRef, {
          leaveBalance: newBalance,
          leaveBalanceNote: `Updated: ${newBalance} credits based on years of service + 1 extra`
        });
        
        updatedCount++;
      } else {
        console.log(`${employeeId} | ${name} - No credits (joined: ${joinedDate || 'N/A'})`);
        skippedCount++;
      }
      console.log('');
    }
    
    console.log('========================================');
    console.log(`Summary:`);
    console.log(`  Updated: ${updatedCount} employees`);
    console.log(`  Skipped: ${skippedCount} employees (students/interns)`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
updateAllLeaveBalances()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });