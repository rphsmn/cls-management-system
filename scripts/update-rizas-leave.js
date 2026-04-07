/**
 * Script to update Riza's leave balance to 9 (10 - 1 used)
 * 
 * Usage: node scripts/update-rizas-leave.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc, query, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDhvTtu2a_CC3DdkIfA49qJWr5-cYpKvU0",
  authDomain: "cor-logic-hris.firebaseapp.com",
  projectId: "cor-logic-hris",
  storageBucket: "cor-logic-hris.firebasestorage.app",
  messagingSenderId: "611895985104",
  appId: "1:611895985104:web:13747d65663a005a61afd5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateRizaLeave() {
  try {
    const q = query(collection(db, 'users'), where('email', '==', 'rizajane.amoncio@yahoo.com'));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log('User not found');
      return;
    }
    
    const docRef = doc(db, 'users', snap.docs[0].id);
    await updateDoc(docRef, { 
      leaveBalance: 9,
      leaveBalanceNote: '10 total - 1 used = 9 remaining (manually updated)'
    });
    console.log('Updated Riza leave balance to 9');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

updateRizaLeave().then(() => process.exit(0));