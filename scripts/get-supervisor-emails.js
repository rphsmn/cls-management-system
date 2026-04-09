/**
 * Get emails for supervisors and managers
 * Usage: node scripts/get-supervisor-emails.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account-key.json.json');

initializeApp({
  credential: cert(serviceAccount)
});

const firestore = getFirestore();

async function getSupervisorEmails() {
  console.log('Fetching supervisor emails...\n');
  
  const targetRoles = [
    'OPERATIONS ADMIN SUPERVISOR',
    'HUMAN RESOURCE OFFICER', 
    'ACCOUNT SUPERVISOR',
    'ADMIN MANAGER'
  ];
  
  try {
    const snapshot = await firestore.collection('users').get();
    
    const emails = {
      hrEmail: '',
      operationsAdminSupervisor: '',
      accountSupervisor: '',
      adminManager: ''
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const role = (data.role || '').toUpperCase();
      
      if (role === 'HUMAN RESOURCE OFFICER' || role === 'HR') {
        emails.hrEmail = data.email;
      } else if (role === 'OPERATIONS ADMIN SUPERVISOR') {
        emails.operationsAdminSupervisor = data.email;
      } else if (role === 'ACCOUNT SUPERVISOR') {
        emails.accountSupervisor = data.email;
      } else if (role === 'ADMIN MANAGER') {
        emails.adminManager = data.email;
      }
    });
    
    console.log('Supervisor emails found:');
    console.log(JSON.stringify(emails, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getSupervisorEmails()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });