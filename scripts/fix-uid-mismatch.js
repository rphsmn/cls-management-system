/**
 * Script to fix UID mismatches in leave requests
 * 
 * This script updates all leave requests for an employee to use the correct Firebase UID.
 * 
 * Usage: node scripts/fix-uid-mismatch.js <employee-email> <correct-firebase-uid>
 * Example: node scripts/fix-uid-mismatch.js domingo@example.com abc123xyz
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc, query, where } = require('firebase/firestore');

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

async function fixUidMismatch(email, correctUid) {
  console.log(`\nFixing UID mismatch for: ${email}`);
  console.log(`Correct Firebase UID: ${correctUid}\n`);
  
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
    
    console.log(`✓ Found user in Firestore:`);
    console.log(`  Name: ${userData.name}`);
    console.log(`  Email: ${userData.email}`);
    console.log(`  Role: ${userData.role}`);
    
    // Get leave requests for this user
    const requestsRef = collection(db, 'leaveRequests');
    const requestsQuery = query(requestsRef, where('employeeName', '==', userData.name));
    const requestsSnapshot = await getDocs(requestsQuery);
    
    if (requestsSnapshot.empty) {
      console.log(`\n❌ No leave requests found for: ${userData.name}`);
      return;
    }
    
    console.log(`\n✓ Found ${requestsSnapshot.size} leave request(s) for: ${userData.name}`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    // Update each request
    for (const docSnapshot of requestsSnapshot.docs) {
      const data = docSnapshot.data();
      const currentUid = data.uid;
      
      if (currentUid === correctUid) {
        console.log(`\n✓ Request ${docSnapshot.id} already has correct UID`);
        skippedCount++;
        continue;
      }
      
      console.log(`\nFixing request ${docSnapshot.id}:`);
      console.log(`  Type: ${data.type}`);
      console.log(`  Period: ${data.period}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Current UID: ${currentUid}`);
      console.log(`  Correct UID: ${correctUid}`);
      
      // Update the document
      const docRef = doc(db, 'leaveRequests', docSnapshot.id);
      await updateDoc(docRef, { uid: correctUid });
      
      console.log(`  ✓ Fixed!`);
      fixedCount++;
    }
    
    console.log(`\n========================================`);
    console.log(`Summary:`);
    console.log(`  Fixed: ${fixedCount} requests`);
    console.log(`  Skipped: ${skippedCount} requests (already correct)`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('Error fixing UID mismatch:', error);
  }
}

// Get email and UID from command line arguments
const email = process.argv[2];
const correctUid = process.argv[3];

if (!email || !correctUid) {
  console.log('Usage: node scripts/fix-uid-mismatch.js <employee-email> <correct-firebase-uid>');
  console.log('Example: node scripts/fix-uid-mismatch.js domingo@example.com abc123xyz');
  console.log('\nTo get the correct Firebase UID:');
  console.log('1. Have the employee log in to the application');
  console.log('2. Check the browser console for the user object (look for uid field)');
  console.log('3. Or check Firebase Authentication console for the user\'s UID');
  process.exit(1);
}

// Run the fix
fixUidMismatch(email, correctUid)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
