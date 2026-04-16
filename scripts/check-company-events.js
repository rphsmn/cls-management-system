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

async function checkCompanyEvents() {
  const snapshot = await db.collection('auditLogs')
    .where('action', '==', 'company_event_added')
    .get();

  console.log('=== Company Event Timestamps ===\n');
  
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const ts = data.timestamp;
    let dateStr = 'null';
    if (ts && ts.toDate) {
      dateStr = ts.toDate().toISOString();
    }
    console.log(`ID: ${doc.id}`);
    console.log(`  Timestamp: ${dateStr}`);
    console.log(`  Event Date in metadata: ${data.metadata?.eventDate}`);
    console.log();
  });
}

checkCompanyEvents().catch(console.error);