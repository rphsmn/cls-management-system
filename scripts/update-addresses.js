/**
 * Script to update addresses in Firestore
 * Usage: node scripts/update-addresses.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

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

const addressData = [
  {
    nameKeyword: 'Riza Jane',
    address: 'Purok 4 Brgy. 64 Bagacay, Legazpi City 4500',
    emergencyContactAddress: 'Purok 4 Brgy. 64 Bagacay, Legazpi City 4500',
  },
  {
    nameKeyword: 'Rosalie',
    address: 'Purok 5, Pawa Legazpi City, Albay',
    emergencyContactAddress: 'Pawa Legazpi City, Albay',
  },
  {
    nameKeyword: 'Domingo',
    address: 'P2 Mayng, Oas, Albay',
    emergencyContactAddress: 'P4 Tagas, Daraga, Albay',
  },
  {
    nameKeyword: 'Reymart',
    address: 'P-6, Mi-isi, Daraga, Albay',
    emergencyContactAddress: 'P-6, Mi-isi, Daraga, Albay',
  },
  {
    nameKeyword: 'Shannen',
    address: 'Puro, Legazpi City',
    emergencyContactAddress: 'Puro, Legazpi City',
  },
  {
    nameKeyword: 'Maridhel',
    address: 'P-1, BRGY. 46 SAN JOAQUIN, LEGAZPI CITY',
    emergencyContactAddress: 'P-1, BRGY. 46 SAN JOAQUIN, LEGAZPI CITY',
  },
  {
    nameKeyword: 'Ranilyn',
    address: 'House #33 Anson Subdivision P-1 Cabangan, Camalig',
    emergencyContactAddress: 'House #33 Anson Subdivision P-1 Cabangan, Camalig',
  },
  {
    nameKeyword: 'Ian Rey',
    address: 'Bagacay Legazpi City',
    emergencyContactAddress: 'Bagacay Legazpi City',
  },
  {
    nameKeyword: 'Olympia',
    address: 'Purok 7 San Francisco Guinobatan Albay 4503',
    emergencyContactAddress: '436 San Isidro St., Subd 2 Tinago Ligao City 4504',
  },
  {
    nameKeyword: 'Toni Alyn',
    address: 'ZONE 1, BALZA MALINAO ALBAY',
    emergencyContactAddress: 'ZONE 1, BALZA MALINAO ALBAY',
  },
  {
    nameKeyword: 'Dorothy',
    address: '294 Arellano Street Ilawod Area Poblacion (Dist. 2), Daraga',
    emergencyContactAddress: 'Purok 2, Brgy. Tagaytay, Camalig, Albay',
  },
  {
    nameKeyword: 'Melanie',
    address: 'P5 Busay, Daraga, Albay',
    emergencyContactAddress: 'Blk 11 Lot 4, Maminomoton St., Cl Mabuhay Village, Daraga',
  },
  {
    nameKeyword: 'Dyron',
    address: '217 SAN JUAN ST. POB. CASTILLA, SORSOGON',
    emergencyContactAddress: '217 SAN JUAN ST. POB. CASTILLA, SORSOGON',
  },
  {
    nameKeyword: 'Benzel',
    address: 'Ponso Polangui Albay',
    emergencyContactAddress: 'Ponso Polangui Albay',
  },
];

const DRY_RUN = false;

async function updateAddresses() {
  console.log('Fetching users from Firestore...');

  const usersSnapshot = await getDocs(collection(db, 'users'));

  let updatedCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userName = userData.name || '';

    const match = addressData.find((e) =>
      userName.toLowerCase().includes(e.nameKeyword.toLowerCase()),
    );

    if (match) {
      console.log(`\nFound: ${userName}`);
      console.log(
        `  Old: address=${userData.address}, emergencyContactAddress=${userData.emergencyContactAddress}`,
      );
      console.log(
        `  New: address=${match.address}, emergencyContactAddress=${match.emergencyContactAddress}`,
      );

      if (!DRY_RUN) {
        await updateDoc(doc(db, 'users', userDoc.id), {
          address: match.address,
          emergencyContactAddress: match.emergencyContactAddress,
        });
        console.log(`  ✓ Updated`);
        updatedCount++;
      }
    }
  }

  console.log(`\n--- ${DRY_RUN ? 'DRY RUN' : 'DONE'} ---`);
  console.log(`Updated: ${updatedCount}`);
}

updateAddresses()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
