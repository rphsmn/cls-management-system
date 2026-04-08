/**
 * Script to add missing daysDeducted/noOfDays to Catle's leave requests
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyDhvTtu2a_CC3DdkIfA49qJWr5-cYpKvU0',
  authDomain: 'cor-logic-hris.firebaseapp.com',
  projectId: 'cor-logic-hris',
  storageBucket: 'cor-logic-hris.firebasestorage.app',
  messagingSenderId: '611895985104',
  appId: '1:611895985104:web:13747d65663a005a61afd5',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore();

async function fixCatleLeaveFields() {
  console.log('Adding missing fields to Catle leave requests...\n');

  const q = query(collection(db, 'leaveRequests'), where('employeeId', '==', 'CLS-DEV00044'));
  const snap = await getDocs(q);

  const updates = {
    '2026-01-13 to 2026-01-13': { noOfDays: 1, daysDeducted: 1, halfDay: false },
    '2026-01-21 to 2026-01-21': { noOfDays: 0.5, daysDeducted: 0.5, halfDay: true },
    '2026-02-23 to 2026-02-25': { noOfDays: 3, daysDeducted: 3, halfDay: false },
  };

  for (const d of snap.docs) {
    const data = d.data();
    const update = updates[data.period];

    if (update) {
      console.log(`Updating ${data.period}:`, update);
      await updateDoc(doc(db, 'leaveRequests', d.id), update);
    } else {
      console.log(`Unknown period: ${data.period}`);
    }
  }
}

fixCatleLeaveFields()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
