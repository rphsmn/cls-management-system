/**
 * Script to check Rosalie's leave history
 * 
 * Usage: node scripts/check-rosalie-leaves.js
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

async function checkRosalieLeaves() {
  console.log('\n========================================');
  console.log('Checking Rosalie\'s Leave History');
  console.log('========================================\n');

  try {
    // Get all leave requests for Rosalie
    const requestsRef = collection(db, 'leaveRequests');
    const requestsQuery = query(
      requestsRef, 
      where('employeeName', '==', 'Rosalie Gñotob Neptuno')
    );
    const requestsSnapshot = await getDocs(requestsQuery);

    console.log(`Found ${requestsSnapshot.size} leave request(s):\n`);
    
    let paidTimeOffApproved = 0;
    
    for (const docSnapshot of requestsSnapshot.docs) {
      const data = docSnapshot.data();
      console.log(`- Document ID: ${docSnapshot.id}`);
      console.log(`  Type: ${data.type}`);
      console.log(`  Period: ${data.period}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Start Date: ${data.startDate}`);
      console.log(`  End Date: ${data.endDate}`);
      console.log(`  Reason: ${data.reason}`);
      console.log(`  noOfDays: ${data.noOfDays}`);
      console.log('');
      
      if (data.type === 'Paid Time Off' && data.status === 'Approved') {
        paidTimeOffApproved += (data.noOfDays || 1);
      }
    }
    
    console.log('========================================');
    console.log(`Total Approved Paid Time Off: ${paidTimeOffApproved} days`);
    console.log('========================================\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
checkRosalieLeaves()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });