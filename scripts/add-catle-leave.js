/**
 * Script to add historical leave for Catle, Benzel Mikko (CLS-DEV00044)
 *
 * Leave Entries:
 * - Paid Leave: 13-Jan-26 (1 Day)
 * - Paid Leave: 21-Jan-26 (0.5 Day)
 * - Paid Leave: 23-Feb-26 – 25-Feb-26 (3 Days)
 *
 * Total: 4.5 days
 *
 * Usage: node scripts/add-catle-leave.js
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
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
const db = getFirestore(app);

// Historical leave entries for Catle
const leaveEntries = [
  {
    startDate: '2026-01-13',
    endDate: '2026-01-13',
    period: '2026-01-13 to 2026-01-13',
    noOfDays: 1,
    halfDay: false,
    reason: 'Historical leave from office logs',
  },
  {
    startDate: '2026-01-21',
    endDate: '2026-01-21',
    period: '2026-01-21 to 2026-01-21',
    noOfDays: 0.5,
    halfDay: true,
    reason: 'Historical leave from office logs',
  },
  {
    startDate: '2026-02-23',
    endDate: '2026-02-25',
    period: '2026-02-23 to 2026-02-25',
    noOfDays: 3,
    halfDay: false,
    reason: 'Historical leave from office logs',
  },
];

async function addCatleHistoricalLeave() {
  console.log('\n========================================');
  console.log('Adding Historical Leave for Catle');
  console.log('========================================\n');

  try {
    // Find Catle's user document by employeeId
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('employeeId', '==', 'CLS-DEV00044'));
    const userSnapshot = await getDocs(userQuery);

    // If not found by employeeId, try to find by name
    let userDoc, userData, userDocId;

    if (userSnapshot.empty) {
      console.log('Not found by employeeId, trying name search...');
      const nameQuery = query(usersRef, where('name', '==', 'Catle, Benzel Mikko'));
      const nameSnapshot = await getDocs(nameQuery);

      if (nameSnapshot.empty) {
        console.log('Not found by name either, trying partial name (Catle)...');
        // Get all users and filter
        const allUsers = await getDocs(usersRef);
        const catleUser = allUsers.docs.find((d) => {
          const name = d.data().name || '';
          return name.toLowerCase().includes('catle') || name.toLowerCase().includes('benzel');
        });

        if (!catleUser) {
          console.log('❌ User not found: Catle, Benzel Mikko (CLS-DEV00044)');
          return;
        }

        userDoc = catleUser;
        userData = userDoc.data();
        userDocId = userDoc.id;
      } else {
        userDoc = nameSnapshot.docs[0];
        userData = userDoc.data();
        userDocId = userDoc.id;
      }
    } else {
      userDoc = userSnapshot.docs[0];
      userData = userDoc.data();
      userDocId = userDoc.id;
    }

    console.log('✓ Found Catle in Firestore:');
    console.log(`  Name: ${userData.name}`);
    console.log(`  Email: ${userData.email}`);
    console.log(`  Role: ${userData.role}`);
    console.log(`  Department: ${userData.dept}`);
    console.log(`  Employee ID: ${userData.employeeId}`);
    console.log(`  UID: ${userData.uid}`);
    console.log(`  Current Leave Credits (leaveBalance): ${userData.leaveBalance || 0}`);

    const leaveRef = collection(db, 'leaveRequests');
    let createdCount = 0;

    // Create leave requests for each entry
    for (const entry of leaveEntries) {
      const leaveRequest = {
        type: 'Paid Time Off',
        startDate: entry.startDate,
        endDate: entry.endDate,
        period: entry.period,
        reason: entry.reason,

        // Employee info
        uid: userData.uid || '',
        employeeName: userData.name,
        employeeId: userData.employeeId || userData.id,
        role: userData.role,
        department: userData.dept || userData.department,

        // Status - approved (historical leave)
        status: 'Approved',
        targetReviewer: 'None',
        dateFiled: `${entry.startDate}T00:00:00.000Z`,

        // Additional fields
        noOfDays: entry.noOfDays,
        halfDay: entry.halfDay,
        daysDeducted: entry.noOfDays,
        attachments: [],
      };

      const newLeaveDoc = await addDoc(leaveRef, leaveRequest);
      createdCount++;

      console.log(`\n✓ Created leave request ${createdCount}:`);
      console.log(`  Document ID: ${newLeaveDoc.id}`);
      console.log(`  Date: ${entry.period}`);
      console.log(`  Type: Paid Time Off`);
      console.log(`  Days: ${entry.noOfDays}`);
      console.log(`  Status: Approved`);
    }

    // Calculate total days used
    const totalDaysUsed = leaveEntries.reduce((sum, e) => sum + e.noOfDays, 0);

    // Get current balance and calculate new balance
    const currentBalance = userData.leaveBalance || 0;
    const newBalance = Math.max(0, currentBalance - totalDaysUsed);

    // Update leave credits
    const userRef = doc(db, 'users', userDocId);
    await updateDoc(userRef, {
      leaveBalance: newBalance,
      leaveBalanceNote: `Updated to reflect historical leave usage (${totalDaysUsed} days used)`,
    });

    console.log('\n✓ Updated leave credits:');
    console.log(`  Previous: ${currentBalance}`);
    console.log(`  New: ${newBalance}`);
    console.log(`  Reason: Used ${totalDaysUsed} credits for historical leave`);

    console.log('\n========================================');
    console.log('SUCCESS: Historical leave added!');
    console.log('========================================\n');
    console.log('Summary:');
    console.log(`  - Created ${createdCount} leave requests`);
    console.log(`  - Total days used: ${totalDaysUsed}`);
    console.log(`  - Catle's leave credits: ${currentBalance} → ${newBalance}\n`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
addCatleHistoricalLeave()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
