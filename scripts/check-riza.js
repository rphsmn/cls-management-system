/**
 * Script to check Riza's user data
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

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

async function checkRiza() {
  const q = query(collection(db, 'users'), where('email', '==', 'rizajane.amoncio@yahoo.com'));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const d = snap.docs[0].data();
    console.log('Riza - role:', d.role);
    console.log('Riza - leaveBalance:', d.leaveBalance);
    console.log('Riza - joinedDate:', d.joinedDate);
  }
}

checkRiza().then(() => process.exit(0));