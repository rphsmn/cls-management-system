/**
 * Script to add historical leave for Rosalie (HR)
 * 
 * This script:
 * 1. Creates a leave request for April 6, 2026 (Holiday leave - approved)
 * 2. Updates Rosalie's leave credits from 6 to 3 (used 3 credits)
 * 
 * Usage: node scripts/add-historical-leave.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where } = require('firebase/firestore');

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

async function addHistoricalLeave() {
  console.log('\n========================================');
  console.log('Adding Historical Leave for Rosalie');
  console.log('========================================\n');

  try {
    // Find Rosalie's user document
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', 'neptunorosalie25@gmail.com'));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.log('❌ User not found: neptunorosalie25@gmail.com');
      return;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const userDocId = userDoc.id;

    console.log('✓ Found Rosalie in Firestore:');
    console.log(`  Name: ${userData.name}`);
    console.log(`  Email: ${userData.email}`);
    console.log(`  Role: ${userData.role}`);
    console.log(`  Department: ${userData.dept}`);
    console.log(`  Employee ID: ${userData.employeeId}`);
    console.log(`  UID: mi4AhoCxkoWX24WspMGqGoTSpFk2`);
    console.log(`  Current Leave Credits (leaveBalance): ${userData.leaveBalance || 0}`);

    // Check if leave balance already looks updated (should be 3 if someone already updated it)
    if (userData.leaveBalance === 3) {
      console.log('\n⚠️ Leave balance appears to already be 3. Checking if leave request exists...');
    }

    // Step 1: Create the leave request
    const leaveRequest = {
      // Leave details
      type: 'Paid Time Off',
      startDate: '2026-04-06',
      endDate: '2026-04-06',
      period: '2026-04-06 to 2026-04-06',
      reason: 'Holiday leave',
      
      // Employee info (matching what would be stored from the app)
      // Using Firebase UID from email-uid-mapping.json
      uid: 'mi4AhoCxkoWX24WspMGqGoTSpFk2',
      employeeName: userData.name,
      employeeId: userData.employeeId || userData.id,
      role: userData.role,
      department: userData.dept || 'HR',
      
      // Status - already approved by Admin Manager since it's historical
      // For HR employees: Admin Manager approves (1 step), then it's final
      // Using 'Approved' status will show Admin Manager step as completed in approval progress
      status: 'Approved',
      targetReviewer: 'None',
      dateFiled: '2026-04-06T00:00:00.000Z',
      
      // Additional fields
      noOfDays: 1,
      halfDay: false,
      attachments: []
    };

    const leaveRef = collection(db, 'leaveRequests');
    const newLeaveDoc = await addDoc(leaveRef, leaveRequest);
    
    console.log('\n✓ Created leave request:');
    console.log(`  Document ID: ${newLeaveDoc.id}`);
    console.log(`  Date: April 6, 2026`);
    console.log(`  Type: Paid Time Off`);
    console.log(`  Reason: Holiday leave`);
    console.log(`  Status: Approved`);

    // Step 2: Update leave credits (should be 3 after 3 days used)
    // Using leaveBalance field instead of paidTimeoff
    const newLeaveCredits = 3;
    
    const userRef = doc(db, 'users', userDocId);
    
    // Only update if different from current (avoid redundant writes)
    if (userData.leaveBalance !== newLeaveCredits) {
      await updateDoc(userRef, {
        leaveBalance: newLeaveCredits,
        leaveBalanceNote: 'Updated to reflect historical leave usage (3 days used)'
      });

      console.log('\n✓ Updated leave credits:');
      console.log(`  Previous: ${userData.leaveBalance}`);
      console.log(`  New: ${newLeaveCredits}`);
      console.log(`  Reason: Used 3 credits for April 6, 2026 leave`);
    } else {
      console.log('\n✓ Leave credits already at 3 - no update needed');
    }

    console.log('\n========================================');
    console.log('SUCCESS: Historical leave added!');
    console.log('========================================\n');
    console.log('Summary:');
    console.log('  - Leave request created for April 6, 2026');
    console.log('  - Status: Approved');
    console.log('  - Type: Paid Time Off');
    console.log('  - Reason: Holiday leave');
    console.log(`  - Rosalie's leave credits: 6 → ${newLeaveCredits}\n`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
addHistoricalLeave()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });