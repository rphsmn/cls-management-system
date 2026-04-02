/**
 * Script to check for UID mismatches in leave requests
 * 
 * This script helps diagnose why an employee can't see their own leave history.
 * It checks if the uid stored in leave requests matches the current user's Firebase UID.
 * 
 * Usage: node scripts/check-uid-mismatch.js <employee-email>
 * Example: node scripts/check-uid-mismatch.js domingo@example.com
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// Firebase config from environment.ts
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
const auth = getAuth(app);

async function checkUidMismatch(email) {
  console.log(`\nChecking UID mismatch for: ${email}\n`);
  
  try {
    // Get user from Firestore users collection
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', email));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      console.log(`❌ No user found in Firestore with email: ${email}`);
      return;
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const firestoreDocId = userDoc.id;
    
    console.log(`✓ Found user in Firestore:`);
    console.log(`  Name: ${userData.name}`);
    console.log(`  Email: ${userData.email}`);
    console.log(`  Role: ${userData.role}`);
    console.log(`  Firestore Doc ID: ${firestoreDocId}`);
    
    // Get leave requests for this user
    const requestsRef = collection(db, 'leaveRequests');
    const requestsQuery = query(requestsRef, where('employeeName', '==', userData.name));
    const requestsSnapshot = await getDocs(requestsQuery);
    
    if (requestsSnapshot.empty) {
      console.log(`\n❌ No leave requests found for: ${userData.name}`);
      return;
    }
    
    console.log(`\n✓ Found ${requestsSnapshot.size} leave request(s) for: ${userData.name}`);
    
    // Check UIDs
    const uids = new Set();
    requestsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      uids.add(data.uid);
      console.log(`\n  Request ID: ${doc.id}`);
      console.log(`    Type: ${data.type}`);
      console.log(`    Period: ${data.period}`);
      console.log(`    Status: ${data.status}`);
      console.log(`    UID in request: ${data.uid}`);
    });
    
    console.log(`\n========================================`);
    console.log(`Summary:`);
    console.log(`  Employee Name: ${userData.name}`);
    console.log(`  Firestore Doc ID: ${firestoreDocId}`);
    console.log(`  Unique UIDs in requests: ${Array.from(uids).join(', ')}`);
    console.log(`========================================\n`);
    
    console.log(`To fix this issue:`);
    console.log(`1. The employee needs to log in to get their Firebase UID`);
    console.log(`2. Update all leave requests to use the correct Firebase UID`);
    console.log(`3. Or update the Firestore users collection to match the leave request UIDs`);
    
  } catch (error) {
    console.error('Error checking UID mismatch:', error);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/check-uid-mismatch.js <employee-email>');
  console.log('Example: node scripts/check-uid-mismatch.js domingo@example.com');
  process.exit(1);
}

// Run the check
checkUidMismatch(email)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
