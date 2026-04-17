const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account-key.json.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const auth = getAuth();

async function migrateUserDocIds() {
  const usersSnapshot = await db.collection('users').get();
  console.log(`Found ${usersSnapshot.size} user documents to migrate`);

  let success = 0;
  let fail = 0;

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const email = data.email;

    if (!email) {
      console.log(`Skipping doc ${doc.id}: no email`);
      continue;
    }

    try {
      // Find Firebase Auth user by email
      const authUser = await auth.getUserByEmail(email);
      const authUid = authUser.uid;

      if (doc.id === authUid) {
        console.log(`Doc ${doc.id} already matches auth UID, skipping`);
        continue;
      }

      // Check if a document with the auth UID already exists (unlikely)
      const existing = await db.collection('users').doc(authUid).get();
      if (existing.exists) {
        console.log(
          `WARNING: Document with ID ${authUid} already exists! Skipping migration for ${email}`,
        );
        fail++;
        continue;
      }

      // Copy data to new document with auth UID as doc ID
      await db.collection('users').doc(authUid).set(data);

      // Delete old document
      await doc.ref.delete();

      console.log(`Migrated ${email}: ${doc.id} -> ${authUid}`);
      success++;
    } catch (error) {
      console.error(`Failed to migrate ${email}:`, error.message);
      fail++;
    }
  }

  console.log(`\nMigration complete: ${success} succeeded, ${fail} failed`);
}

migrateUserDocIds()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
