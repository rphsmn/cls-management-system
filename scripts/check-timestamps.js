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

async function checkTimestamps() {
  const snapshot = await db.collection('auditLogs')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  console.log('=== Top 10 Audit Logs (by timestamp desc) ===\n');
  
  snapshot.docs.forEach((doc, i) => {
    const data = doc.data();
    const ts = data.timestamp;
    let dateStr = 'null';
    if (ts && ts.toDate) {
      dateStr = ts.toDate().toISOString();
    } else if (ts) {
      dateStr = String(ts);
    }
    console.log(`${i+1}. ${data.action} - ${dateStr}`);
    console.log(`   Details: ${data.details.substring(0, 50)}...`);
    console.log();
  });
}

checkTimestamps().catch(console.error);