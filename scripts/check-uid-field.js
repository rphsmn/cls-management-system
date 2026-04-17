const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account-key.json.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkUidFields() {
  const snap = await db.collection('users').limit(3).get();
  snap.forEach((doc) => {
    const data = doc.data();
    console.log(`Doc ID: ${doc.id}`);
    console.log(`  Fields:`, Object.keys(data));
    console.log(`  uid field: ${data.uid}`);
    console.log(`  role: ${data.role}`);
    console.log('');
  });
}
checkUidFields();
