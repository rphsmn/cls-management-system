const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account-key.json.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return Timestamp.fromDate(date);
  }
  if (value instanceof Timestamp) return value;
  return null;
}

async function fixTimestampTypes() {
  console.log('=== Fixing Audit Log Timestamps ===\n');

  const snapshot = await db.collection('auditLogs').get();
  console.log(`Found ${snapshot.size} audit log entries`);

  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const currentTimestamp = data.timestamp;
    
    if (currentTimestamp && typeof currentTimestamp === 'string') {
      const newTimestamp = parseTimestamp(currentTimestamp);
      if (newTimestamp) {
        await doc.ref.update({ timestamp: newTimestamp });
        updated++;
        console.log(`Fixed: ${currentTimestamp}`);
      }
    }
  }

  console.log(`\nUpdated ${updated} entries to Firestore Timestamps`);
}

fixTimestampTypes().catch(console.error);