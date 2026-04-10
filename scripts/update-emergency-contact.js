/**
 * Script to update emergency contact information in Firestore
 *
 * This script shows what will be matched BEFORE applying changes.
 * Run with: node scripts/update-emergency-contact.js
 *
 * It uses the same Firebase config as the existing working scripts.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

// Firebase configuration (same as update-employees.js)
const firebaseConfig = {
  apiKey: 'AIzaSyDhvTtu2a_CC3DdkIfA49qJWr5-cYpKvU0',
  authDomain: 'cor-logic-hris.firebaseapp.com',
  projectId: 'cor-logic-hris',
  storageBucket: 'cor-logic-hris.firebasestorage.app',
  messagingSenderId: '611895985104',
  appId: '1:611895985104:web:13747d65663a005a61afd5',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Emergency contact data to migrate
const emergencyData = [
  {
    nameKeyword: 'Riza Jane',
    mobileNo: '09267664097',
    address: 'Purok 4 Brgy. 64 Bagacay, Legazpi City',
    emergencyContactPerson: 'Neonita Amoncio',
    emergencyContactRelation: 'Mother',
    emergencyContactMobile: '09267664097',
    emergencyContactAddress: 'Purok 4 Brgy. 64 Bagacay, Legazpi City',
  },
  {
    nameKeyword: 'Rosalie',
    mobileNo: '09936856271',
    address: 'Purok 5, Pawa Legazpi City',
    emergencyContactPerson: 'Domingo Neptuno',
    emergencyContactRelation: 'Father',
    emergencyContactMobile: '09936856271',
    emergencyContactAddress: 'Purok 5, Pawa Legazpi City',
  },
  {
    nameKeyword: 'Domingo',
    mobileNo: '09356419952',
    address: 'P2 Mayao, Oas, Albay',
    emergencyContactPerson: 'Jolina Reantaso',
    emergencyContactRelation: 'Sister',
    emergencyContactMobile: '09356419952',
    emergencyContactAddress: 'P2 Mayao, Oas, Albay',
  },
  {
    nameKeyword: 'Reymart',
    mobileNo: '09319842267',
    address: 'P-6, Mi-isi, Daraga, Albay',
    emergencyContactPerson: 'Shirley L. Prado',
    emergencyContactRelation: 'Sister',
    emergencyContactMobile: '09319842267',
    emergencyContactAddress: 'P-6, Mi-isi, Daraga, Albay',
  },
  {
    nameKeyword: 'Shannen',
    mobileNo: '09285697390',
    address: 'Purok 4, Legazpi City',
    emergencyContactPerson: 'Darwin Abion',
    emergencyContactRelation: 'Father',
    emergencyContactMobile: '09285697390',
    emergencyContactAddress: 'Purok 4, Legazpi City',
  },
  {
    nameKeyword: 'Maridhel',
    mobileNo: '09203148541',
    address: 'P-1, BRGY. 46 SAN JOAQUIN, LEGAZPI',
    emergencyContactPerson: 'Rodel P. Balaguer',
    emergencyContactRelation: 'Brother',
    emergencyContactMobile: '09203148541',
    emergencyContactAddress: 'P-1, BRGY. 46 SAN JOAQUIN, LEGAZPI',
  },
  {
    nameKeyword: 'Ranilyn',
    mobileNo: '09486647266',
    address: 'Subd P-1 Cabangan, Camalig',
    emergencyContactPerson: 'Ranolfo Morales',
    emergencyContactRelation: 'Father',
    emergencyContactMobile: '09486647266',
    emergencyContactAddress: 'Subd P-1 Cabangan, Camalig',
  },
  {
    nameKeyword: 'Ian Rey',
    mobileNo: '09770220401',
    address: 'Bagacay Legazpi City',
    emergencyContactPerson: 'Imelda M. Alamilla',
    emergencyContactRelation: 'Grandmother',
    emergencyContactMobile: '09770220401',
    emergencyContactAddress: 'Bagacay Legazpi City',
  },
  {
    nameKeyword: 'Olympia',
    mobileNo: '09276708829',
    address: 'Subd 2 Tinago Ligao City',
    emergencyContactPerson: 'Mary Oreste-Tranquilino',
    emergencyContactRelation: 'Sister',
    emergencyContactMobile: '09276708829',
    emergencyContactAddress: 'Subd 2 Tinago Ligao City',
  },
  {
    nameKeyword: 'Toni Alyn',
    mobileNo: '09380728213',
    address: 'ZONE 1, BALZA MALINAO ALBAY',
    emergencyContactPerson: 'Evelyn Y. Boton',
    emergencyContactRelation: 'Mother',
    emergencyContactMobile: '09380728213',
    emergencyContactAddress: 'ZONE 1, BALZA MALINAO ALBAY',
  },
  {
    nameKeyword: 'Dorothy',
    mobileNo: '09128327946',
    address: 'Purok 2, Brgy. Tagaytay, Camalig',
    emergencyContactPerson: 'Edwina Bitoy Solano',
    emergencyContactRelation: 'Mother',
    emergencyContactMobile: '09128327946',
    emergencyContactAddress: 'Purok 2, Brgy. Tagaytay, Camalig',
  },
  {
    nameKeyword: 'Melanie',
    mobileNo: '09101044956',
    address: 'Maminomoton St., Pandan, Daraga',
    emergencyContactPerson: 'Mel John M. Melitante',
    emergencyContactRelation: 'Brother',
    emergencyContactMobile: '09101044956',
    emergencyContactAddress: 'Maminomoton St., Pandan, Daraga',
  },
  {
    nameKeyword: 'Dyron',
    mobileNo: '09666515236',
    address: 'SAN JUAN ST. POB. CASTILLA',
    emergencyContactPerson: 'Zyron Laurinaria',
    emergencyContactRelation: 'Brother',
    emergencyContactMobile: '09666515236',
    emergencyContactAddress: 'SAN JUAN ST. POB. CASTILLA',
  },
  {
    nameKeyword: 'Benzel',
    mobileNo: '093045678999',
    address: 'Ponso Polangui Albay',
    emergencyContactPerson: 'Beverly C. Catle',
    emergencyContactRelation: 'Mother',
    emergencyContactMobile: '093045678999',
    emergencyContactAddress: 'Ponso Polangui Albay',
  },
  {
    nameKeyword: 'Roy',
    address: 'Not listed in source',
    emergencyContactAddress: 'Not listed in source',
  },
  {
    nameKeyword: 'Edith',
    address: 'Not listed in source',
    emergencyContactAddress: 'Not listed in source',
  },
];

// Set DRY_RUN to true to only preview (no changes applied)
// Set DRY_RUN to false to actually update Firestore
const DRY_RUN = true;

async function updateEmergencyContacts() {
  console.log('='.repeat(60));
  console.log('EMERGENCY CONTACT MIGRATION');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (Preview Only)' : 'LIVE RUN (Will Update Firestore)'}`);
  console.log('');

  console.log('Fetching users from Firestore...');
  const usersSnapshot = await getDocs(collection(db, 'users'));
  console.log(`Found ${usersSnapshot.size} users in Firestore\n`);

  console.log('-'.repeat(60));
  console.log('MATCHING PLAN:');
  console.log('-'.repeat(60));

  let matchCount = 0;
  let notFound = [];

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userName = userData.name || '';
    const userId = userData.employeeId || 'N/A';

    // Find matching emergency data by name keyword (first name match)
    const matches = emergencyData.filter((e) =>
      userName.toLowerCase().includes(e.nameKeyword.toLowerCase()),
    );

    if (matches.length === 1) {
      const match = matches[0];
      matchCount++;

      console.log(`\n[${matchCount}] ${userName} (${userId})`);
      console.log(
        `    → Emergency Contact: ${match.emergencyContactPerson} (${match.emergencyContactRelation})`,
      );
      console.log(`    → Mobile: ${match.mobileNo || 'N/A'}`);
      console.log(`    → Address: ${match.address || 'N/A'}`);

      // Apply update if not dry run
      if (!DRY_RUN) {
        const updateData = {};
        if (match.mobileNo) updateData.mobileNo = match.mobileNo;
        if (match.address) updateData.address = match.address;
        if (match.emergencyContactPerson)
          updateData.emergencyContactPerson = match.emergencyContactPerson;
        if (match.emergencyContactRelation)
          updateData.emergencyContactRelation = match.emergencyContactRelation;
        if (match.emergencyContactMobile)
          updateData.emergencyContactMobile = match.emergencyContactMobile;
        if (match.emergencyContactAddress)
          updateData.emergencyContactAddress = match.emergencyContactAddress;

        await updateDoc(doc(db, 'users', userDoc.id), updateData);
        console.log(`    ✓ UPDATED`);
      }
    } else if (matches.length > 1) {
      console.log(
        `\n[!] ${userName} - MULTIPLE MATCHES: ${matches.map((m) => m.nameKeyword).join(', ')}`,
      );
    } else {
      notFound.push(userName);
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`SUMMARY: ${matchCount} users matched, ${notFound.length} not found`);
  console.log('='.repeat(60));

  if (notFound.length > 0) {
    console.log('\nNOT FOUND IN DATA:');
    notFound.forEach((name) => console.log(`  - ${name}`));
  }

  if (DRY_RUN) {
    console.log('\n>>> This was a DRY RUN. No changes were made.');
    console.log('>>> To apply changes, edit this script and set:');
    console.log('>>>   const DRY_RUN = false;');
  }
}

updateEmergencyContacts()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
