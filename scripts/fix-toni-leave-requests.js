/**
 * Script to fix Toni Alyn Y. Boton (CLS-ACC00012) leave requests
 *
 * Historical filed leaves:
 * - Jan 2: Paid Leave (1 Day) = 1.0
 * - Jan 26: Paid Leave (210 MINS) = 0.5
 * - Feb 5: Paid Leave (1 Day) = 1.0
 * - Feb 20: Birthday Leave (1 Day) = 0.0
 * - Mar 17: Sick Leave (1 Day) = 1.0
 * - Apr 2: Sick Leave (60 mins) = 0.0
 *
 * Usage: node scripts/fix-toni-leave-requests.js
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
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
    minutes: null,
  },
  {
    period: '2026-01-26 to 2026-01-26',
    type: 'Paid Time Off',
    daysDeducted: 0.5,
    isHalfDay: true,
    minutes: 210,
  },
  {
    period: '2026-02-05 to 2026-02-05',
    type: 'Paid Time Off',
    daysDeducted: 1.0,
    isHalfDay: false,
    minutes: null,
  },
  {
    period: '2026-02-20 to 2026-02-20',
    type: 'Birthday Leave',
    daysDeducted: 0.0,
    isHalfDay: false,
    minutes: null,
  },
  {
    period: '2026-03-17 to 2026-03-17',
    type: 'Sick Leave',
    daysDeducted: 1.0,
    isHalfDay: false,
    minutes: null,
  },
  {
    period: '2026-04-02 to 2026-04-02',
    type: 'Sick Leave',
    daysDeducted: 0.0,
    isHalfDay: false,
    minutes: 60,
  },
];

const EMPLOYEE_ID = 'CLS-ACC00012';

async function fixToniLeaveRequests() {
  console.log('\n========================================');
  console.log('Fixing Toni Boton Leave Requests');
  console.log('========================================\n');

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
        type: update.type,
        daysDeducted: update.daysDeducted,
        isHalfDay: update.isHalfDay,
        noOfDays: update.daysDeducted,
        minutes: update.minutes,
      });
      console.log(
        `  ✓ Updated ${update.period}: ${update.type}, daysDeducted=${update.daysDeducted}, minutes=${update.minutes}`,
      );
    } else {
      console.log(`  ✗ NOT FOUND: ${update.period} - needs to be added`);

      if (update.period === '2026-04-02 to 2026-04-02') {
        console.log(`     Adding missing Apr 2 request...`);

        const userQ = query(collection(db, 'users'), where('employeeId', '==', EMPLOYEE_ID));
        const userSnap = await getDocs(userQ);

        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();

          await addDoc(collection(db, 'leaveRequests'), {
            employeeId: EMPLOYEE_ID,
            employeeName: userData.name,
            role: userData.role,
            department: userData.department,
            type: update.type,
            startDate: '2026-04-02',
            endDate: '2026-04-02',
            period: update.period,
            noOfDays: update.daysDeducted,
            daysDeducted: update.daysDeducted,
            isHalfDay: update.isHalfDay,
            minutes: update.minutes,
            status: 'Approved',
            dateFiled: '2026-04-02T00:00:00.000Z',
            targetReviewer: 'None',
          });
          console.log(`     ✓ Added Apr 2 request`);
        }
      }
    }

    if (update.type !== 'Birthday Leave') {
      totalDeductions += update.daysDeducted;
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
    console.log(`  ✓ Updated leaveBalance to ${FINAL_BALANCE}`);
  }

  console.log('\n========================================');
  console.log('Done!');
  console.log('========================================\n');
}

fixToniLeaveRequests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
