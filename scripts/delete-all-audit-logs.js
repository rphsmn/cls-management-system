const { initializeApp } = require('firebase/data');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyD...',
  authDomain: 'cls-hris.firebaseapp.com',
  projectId: 'cls-hris',
  storageBucket: 'cls-hris.appspot.com',
  messagingSenderId: '123...',
  appId: '1:123...',
  databaseURL: 'https://cls-hris-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteAllAuditLogs() {
  console.log('Fetching audit logs...');

  const logsRef = collection(db, 'auditLogs');
  const snapshot = await getDocs(logsRef);

  console.log(`Found ${snapshot.size} audit logs`);

  if (snapshot.size === 0) {
    console.log('No logs to delete');
    return;
  }

  const deletePromises = snapshot.docs.map(async (docSnapshot) => {
    console.log('Deleting:', docSnapshot.id);
    await deleteDoc(doc(db, 'auditLogs', docSnapshot.id));
  });

  await Promise.all(deletePromises);
  console.log(`Deleted ${snapshot.size} audit logs`);
}

deleteAllAuditLogs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
