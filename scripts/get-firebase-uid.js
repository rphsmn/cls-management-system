/**
 * Script to get Firebase Authentication UID for an employee
 * 
 * This script helps get the Firebase Authentication UID for an employee,
 * which is needed to fix UID mismatches in leave requests.
 * 
 * Usage: node scripts/get-firebase-uid.js <employee-email>
 * Example: node scripts/get-firebase-uid.js dhomsreantaso23@gmail.com
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

async function getFirebaseUid(email) {
  console.log(`\nGetting Firebase UID for: ${email}\n`);
  
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
    
    console.log(`\n========================================`);
    console.log(`IMPORTANT: Firebase Authentication UID`);
    console.log(`========================================\n`);
    
    console.log(`The Firestore Doc ID (${firestoreDocId}) is NOT the Firebase Auth UID.`);
    console.log(`\nTo get the correct Firebase Auth UID:`);
    console.log(`\nOption 1: Check Firebase Console`);
    console.log(`  1. Go to Firebase Console > Authentication > Users`);
    console.log(`  2. Search for: ${email}`);
    console.log(`  3. Copy the "User UID" column value`);
    
    console.log(`\nOption 2: Check Browser Console`);
    console.log(`  1. Have the employee log in to the application`);
    console.log(`  2. Open browser console (F12)`);
    console.log(`  3. Look for the user object in the console logs`);
    console.log(`  4. Copy the "uid" field value`);
    
    console.log(`\nOption 3: Use Firebase Admin SDK`);
    console.log(`  1. Use Firebase Admin SDK to list all users`);
    console.log(`  2. Find the user by email`);
    console.log(`  3. Get the uid field`);
    
    console.log(`\n========================================\n`);
    
  } catch (error) {
    console.error('Error getting Firebase UID:', error);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/get-firebase-uid.js <employee-email>');
  console.log('Example: node scripts/get-firebase-uid.js dhomsreantaso23@gmail.com');
  process.exit(1);
}

// Run the script
getFirebaseUid(email)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
