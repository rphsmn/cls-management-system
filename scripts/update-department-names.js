/**
 * Script to update department names in Firestore users collection:
 * - devs -> DevOps
 * - accounts -> Accounts
 * - manager -> Manager
 * - operations-admin -> Operations-Admin
 * - part-time -> Part-time
 *
 * Usage: node scripts/update-department-names.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

// Firebase config from environment.prod.ts (production)
const firebaseConfig = {
  apiKey: 'AIzaSyDhvTtu2a_CC3DdkIfA49qJWr5-cYpKvU0',
  authDomain: 'cor-logic-hris.firebaseapp.com',
  projectId: 'cor-logic-hris',
  storageBucket: 'cor-logic-hris.firebasestorage.app',
  messagingSenderId: '611895985104',
  appId: '1:611895985104:web:13747d65663a005a61afd5',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore();

// Department mapping: old name -> new display name
const DEPT_MAPPING = {
  devs: 'DevOps',
  accounts: 'Accounts',
  manager: 'Manager',
  'operations-admin': 'Operations-Admin',
  'part-time': 'Part-time',
};

// Reverse mapping for lookup
const NEW_TO_OLD = Object.fromEntries(
  Object.entries(DEPT_MAPPING).map(([k, v]) => [v.toLowerCase(), k]),
);

async function updateDepartmentNames() {
  console.log('=== Updating Department Names in Firestore ===\n');

  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);

  console.log(`Found ${snapshot.size} user documents\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    const oldDept = data.dept || data.department;

    if (!oldDept) {
      skipped++;
      continue;
    }

    const normalizedOldDept = oldDept.toLowerCase().trim();
    const newDept = DEPT_MAPPING[normalizedOldDept];

    if (newDept) {
      try {
        await updateDoc(doc(db, 'users', userDoc.id), { dept: newDept });
        console.log(
          `✓ Updated: ${data.name || 'Unknown'} (${userDoc.id}) - "${oldDept}" -> "${newDept}"`,
        );
        updated++;
      } catch (err) {
        console.error(`✗ Error updating ${data.name}:`, err.message);
        errors++;
      }
    } else {
      // Check if it's already the new name (in any case)
      const isAlreadyNew = NEW_TO_OLD[normalizedOldDept];
      if (!isAlreadyNew) {
        console.log(`  - ${data.name || 'Unknown'}: keeping "${oldDept}" (no mapping)`);
      }
      skipped++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no change needed): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (updated > 0) {
    console.log(`\n✓ Successfully updated ${updated} department names!`);
  } else {
    console.log(`\nNo changes needed.`);
  }
}

updateDepartmentNames().catch(console.error);
