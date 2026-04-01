/**
 * Script to fix incorrect targetReviewer values in Firestore
 * 
 * This script fixes leave requests where targetReviewer was incorrectly set to "HR"
 * instead of the proper first reviewer based on the employee's role.
 * 
 * Usage: node scripts/fix-target-reviewers.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

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

// Correct reviewer mapping based on role
const reviewerMap = {
  // OPERATIONS ADMIN SUPERVISOR and ACCOUNT SUPERVISOR go to ADMIN MANAGER, then to HR
  'OPERATIONS ADMIN SUPERVISOR': 'Admin Manager',
  'ACCOUNT SUPERVISOR': 'Admin Manager',
  // Operations Admin staff go to OPERATIONS ADMIN SUPERVISOR
  'ADMIN OPERATION OFFICER': 'Operations Admin Supervisor',
  'ADMIN OPERATION ASSISTANT': 'Operations Admin Supervisor',
  'ADMIN COMPLIANCE OFFICER': 'Operations Admin Supervisor',
  // Accounts staff go to ACCOUNT SUPERVISOR
  'ACCOUNTING CLERK': 'Account Supervisor',
  'ACCOUNT RECEIVABLE SPECIALIST': 'Account Supervisor',
  'ACCOUNT PAYABLES SPECIALIST': 'Account Supervisor',
  // IT staff go to Admin Manager, then to HR
  'SENIOR IT DEVELOPER': 'Admin Manager',
  'IT ASSISTANT': 'Admin Manager',
  'IT DEVELOPER': 'Admin Manager',
  // HR goes to Admin Manager (HR NOT reviewed again after Admin Manager approval)
  'HUMAN RESOURCE OFFICER': 'Admin Manager',
  'HR': 'Admin Manager',
  // Admin Manager goes to HR (Admin Manager needs HR approval)
  'ADMIN MANAGER': 'HR',
  // Part-time employees go directly to HR
  'PART-TIME': 'HR'
};

function getCorrectReviewer(role) {
  // Normalize: uppercase, trim, and collapse multiple spaces to single space
  const r = role.toUpperCase().trim().replace(/\s+/g, ' ');
  return reviewerMap[r] || 'HR';
}

async function fixTargetReviewers() {
  console.log('Starting targetReviewer fix...\n');
  
  try {
    const requestsRef = collection(db, 'leaveRequests');
    const snapshot = await getDocs(requestsRef);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const currentReviewer = data.targetReviewer;
      const role = data.role;
      const status = data.status;
      
      // Skip if already approved or rejected
      if (status === 'Approved' || status === 'Rejected') {
        console.log(`Skipping ${data.employeeName} - already ${status}`);
        skippedCount++;
        continue;
      }
      
      // Skip if no role
      if (!role) {
        console.log(`Skipping ${data.employeeName} - no role found`);
        skippedCount++;
        continue;
      }
      
      const correctReviewer = getCorrectReviewer(role);
      
      // Check if current reviewer is incorrect
      if (currentReviewer !== correctReviewer) {
        console.log(`\nFixing ${data.employeeName}:`);
        console.log(`  Role: ${role}`);
        console.log(`  Current targetReviewer: ${currentReviewer}`);
        console.log(`  Correct targetReviewer: ${correctReviewer}`);
        
        // Update the document
        const docRef = doc(db, 'leaveRequests', docSnapshot.id);
        await updateDoc(docRef, { targetReviewer: correctReviewer });
        
        console.log(`  ✓ Fixed!`);
        fixedCount++;
      } else {
        console.log(`✓ ${data.employeeName} - targetReviewer is correct`);
        skippedCount++;
      }
    }
    
    console.log(`\n========================================`);
    console.log(`Summary:`);
    console.log(`  Fixed: ${fixedCount} requests`);
    console.log(`  Skipped: ${skippedCount} requests`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('Error fixing targetReviewers:', error);
  }
}

// Run the fix
fixTargetReviewers()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
