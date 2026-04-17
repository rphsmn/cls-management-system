const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkCurrentUser() {
  try {
    // Get the current logged-in user from Firebase Auth
    const auth = require('firebase-admin/auth');
    // List users and find the recently logged in one
    const users = await auth.listUsers();

    console.log('First 5 users:');
    for (let i = 0; i < Math.min(5, users.users.length); i++) {
      const user = users.users[i];
      const uid = user.uid;
      const email = user.email;

      // Get Firestore profile
      const profile = await db.collection('users').doc(uid).get();
      console.log(`\nUser ${i + 1}:`);
      console.log(`  UID: ${uid}`);
      console.log(`  Email: ${email}`);
      if (profile.exists) {
        console.log(`  Profile exists: true`);
        console.log(`  Role: ${profile.data().role}`);
        console.log(`  Department: ${profile.data().department}`);
        console.log(`  Name: ${profile.data().name}`);
      } else {
        console.log(`  Profile exists: false`);
      }
    }

    console.log(`\nTotal users: ${users.users.length}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCurrentUser();
