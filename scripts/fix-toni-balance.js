/**
 * Script to fix Toni Alyn Y. Boton (CLS-ACC0012) leave balance
 *
 * Starting Balance: 9.0 days
 * Deductions:
 * - Jan 2 (Paid): 1.0
 * - Jan 26 (Paid - 210 mins): 0.5
 * - Feb 5 (Paid): 1.0
 * - Feb 20 (Birthday Leave): 0.0 (EXEMPT)
 * - Mar 17 (Sick): 1.0
 * - Apr 2 (Sick - 60 mins): 0.0 (Under 2hr threshold)
 *
 * Total Deductions: 1.0 + 0.5 + 1.0 + 1.0 = 3.5 days
 * Final Balance: 9.0 - 3.5 = 5.5 days
 *
 * Usage: node scripts/fix-toni-balance.js
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  runTransaction,
  query,
  where,
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

const TONI_UPDATES = [
  {
    period: '2026-01-02 to 2026-01-02',
    type: 'Paid Time Off',
    daysDeducted: 1.0,
    isHalfDay: false,
  },
  { period: '2026-01-26 to 2026-01-26', type: 'Paid Time Off', daysDeducted: 0.5, isHalfDay: true },
  {
    period: '2026-02-05 to 2026-02-05',
    type: 'Paid Time Off',
    daysDeducted: 1.0,
    isHalfDay: false,
  },
  {
    period: '2026-02-20 to 2026-02-20',
    type: 'Birthday Leave',
    daysDeducted: 0.0,
    isHalfDay: false,
  },
  { period: '2026-03-17 to 2026-03-17', type: 'Sick Leave', daysDeducted: 1.0, isHalfDay: false },
  { period: '2026-04-02 to 2026-04-02', type: 'Sick Leave', daysDeducted: 0.0, isHalfDay: false },
];

const EMPLOYEE_ID = 'CLS-ACC00012';

async function fixToniBalance() {
  console.log('\n========================================');
  console.log('Fixing Toni Boton Leave Balance');
  console.log('========================================\n');

  let transactionCompleted = false;

  try {
    await runTransaction(db, async (transaction) => {
      console.log('Starting transaction...\n');

      let totalDeductions = 0;

      for (const update of TONI_UPDATES) {
        const requestsRef = collection(db, 'leaveRequests');
        const q = query(
          requestsRef,
          where('employeeId', '==', EMPLOYEE_ID),
          where('period', '==', update.period),
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const requestDoc = snapshot.docs[0];
          transaction.update(doc(db, 'leaveRequests', requestDoc.id), {
            daysDeducted: update.daysDeducted,
            isHalfDay: update.isHalfDay,
            noOfDays: update.daysDeducted,
          });
          console.log(
            `  ✓ Updated ${update.period} (${update.type}): daysDeducted = ${update.daysDeducted}`,
          );

          if (update.type !== 'Birthday Leave') {
            totalDeductions += update.daysDeducted;
          }
        } else {
          console.log(`  ✗ NOT FOUND: ${update.period}`);
        }
      }

      const STARTING_BALANCE = 9.0;
      const FINAL_BALANCE = STARTING_BALANCE - totalDeductions;

      console.log(`\n  Total Deductions: ${totalDeductions}`);
      console.log(`  Starting Balance: ${STARTING_BALANCE}`);
      console.log(`  Final Balance: ${FINAL_BALANCE}`);

      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('employeeId', '==', EMPLOYEE_ID));
      const userSnapshot = await getDocs(userQuery);

      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        transaction.update(doc(db, 'users', userDoc.id), {
          leaveBalance: FINAL_BALANCE,
          leaveBalanceNote: `Corrected: Starting ${STARTING_BALANCE}, Deductions ${totalDeductions}, Final ${FINAL_BALANCE}`,
        });
        console.log(`\n  ✓ Updated leaveBalance to ${FINAL_BALANCE}`);
      } else {
        console.log(`  ✗ USER NOT FOUND: ${EMPLOYEE_ID}`);
      }

      transactionCompleted = true;
    });

    console.log('\n========================================');
    console.log('Transaction Complete!');
    console.log('========================================\n');
  } catch (error) {
    console.error('Transaction Error:', error.message);
    if (!transactionCompleted) {
      console.log('\nAttempting without transaction...\n');

      let totalDeductions = 0;

      for (const update of TONI_UPDATES) {
        const requestsRef = collection(db, 'leaveRequests');
        const q = query(
          requestsRef,
          where('employeeId', '==', EMPLOYEE_ID),
          where('period', '==', update.period),
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const requestDoc = snapshot.docs[0];
          await updateDoc(doc(db, 'leaveRequests', requestDoc.id), {
            daysDeducted: update.daysDeducted,
            isHalfDay: update.isHalfDay,
            noOfDays: update.daysDeducted,
          });
          console.log(
            `  ✓ Updated ${update.period} (${update.type}): daysDeducted = ${update.daysDeducted}`,
          );

          if (update.type !== 'Birthday Leave') {
            totalDeductions += update.daysDeducted;
          }
        } else {
          console.log(`  ✗ NOT FOUND: ${update.period}`);
        }
      }

      const STARTING_BALANCE = 9.0;
      const FINAL_BALANCE = STARTING_BALANCE - totalDeductions;

      console.log(`\n  Total Deductions: ${totalDeductions}`);
      console.log(`  Starting Balance: ${STARTING_BALANCE}`);
      console.log(`  Final Balance: ${FINAL_BALANCE}`);

      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('employeeId', '==', EMPLOYEE_ID));
      const userSnapshot = await getDocs(userQuery);

      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        await updateDoc(doc(db, 'users', userDoc.id), {
          leaveBalance: FINAL_BALANCE,
          leaveBalanceNote: `Corrected: Starting ${STARTING_BALANCE}, Deductions ${totalDeductions}, Final ${FINAL_BALANCE}`,
        });
        console.log(`\n  ✓ Updated leaveBalance to ${FINAL_BALANCE}`);
      }
    }
  }
}

fixToniBalance()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
