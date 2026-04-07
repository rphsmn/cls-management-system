/**
 * Script to reset Riza's leave balance to 10
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

async function resetRiza() {
  const q = query(collection(db, 'users'), where('email', '==', 'rizajane.amoncio@yahoo.com'));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    await updateDoc(doc(db, 'users', snap.docs[0].id), { 
      leaveBalance: 10, 
      leaveBalanceNote: 'Reset after deleting test leave'
    });
    console.log('Reset Riza to 10');
  }
}

resetRiza().then(() => process.exit(0));