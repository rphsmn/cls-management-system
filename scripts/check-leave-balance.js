/**
 * Script to check current leave balance in Firestore
 * 
 * Usage: node scripts/check-leave-balance.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

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

async function checkLeaveBalance() {
  console.log('\n========================================');
  console.log('Checking Leave Balance in Firestore');
  console.log('========================================\n');

  try {
    // Get Rosalie's user document
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', 'neptunorosalie25@gmail.com'));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.log('❌ User not found');
      return;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('Rosalie User Document:');
    console.log(`  leaveBalance: ${userData.leaveBalance}`);
    console.log(`  leaveBalanceNote: ${userData.leaveBalanceNote}`);
    console.log(`  role: ${userData.role}`);
    console.log(`  joinedDate: ${userData.joinedDate}`);
    console.log('');

    // Also check leave requests
    const requestsRef = collection(db, 'leaveRequests');
    const requestsQuery = query(requestsRef, where('employeeName', '==', 'Rosalie Gñotob Neptuno'));
    const requestsSnapshot = await getDocs(requestsQuery);
    
    console.log(`Rosalie's Leave Requests: ${requestsSnapshot.size} total`);
    
    let ptoApproved = 0;
    for (const doc of requestsSnapshot.docs) {
      const data = doc.data();
      if (data.type === 'Paid Time Off' && data.status === 'Approved') {
        ptoApproved++;
        console.log(`  - ${data.period} | ${data.type} | ${data.status} | noOfDays: ${data.noOfDays}`);
      }
    }
    console.log(`  Paid Time Off Approved: ${ptoApproved}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkLeaveBalance()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });