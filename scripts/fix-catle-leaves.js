/**
 * Script to check and fix Catle's leave requests in Firestore
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
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

async function checkAndFixCatleLeaves() {
  console.log('Checking Catle leave requests...\n');

  const q = query(collection(db, 'leaveRequests'), where('employeeId', '==', 'CLS-DEV00044'));
  const snap = await getDocs(q);

  console.log('Total leave requests for CLS-DEV00044:', snap.size);
  console.log('');

  const validPeriods = {
    '2026-01-13 to 2026-01-13': { keep: true, count: 0 },
    '2026-01-21 to 2026-01-21': { keep: true, count: 0 },
    '2026-02-23 to 2026-02-25': { keep: true, count: 0 },
  };

  let deletedCount = 0;

  for (const d of snap.docs) {
    const data = d.data();
    console.log('ID:', d.id);
    console.log('  Period:', data.period);
    console.log('  Type:', data.type);
    console.log('  Status:', data.status);
    console.log('  Days:', data.noOfDays);
    console.log('');

    if (!validPeriods[data.period]) {
      console.log('  -> Unknown period, deleting...');
      await deleteDoc(doc(db, 'leaveRequests', d.id));
      deletedCount++;
      console.log('  -> Deleted!\n');
    } else {
      validPeriods[data.period].count++;
      if (validPeriods[data.period].count > 1) {
        console.log('  -> DUPLICATE, deleting...');
        await deleteDoc(doc(db, 'leaveRequests', d.id));
        deletedCount++;
        console.log('  -> Deleted!\n');
      } else {
        console.log('  -> This is a VALID request (1st occurrence)\n');
      }
    }
  }

  console.log('========================================');
  console.log(`Deleted ${deletedCount} extra leave request(s)`);
  console.log('========================================');
}

checkAndFixCatleLeaves()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
