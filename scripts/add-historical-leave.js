/**
 * Script to add historical leave for Rosalie (HR)
 * 
 * This script:
 * 1. Creates a leave request for April 6, 2026 (Holiday leave - approved)
 * 2. Updates Rosalie's leave credits from 6 to 3 (used 3 credits)
 * 
 * Usage: node scripts/add-historical-leave.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, collection, addDoc, updateDoc, doc, getDoc, getDocs, query, where } = require('firebase-admin/firestore');

// Firebase Admin SDK configuration
// Note: You need to download the service account key from Firebase Console
// Go to Project Settings > Service Accounts > Generate New Private Key
// Save the JSON file and update the path below
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin SDK
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

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
    console.log(`  Department: ${userData.department}`);
    console.log(`  Employee ID: ${userData.employeeId}`);
    console.log(`  UID: ${userData.uid}`);
    console.log(`  Current Leave Credits: ${userData.paidTimeoff || 0}`);

    // Step 1: Create the leave request
    const leaveRequest = {
      // Leave details
      type: 'Paid Time Off',
      startDate: '2026-04-06',
      endDate: '2026-04-06',
      period: '2026-04-06 to 2026-04-06',
      reason: 'Holiday leave',
      
      // Employee info (matching what would be stored from the app)
      uid: userData.uid,
      employeeName: userData.name,
      employeeId: userData.employeeId || userData.id,
      role: userData.role,
      department: userData.department,
      
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

    // Step 2: Update leave credits (6 - 3 = 3)
    // The user had 6 credits, using 3 leaves them with 3
    const newLeaveCredits = 3;
    
    const userRef = doc(db, 'users', userDocId);
    await updateDoc(userRef, {
      paidTimeoff: newLeaveCredits
    });

    console.log('\n✓ Updated leave credits:');
    console.log(`  Previous: 6`);
    console.log(`  New: ${newLeaveCredits}`);
    console.log(`  Reason: Used 3 credits for April 6, 2026 leave`);

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
    console.log('\nIf you get an error about service-account-key.json:');
    console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
    console.log('2. Click "Generate New Private Key"');
    console.log('3. Save the JSON file as "service-account-key.json" in the scripts folder');
    console.log('4. Run this script again\n');
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