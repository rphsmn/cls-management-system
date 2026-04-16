const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account-key.json.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

const ACTION_TYPES = {
  LEAVE_APPROVED: 'leave_approved',
  LEAVE_REJECTED: 'leave_rejected',
  LEAVE_CANCELLED: 'leave_cancelled',
  COMPANY_EVENT: 'company_event_added'
};

async function getUserEmailMapping() {
  const usersSnapshot = await db.collection('users').get();
  const mapping = {};
  
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const email = data.email?.toLowerCase();
    if (email) {
      mapping[email] = {
        uid: data.uid || doc.id,
        name: data.name || 'Unknown',
        employeeId: data.employeeId || 'Unknown'
      };
    }
  }
  
  console.log(`Loaded ${Object.keys(mapping).length} user mappings`);
  return mapping;
}

async function findUidByEmail(email) {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (e) {
    return null;
  }
}

async function populateAuditLogsFromApprovedLeaves(userMapping) {
  console.log('\n=== Processing Approved Leave Requests ===');
  
  const requestsSnapshot = await db.collection('leaveRequests')
    .where('status', '==', 'Approved')
    .get();
  
  console.log(`Found ${requestsSnapshot.size} approved leave requests`);
  
  let created = 0;
  let skipped = 0;
  
  for (const doc of requestsSnapshot.docs) {
    const data = doc.data();
    
    const existingLogs = await db.collection('auditLogs')
      .where('metadata.requestId', '==', doc.id)
      .where('action', '==', ACTION_TYPES.LEAVE_APPROVED)
      .limit(1)
      .get();
    
    if (!existingLogs.empty) {
      skipped++;
      continue;
    }
    
    const approverName = data.approvedBy || data.lastApprovedBy || 'HR';
    const approverUid = data.approvedByUid || 'system';
    const employeeName = data.employeeName || 'Unknown';
    const employeeId = data.employeeId || 'Unknown';
    
    const logEntry = {
      action: ACTION_TYPES.LEAVE_APPROVED,
      details: `${employeeName} (${employeeId}) - ${data.type} leave from ${data.startDate} to ${data.endDate} (${data.noOfDays} day(s)) was approved`,
      targetUserId: data.uid || employeeId,
      targetUserName: employeeName,
      performedBy: approverUid,
      performedByName: approverName,
      timestamp: data.dateApproved || data.lastApprovedDate || data.dateFiled || new Date().toISOString(),
      metadata: {
        requestId: doc.id,
        leaveType: data.type || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        noOfDays: data.noOfDays || null
      }
    };
    
    await db.collection('auditLogs').add(logEntry);
    created++;
    console.log(`Created audit log for: ${employeeName} - ${data.type}`);
  }
  
  console.log(`\nApproved leaves processed: ${created} created, ${skipped} skipped`);
  return created;
}

async function populateAuditLogsFromRejectedLeaves(userMapping) {
  console.log('\n=== Processing Rejected Leave Requests ===');
  
  const requestsSnapshot = await db.collection('leaveRequests')
    .where('status', '==', 'Rejected')
    .get();
  
  console.log(`Found ${requestsSnapshot.size} rejected leave requests`);
  
  let created = 0;
  let skipped = 0;
  
  for (const doc of requestsSnapshot.docs) {
    const existingLogs = await db.collection('auditLogs')
      .where('metadata.requestId', '==', doc.id)
      .where('action', '==', ACTION_TYPES.LEAVE_REJECTED)
      .limit(1)
      .get();
    
    if (!existingLogs.empty) {
      skipped++;
      continue;
    }
    
    const data = doc.data();
    const employeeName = data.employeeName || 'Unknown';
    const employeeId = data.employeeId || 'Unknown';
    const rejectorName = (data.status || '').replace('Rejected by ', '') || 'Unknown';
    
    const logEntry = {
      action: ACTION_TYPES.LEAVE_REJECTED,
      details: `${employeeName} (${employeeId}) - ${data.type} leave from ${data.startDate} to ${data.endDate} was rejected by ${rejectorName}`,
      targetUserId: data.uid || employeeId,
      targetUserName: employeeName,
      performedBy: data.rejectedByUid || 'system',
      performedByName: rejectorName,
      timestamp: data.dateRejected || new Date().toISOString(),
      metadata: {
        requestId: doc.id,
        leaveType: data.type || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        reason: data.rejectionReason || 'Not specified'
      }
    };
    
    await db.collection('auditLogs').add(logEntry);
    created++;
    console.log(`Created audit log for: ${employeeName} - Rejected`);
  }
  
  console.log(`\nRejected leaves processed: ${created} created, ${skipped} skipped`);
  return created;
}

