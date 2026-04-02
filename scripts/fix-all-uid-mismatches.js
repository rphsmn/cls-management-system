/**
 * Script to fix UID mismatches for all employees
 * 
 * This script updates all leave requests to use the correct Firebase Authentication UID.
 * It reads the email-to-UID mapping from a JSON file and updates all leave requests.
 * 
 * Usage: node scripts/fix-all-uid-mismatches.js <mapping-file>
 * Example: node scripts/fix-all-uid-mismatches.js email-uid-mapping.json
 * 
 * Mapping file format (JSON):
 * {
 *   "email1@example.com": "firebase-uid-1",
 *   "email2@example.com": "firebase-uid-2"
 * }
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc, query, where } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

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

async function fixAllUidMismatches(mappingFile) {
  console.log(`\nFixing UID mismatches for all employees...\n`);
  
  try {
    // Read the mapping file
    if (!fs.existsSync(mappingFile)) {
      console.log(`❌ Mapping file not found: ${mappingFile}`);
      console.log(`\nPlease create a mapping file with the following format:`);
      console.log(`{
  "email1@example.com": "firebase-uid-1",
  "email2@example.com": "firebase-uid-2"
}`);
      return;
    }
    
    const mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
    const emails = Object.keys(mapping);
    
    console.log(`Found ${emails.length} email-to-UID mappings\n`);
    
    let totalFixed = 0;
    let totalSkipped = 0;
    
    // Process each email
    for (const email of emails) {
      const correctUid = mapping[email];
      
      console.log(`\nProcessing: ${email}`);
      console.log(`  Correct UID: ${correctUid}`);
      
      // Get user from Firestore users collection
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', email));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        console.log(`  ❌ No user found in Firestore`);
        continue;
      }
      
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log(`  ✓ Found user: ${userData.name}`);
      
      // Get leave requests for this user
      const requestsRef = collection(db, 'leaveRequests');
      const requestsQuery = query(requestsRef, where('employeeName', '==', userData.name));
      const requestsSnapshot = await getDocs(requestsQuery);
      
      if (requestsSnapshot.empty) {
        console.log(`  ✓ No leave requests found`);
        continue;
      }
      
      console.log(`  ✓ Found ${requestsSnapshot.size} leave request(s)`);
      
      // Update each request
      for (const docSnapshot of requestsSnapshot.docs) {
        const data = docSnapshot.data();
        const currentUid = data.uid;
        
        if (currentUid === correctUid) {
          console.log(`    ✓ Request ${docSnapshot.id} already has correct UID`);
          totalSkipped++;
          continue;
        }
        
        console.log(`    Fixing request ${docSnapshot.id}:`);
        console.log(`      Type: ${data.type}`);
        console.log(`      Period: ${data.period}`);
        console.log(`      Status: ${data.status}`);
        console.log(`      Current UID: ${currentUid}`);
        console.log(`      Correct UID: ${correctUid}`);
        
        // Update the document
        const docRef = doc(db, 'leaveRequests', docSnapshot.id);
        await updateDoc(docRef, { uid: correctUid });
        
        console.log(`      ✓ Fixed!`);
        totalFixed++;
      }
    }
    
    console.log(`\n========================================`);
    console.log(`Summary:`);
    console.log(`  Total Fixed: ${totalFixed} requests`);
    console.log(`  Total Skipped: ${totalSkipped} requests (already correct)`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('Error fixing UID mismatches:', error);
  }
}

// Get mapping file from command line arguments
const mappingFile = process.argv[2];

if (!mappingFile) {
  console.log('Usage: node scripts/fix-all-uid-mismatches.js <mapping-file>');
  console.log('Example: node scripts/fix-all-uid-mismatches.js email-uid-mapping.json');
  console.log('\nMapping file format (JSON):');
  console.log(`{
  "email1@example.com": "firebase-uid-1",
  "email2@example.com": "firebase-uid-2"
}`);
  process.exit(1);
}

// Run the fix
fixAllUidMismatches(mappingFile)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
