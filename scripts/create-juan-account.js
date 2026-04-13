const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyD3vvh9c3L4qQ3nYvXJxcgk1j5E8VvW',
  authDomain: 'cls-hris.firebaseapp.com',
  projectId: 'cls-hris',
  storageBucket: 'cls-hris.appspot.com',
  messagingSenderId: '1088538861786',
  appId: '1:1088538861786:web:5e3a8e8c8e8c8e8c8e8c8',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createJuanAccount() {
  const juanUser = {
    uid: 'demo-juan-' + Date.now(),
    name: 'Juan De la Cruz',
    email: 'juandelacruzcorlogicdemo@gmail.com',
    role: 'OPERATIONS ADMIN',
    dept: 'Operations-Admin',
    employeeId: 'CLS-OPS00001',
    mobileNo: '09123456789',
    address: '123 Sample Street, Sample City, Philippines',
    birthday: '1990-05-15',
    gender: 'male',
    joinedDate: '2023-01-10',
    sss: '12-3456789-0',
    philhealth: '1234-5678-9012',
    pagibig: '1234-5678-9012',
    tin: '123-456-789-000',
    birthdayLeave: 1,
    leaveBalance: 10,
    leaveBalanceNote: 'Total: 11, Used: 1, Remaining: 10',
    emergencyContactPerson: 'Maria De la Cruz',
    emergencyContactRelation: 'Spouse',
    emergencyContactMobile: '09987654321',
    emergencyContactAddress: '123 Sample Street, Sample City, Philippines',
    manuallyAbsent: false,
    absentDate: null,
    absentReason: null,
    markedAbsentBy: null,
    markedAbsentAt: null,
    balances: {
      'Paid Leave': { rem: 5, used: 2, pen: 0 },
      'Sick Leave': { rem: 5, used: 0, pen: 0 },
      'Birthday Leave': { rem: 1, used: 0, pen: 0 },
    },
  };

  try {
    const docRef = await addDoc(collection(db, 'users'), juanUser);
    console.log('Juan De la Cruz account created!');
    console.log('Document ID:', docRef.id);
    console.log('Employee ID:', juanUser.employeeId);
    console.log('Role:', juanUser.role);
    console.log('Dept:', juanUser.dept);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createJuanAccount()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
