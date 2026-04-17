const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account-key.json.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const auth = getAuth();

async function checkUserDocIds() {
  try {
    // Get all Firebase Auth users
    const authUsers = await auth.listUsers();
    console.log(
      `Firebase Auth users:${authUsers.users.map((u) => `\n  UID: ${u.uid}, Email: ${u.email}`).join('')}\n`,
    );

    // Get all Firestore user documents
    const fsSnap = await db.collection('users').get();
    console.log(`Firestore users:`);
    fsSnap.forEach((doc) => {
      const data = doc.data();
      console.log(
        `  Doc ID: ${doc.id}, UID field: ${data.uid || 'N/A'}, Email: ${data.email}, Role: ${data.role}`,
      );
    });

    // Check if any Auth UID matches a Firestore doc ID
    console.log('\nMatching check:');
    authUsers.users.forEach((authUser) => {
      const fsUser = fsSnap.docs.find((d) => d.id === authUser.uid);
      if (fsUser) {
        console.log(`  MATCH: Auth UID ${authUser.uid} == Firestore doc ID`);
      } else {
        console.log(`  NO MATCH: Auth UID ${authUser.uid} not found as doc ID`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUserDocIds();
