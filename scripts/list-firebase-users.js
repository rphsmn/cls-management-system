/**
 * Script to list all users from Firebase Authentication
 * 
 * This script uses Firebase Admin SDK to list all users and their UIDs,
 * which helps identify and fix UID mismatches in leave requests.
 * 
 * Usage: node scripts/list-firebase-users.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Firebase Admin SDK configuration
// Note: You need to download the service account key from Firebase Console
// Go to Project Settings > Service Accounts > Generate New Private Key
// Save the JSON file and update the path below
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin SDK
initializeApp({
  credential: cert(serviceAccount)
});

async function listAllUsers() {
  console.log('\nListing all users from Firebase Authentication...\n');
  
  try {
    const listUsersResult = await getAuth().listUsers(1000);
    const users = listUsersResult.users;
    
    console.log(`Found ${users.length} users:\n`);
    console.log('Email'.padEnd(40) + 'Firebase Auth UID'.padEnd(35) + 'Display Name');
    console.log('='.repeat(100));
    
    for (const user of users) {
      const email = user.email || 'N/A';
      const uid = user.uid;
      const displayName = user.displayName || 'N/A';
      
      console.log(email.padEnd(40) + uid.padEnd(35) + displayName);
    }
    
    console.log('\n' + '='.repeat(100));
    console.log(`\nTotal: ${users.length} users\n`);
    
    // Create a mapping of email to UID for easy reference
    console.log('\nEmail to UID Mapping (for fixing leave requests):\n');
    for (const user of users) {
      if (user.email) {
        console.log(`${user.email}: ${user.uid}`);
      }
    }
    
  } catch (error) {
    console.error('Error listing users:', error.message);
    
    if (error.code === 'auth/invalid-credential') {
      console.log('\n========================================');
      console.log('ERROR: Invalid credentials');
      console.log('========================================\n');
      console.log('You need to download the service account key from Firebase Console:');
      console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
      console.log('2. Click "Generate New Private Key"');
      console.log('3. Save the JSON file as "service-account-key.json" in the scripts folder');
      console.log('4. Run this script again\n');
    }
  }
}

// Run the script
listAllUsers()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
