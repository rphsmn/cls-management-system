// Quick script to check user roles in Firestore
// Run: npm run check-user-roles

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Path to your service account key - update if needed
const serviceAccount = require('./service-account-key.json');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function checkAllUsers() {
  try {
    const usersSnapshot = await db.collection('users').get();

    console.log('=== All Users ===');
    console.log(`Total: ${usersSnapshot.size}\n`);

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`UID: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Email: ${data.email}`);
      console.log(`  Role: ${data.role} (type: ${typeof data.role})`);
      console.log(`  Department: ${data.department}`);
      console.log('');
    });

    console.log('\n=== Check complete ===');
  } catch (error) {
    console.error('Error checking users:', error);
  }
}

checkAllUsers();
