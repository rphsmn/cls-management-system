/**
 * Script to list all leave requests from Firestore
 * Usage: node scripts/list-leave-requests.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account-key.json.json');

initializeApp({
  credential: cert(serviceAccount)
});

const firestore = getFirestore();

async function listAllLeaveRequests() {
  console.log('Fetching all leave requests from Firestore...\n');
  
  try {
    const snapshot = await firestore.collection('leaveRequests').get();
    
    console.log(`Found ${snapshot.size} leave requests:\n`);
    
    // Group by employee
    const byEmployee = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const empName = data.employeeName || 'Unknown';
      const empId = data.employeeId || 'N/A';
      const key = `${empName} (${empId})`;
      
      if (!byEmployee[key]) {
        byEmployee[key] = [];
      }
      
      byEmployee[key].push({
        type: data.type,
        period: data.period,
        status: data.status,
        daysDeducted: data.daysDeducted,
        dateFiled: data.dateFiled,
        isHalfDay: data.isHalfDay
      });
    });
    
    // Sort employees by name
    const sortedEmployees = Object.keys(byEmployee).sort();
    
    for (const emp of sortedEmployees) {
      console.log(`\n${emp}:`);
      const requests = byEmployee[emp].sort((a, b) => {
        return new Date(b.dateFiled) - new Date(a.dateFiled);
      });
      
      requests.forEach(req => {
        const days = req.isHalfDay ? '0.5' : (req.daysDeducted || '1');
        console.log(`  - ${req.type}: ${req.period} (${days} day${req.isHalfDay ? '' : 's'}) [${req.status}]`);
      });
    }
    
    console.log(`\n\nTotal employees with leave: ${sortedEmployees.length}`);
    console.log(`Total leave requests: ${snapshot.size}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listAllLeaveRequests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });