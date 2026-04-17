const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account-key.json.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function listUsers() {
  try {
    const snapshot = await db.collection('users').get();
    console.log(`Total users: ${snapshot.size}\n`);
    console.log('UID, Name, Role (raw), Department');
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(
        `${doc.id} | ${data.name || 'N/A'} | [${typeof data.role} "${data.role}"] | ${data.department || 'N/A'}`,
      );
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

listUsers();
