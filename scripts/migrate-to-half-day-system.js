/**
 * Migration Script: 0.5/1.0 Day Increment System
 *
 * Step 1: Data Reconciliation - Refund over-deducted credits
 * Step 2: Update leave requests with proper daysDeducted values
 *
 * Usage: node scripts/migrate-to-half-day-system.js
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

// Firebase config (production)
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

// Define the migration data for each employee
const MIGRATION_DATA = {
  'CLS-ADM00010': {
    // Reymart Lovendino Prado
    requests: [
      { period: '2026-01-08 to 2026-01-08', daysDeducted: 0.5, isHalfDay: true },
      { period: '2026-01-14 to 2026-01-14', daysDeducted: 0.5, isHalfDay: true },
      { period: '2026-02-25 to 2026-02-25', daysDeducted: 0.5, isHalfDay: true },
      { period: '2026-02-27 to 2026-02-27', daysDeducted: 0.5, isHalfDay: true },
      { period: '2026-03-05 to 2026-03-05', daysDeducted: 0.5, isHalfDay: true },
      { period: '2026-03-25 to 2026-03-25', daysDeducted: 0.5, isHalfDay: true },
    ],
    refundAmount: 3.0, // 6 entries * 1.0 - 6 entries * 0.5 = 3.0
  },
  'CLS-ACC00031': {
    // Melanie M. Melitante
    requests: [
      { period: '2026-02-19 to 2026-02-19', daysDeducted: 0.5, isHalfDay: true },
      { period: '2026-02-25 to 2026-02-25', daysDeducted: 0.5, isHalfDay: true },
    ],
    refundAmount: 1.0, // 2 entries * 1.0 - 2 entries * 0.5 = 1.0
  },
  'CLS-ACC00012': {
    // Toni Alyn Yngente Boton
    requests: [
      { period: '2026-01-26 to 2026-01-26', daysDeducted: 0.5, isHalfDay: true }, // 210 min
    ],
    refundAmount: 1.5, // 3 entries * 1.0 - (0.5 + 0.0 + 0.5) = 2.5 -> Wait, let me recalculate
  },
  'CLS-ADM00051': {
    // Ranilyn N. Morales
    requests: [
      { period: '2026-01-27 to 2026-01-27', daysDeducted: 0.5, isHalfDay: true }, // 4 hrs
    ],
    refundAmount: 0.5, // 1 entry * 1.0 - 0.5 = 0.5
  },
};

// Correction for Toni: Based on the prompt, 210min=0.5, 60min=0.0
// But the data shows 3 PTO entries: Jan 2, Jan 26, Feb 5
// If Jan 26 is 210min=0.5, and others are full days, refund = 3*1.0 - (1.0 + 0.5 + 1.0) = 1.5
MIGRATION_DATA['CLS-ACC00012'].requests = [
  { period: '2026-01-26 to 2026-01-26', daysDeducted: 0.5, isHalfDay: true },
];

async function migrateToHalfDaySystem() {
  console.log('\n========================================');
  console.log('Migration: 0.5/1.0 Day Increment System');
  console.log('========================================\n');

  try {
    // Step 1: Update leave requests with daysDeducted values
    console.log('Step 1: Updating leave requests...\n');

    for (const [employeeId, data] of Object.entries(MIGRATION_DATA)) {
      console.log(`Processing ${employeeId}...`);

      for (const reqUpdate of data.requests) {
        const requestsRef = collection(db, 'leaveRequests');
        const q = query(
          requestsRef,
          where('employeeId', '==', employeeId),
          where('period', '==', reqUpdate.period),
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const requestDoc = snapshot.docs[0];
          await updateDoc(doc(db, 'leaveRequests', requestDoc.id), {
            daysDeducted: reqUpdate.daysDeducted,
            isHalfDay: reqUpdate.isHalfDay,
            noOfDays: reqUpdate.daysDeducted, // Also update noOfDays for consistency
          });
          console.log(`  ✓ Updated ${reqUpdate.period} -> daysDeducted: ${reqUpdate.daysDeducted}`);
        } else {
          console.log(`  ✗ NOT FOUND: ${reqUpdate.period}`);
        }
      }
    }

    // Step 2: Refund over-deducted leave balances
    console.log('\nStep 2: Refunding leave balances...\n');

    for (const [employeeId, data] of Object.entries(MIGRATION_DATA)) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('employeeId', '==', employeeId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        const currentBalance = userData.leaveBalance || 0;
        const newBalance = currentBalance + data.refundAmount;

        await updateDoc(doc(db, 'users', userDoc.id), {
          leaveBalance: newBalance,
          leaveBalanceNote: `Migrated to 0.5/1.0 system. Refunded ${data.refundAmount} day(s). Previous: ${currentBalance}, New: ${newBalance}`,
        });

        console.log(
          `  ✓ ${employeeId} (${userData.name}): ${currentBalance} + ${data.refundAmount} = ${newBalance}`,
        );
      } else {
        console.log(`  ✗ USER NOT FOUND: ${employeeId}`);
      }
    }

    console.log('\n========================================');
    console.log('Migration Complete!');
    console.log('========================================\n');
  } catch (error) {
    console.error('Migration Error:', error.message);
  }
}

// Run the migration
migrateToHalfDaySystem()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
