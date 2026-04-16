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

async function setCompanyEventTimestamps() {
  console.log('=== Setting Company Event Timestamps ===\n');
  console.log('Current time: 2026-04-16 08:59\n');

  const snapshot = await db.collection('auditLogs')
    .where('action', '==', 'company_event_added')
    .get();

  console.log(`Found ${snapshot.size} company event entries`);

  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const meta = data.metadata;
    const eventDateStr = meta?.eventDate;
    
    if (eventDateStr === '2026-04-25') {
      await doc.ref.update({ 
        timestamp: Timestamp.fromDate(new Date('2026-04-02T04:42:00Z'))
      });
    } else if (eventDateStr === '2026-04-19') {
      await doc.ref.update({ 
        timestamp: Timestamp.fromDate(new Date('2026-04-02T04:33:00Z'))
      });
    }
    updated++;
  }

  console.log(`Updated ${updated} company event timestamps to when script originally ran`);
}

setCompanyEventTimestamps().catch(console.error);