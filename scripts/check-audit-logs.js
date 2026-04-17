const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account-key.json.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function checkAuditLogs() {
  try {
    const snapshot = await db.collection('auditLogs').orderBy('timestamp', 'desc').limit(20).get();

    console.log(`Found ${snapshot.size} audit logs:\n`);

    if (snapshot.empty) {
      console.log('No audit logs exist in the database.');
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`  Action: ${data.action}`);
      console.log(`  Details: ${data.details}`);
      console.log(`  PerformedBy: ${data.performedByName} (${data.performedBy})`);
      console.log(`  TargetUser: ${data.targetUserName || 'N/A'}`);
      console.log(
        `  Timestamp: ${data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp) : 'N/A'}`,
      );
      console.log(`  Metadata:`, JSON.stringify(data.metadata, null, 2));
      console.log('');
    });

    // Also check total count
    const fullCount = await db.collection('auditLogs').count().get();
    console.log(`Total audit logs in collection: ${fullCount.data().count}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAuditLogs();