async function populateAuditLogsFromCancelledLeaves(userMapping) {
  console.log('\n=== Processing Cancelled Leave Requests ===');
  
  const requestsSnapshot = await db.collection('leaveRequests')
    .where('status', '==', 'Cancelled')
    .get();
  
  console.log(`Found ${requestsSnapshot.size} cancelled leave requests`);
  
  let created = 0;
  let skipped = 0;
  
  for (const doc of requestsSnapshot.docs) {
    const existingLogs = await db.collection('auditLogs')
      .where('metadata.requestId', '==', doc.id)
      .where('action', '==', ACTION_TYPES.LEAVE_CANCELLED)
      .limit(1)
      .get();
    
    if (!existingLogs.empty) {
      skipped++;
      continue;
    }
    
    const data = doc.data();
    const employeeName = data.employeeName || 'Unknown';
    const employeeId = data.employeeId || 'Unknown';
    
    const logEntry = {
      action: ACTION_TYPES.LEAVE_CANCELLED,
      details: `${employeeName} (${employeeId}) - ${data.type} leave from ${data.startDate} to ${data.endDate} was cancelled`,
      targetUserId: data.uid || employeeId,
      targetUserName: employeeName,
      performedBy: data.uid || 'system',
      performedByName: employeeName,
      timestamp: data.dateCancelled || new Date().toISOString(),
      metadata: {
        requestId: doc.id,
        leaveType: data.type || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        cancellationReason: data.cancellationReason || ''
      }
    };
    
    await db.collection('auditLogs').add(logEntry);
    created++;
    console.log(`Created audit log for: ${employeeName} - Cancelled`);
  }
  
  console.log(`\nCancelled leaves processed: ${created} created, ${skipped} skipped`);
  return created;
}

async function populateAuditLogsFromCompanyEvents(userMapping) {
  console.log('\n=== Processing Company Events ===');
  
  const eventsSnapshot = await db.collection('company_events').get();
  
  console.log(`Found ${eventsSnapshot.size} company events`);
  
  let created = 0;
  let skipped = 0;
  
  for (const doc of eventsSnapshot.docs) {
    const data = doc.data();
    
    const existingLogs = await db.collection('auditLogs')
      .where('metadata.eventId', '==', doc.id)
      .where('action', '==', ACTION_TYPES.COMPANY_EVENT)
      .limit(1)
      .get();
    
    if (!existingLogs.empty) {
      skipped++;
      continue;
    }
    
    const eventName = data.name || 'Company Event';
    const eventDate = data.date || 'Unknown';
    
    const logEntry = {
      action: ACTION_TYPES.COMPANY_EVENT,
      details: `Company event "${eventName}" scheduled for ${eventDate}`,
      targetUserId: null,
      targetUserName: null,
      performedBy: data.createdBy || 'system',
      performedByName: data.createdByName || 'Admin',
      timestamp: data.createdAt || data.date || new Date().toISOString(),
      metadata: {
        eventId: doc.id,
        eventName: eventName || null,
        eventDate: eventDate || null,
        eventType: data.type || 'holiday'
      }
    };
    
    await db.collection('auditLogs').add(logEntry);
    created++;
    console.log(`Created audit log for event: ${eventName}`);
  }
  
  console.log(`\nCompany events processed: ${created} created, ${skipped} skipped`);
  return created;
}

async function main() {
  console.log('=== Audit Log Population Script ===\n');
  
  const userMapping = await getUserEmailMapping();
  
  let totalCreated = 0;
  
  totalCreated += await populateAuditLogsFromApprovedLeaves(userMapping);
  totalCreated += await populateAuditLogsFromRejectedLeaves(userMapping);
  totalCreated += await populateAuditLogsFromCancelledLeaves(userMapping);
  totalCreated += await populateAuditLogsFromCompanyEvents(userMapping);
  
  console.log('\n=== Summary ===');
  console.log(`Total audit log entries created: ${totalCreated}`);
  console.log('\nDone!');
}

main().catch(console.error);