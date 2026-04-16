const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account-key.json.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function trimAuditLogs() {
  console.log('=== Trimming Audit Log Names ===\n');

  const snapshot = await db.collection('auditLogs').get();
  console.log(`Found ${snapshot.size} audit log entries`);

  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const updates = {};

    if (data.targetUserName && typeof data.targetUserName === 'string') {
      const trimmed = data.targetUserName.trim();
      if (trimmed !== data.targetUserName) {
        updates.targetUserName = trimmed;
        needsUpdate = true;
      }
    }

    if (data.performedByName && typeof data.performedByName === 'string') {
      const trimmed = data.performedByName.trim();
      if (trimmed !== data.performedByName) {
        updates.performedByName = trimmed;
        needsUpdate = true;
      }
    }

    if (data.targetUserId && typeof data.targetUserId === 'string') {
      const trimmed = data.targetUserId.trim();
      if (trimmed !== data.targetUserId) {
        updates.targetUserId = trimmed;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await doc.ref.update(updates);
      updated++;
      console.log(`Trimmed: ${doc.id}`);
    }
  }

  console.log(`\nUpdated ${updated} entries`);
}

trimAuditLogs().catch(console.error);