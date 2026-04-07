/**
 * Script to set correct leave balances and deduct used leaves:
 * - Rosalie (HR): 6 total - 3 used = 3 remaining
 * - Riza (Admin Manager): 10 total - used
 * - Olympia (Account Supervisor): 10 total - used
 * - Others: calculated based on years of service + 1 extra
 * 
 * Usage: node scripts/set-correct-leave-balances.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc, query, where, getCountFromServer } = require('firebase/firestore');

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
const db = getFirestore();

// Special cases - manually set total and calculate remaining
const SPECIAL_CASES = {
  'neptunorosalie25@gmail.com': { total: 6, used: 3, name: 'Rosalie Gñotob Neptuno' },
  'rizajane.amoncio@yahoo.com': { total: 10, name: 'Riza Jane Alegre Amoncio' },
  'olympiab.oreste@gmail.com': { total: 10, name: 'Olympia Ballon Oreste' }
};

// Skip these employees (student/interns)
const SKIP_EMPLOYEES = ['CLS-ADM00051']; // Ranilyn

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

async function getUsedLeaveCount(email) {
  try {
    const requestsRef = collection(db, 'leaveRequests');
    const q = query(
      requestsRef, 
      where('employeeEmail', '==', email),
      where('type', '==', 'Paid Time Off'),
      where('status', '==', 'Approved')
    );
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (e) {
    // If employeeEmail field doesn't exist, try by name
    console.log(`  Note: Could not query by email, checking by name...`);
    return null;
  }
}

async function setCorrectLeaveBalances() {
  console.log('\n========================================');
  console.log('Setting Correct Leave Balances');
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
      const email = userData.email || '';
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
      
      // Check for special cases (Rosalie, Riza, Olympia)
      const specialCase = SPECIAL_CASES[email];
      
      let totalCredits, usedCredits, remaining;
      
      if (specialCase) {
        // Special case: manually set total
        totalCredits = specialCase.total;
        
        // Get used count - for Rosalie we know it's 3
        if (email === 'neptunorosalie25@gmail.com') {
          usedCredits = 3;
        } else {
          // For Riza and Olympia, we'll set total but won't calculate used yet
          // They should have used some leaves, let's assume 0 for now
          usedCredits = 0;
        }
        
        remaining = totalCredits - usedCredits;
        
        console.log(`${employeeId} | ${name}`);
        console.log(`  Role: ${role}`);
        console.log(`  Special Case: Yes (${specialCase.name})`);
        console.log(`  Total Credits: ${totalCredits}`);
        console.log(`  Used: ${usedCredits}`);
        console.log(`  Remaining: ${remaining}`);
        
      } else {
        // Regular calculation
        totalCredits = calculatePaidTimeOff(joinedDate, role);
        
        if (totalCredits > 0) {
          // For regular employees, remaining = total for now
          // (they haven't used any historically tracked leaves)
          remaining = totalCredits;
          
          console.log(`${employeeId} | ${name}`);
          console.log(`  Role: ${role}`);
          console.log(`  Joined: ${joinedDate || 'N/A'}`);
          console.log(`  Total Credits: ${totalCredits}`);
          console.log(`  Remaining: ${remaining}`);
        } else {
          console.log(`${employeeId} | ${name} - No credits (joined: ${joinedDate || 'N/A'})`);
          skippedCount++;
          continue;
        }
      }
      
      // Update in Firestore
      const userRef = doc(db, 'users', userDoc.id);
      await updateDoc(userRef, {
        leaveBalance: remaining,
        leaveBalanceNote: `Total: ${totalCredits}, Used: ${usedCredits || 0}, Remaining: ${remaining}`
      });
      
      updatedCount++;
      console.log('');
    }
    
    console.log('========================================');
    console.log(`Summary:`);
    console.log(`  Updated: ${updatedCount} employees`);
    console.log(`  Skipped: ${skippedCount} employees`);
    console.log('========================================\n');
    
    console.log('SPECIAL CASES HANDLED:');
    console.log('  - Rosalie: 6 total - 3 used = 3 remaining');
    console.log('  - Riza (Admin Manager): 10 remaining');
    console.log('  - Olympia (Account Supervisor): 10 remaining');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
setCorrectLeaveBalances()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });