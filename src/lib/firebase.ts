import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  Timestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Allowed email addresses
const getAllowedEmails = (): string[] => {
  const emails = process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '';
  return emails.split(',').map(email => email.trim()).filter(Boolean);
};

// Check if email is allowed
export const isEmailAllowed = (email: string): boolean => {
  const allowedEmails = getAllowedEmails();
  return allowedEmails.includes(email.toLowerCase());
};

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if email is allowed
    if (!user.email || !isEmailAllowed(user.email)) {
      await signOut(auth);
      return { 
        success: false, 
        error: 'Access denied. Only authorized email addresses can sign in.' 
      };
    }
    
    // Create or update user in Firestore
    await createOrUpdateUser(user);
    
    return { success: true, user };
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    return { success: false, error: error.message };
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: any) {
    console.error('Error signing out:', error);
    return { success: false, error: error.message };
  }
};

// Create or update user document
const createOrUpdateUser = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      updatedAt: serverTimestamp(),
    });
  }
};

// Employee interface
export interface Employee {
  id?: string;
  employeeId: string;
  name: string;
  address: string;
  position: string;
  basicSalary: number;
  currency: string;
  joiningDate: string;
  email?: string;
  phone?: string;
  status: 'probation' | 'parttime' | 'fulltime' | 'on notice' | 'fired' | 'resigned';
  contractSent: boolean;
  contractSentDate?: string;
  statusChangeDate?: string; // Date when status was last changed (important for fired employees)
  promotions?: Promotion[];
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface Promotion {
  id?: string;
  date: string;
  fromPosition: string;
  toPosition: string;
  fromSalary: number;
  toSalary: number;
  notes?: string;
  createdAt?: Timestamp | Date;
}

export interface SalaryItem {
  description: string;
  amount: number;
}

export interface SalaryRecord {
  id?: string;
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  amount: number; // Total amount (for backward compatibility and quick access)
  items?: SalaryItem[]; // Line items with descriptions
  paymentDate: string;
  status: 'paid' | 'pending';
  createdAt?: Timestamp | Date;
}

export interface EmployeePayment {
  employeeName: string;
  amount: number;
  charges: number;
}

export interface IncomeRecord {
  id?: string;
  month: number;
  year: number;
  originalAudSalary: number; // Original AUD salary
  usdAmount: number; // USD amount
  usdRate: number; // USD rate (manual entry)
  nprReceived: number; // NPR received money
  bankCutsKnown: number; // Known bank cuts
  bankCutsHidden: number; // Hidden bank cuts (calculated: actual converted NPR - received NPR)
  employeePayments: EmployeePayment[]; // Array of employee payments with name, amount, charges
  profitLossNpr: number; // Profit/Loss in NPR
  profitLossAud: number; // Profit/Loss in AUD
  profitLossUsd: number; // Profit/Loss in USD
  // Legacy fields for backward compatibility
  totalAudReceived?: number;
  founderSalaryAud?: number;
  conversionRate?: number; // AUD to NPR
  bankCutsNpr?: number; // in NPR (local bank fees)
  totalEmployeeSalariesNpr?: number;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// Collections
export const collections = {
  employees: 'employees',
  salaryRecords: 'salaryRecords',
  incomeRecords: 'incomeRecords',
};

// Employee CRUD operations
export const createEmployee = async (employee: Omit<Employee, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, collections.employees), {
      ...employee,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Error creating employee:', error);
    return { success: false, error: error.message };
  }
};

export const getEmployees = async () => {
  try {
    const q = query(collection(db, collections.employees), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const employees: Employee[] = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    querySnapshot.forEach((doc) => {
      const employee = { id: doc.id, ...doc.data() } as Employee;
      
      // Filter out fired employees after 1 week
      if (employee.status === 'fired' && employee.statusChangeDate) {
        const firedDate = new Date(employee.statusChangeDate);
        if (firedDate < oneWeekAgo) {
          // Skip this employee - fired more than 1 week ago
          return;
        }
      }
      
      employees.push(employee);
    });
    
    return { success: true, data: employees };
  } catch (error: any) {
    console.error('Error getting employees:', error);
    return { success: false, error: error.message };
  }
};

export const getEmployeeById = async (id: string) => {
  try {
    const docRef = doc(db, collections.employees, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { success: true, data: { id: docSnap.id, ...docSnap.data() } as Employee };
    } else {
      return { success: false, error: 'Employee not found' };
    }
  } catch (error: any) {
    console.error('Error getting employee:', error);
    return { success: false, error: error.message };
  }
};

export const updateEmployee = async (id: string, updates: Partial<Employee>) => {
  try {
    const docRef = doc(db, collections.employees, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error updating employee:', error);
    return { success: false, error: error.message };
  }
};

export const deleteEmployee = async (id: string) => {
  try {
    const docRef = doc(db, collections.employees, id);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    return { success: false, error: error.message };
  }
};

// Add promotion to employee
export const addPromotion = async (employeeId: string, promotion: Omit<Promotion, 'id'>) => {
  try {
    const employeeRef = doc(db, collections.employees, employeeId);
    const employeeSnap = await getDoc(employeeRef);
    
    if (!employeeSnap.exists()) {
      return { success: false, error: 'Employee not found' };
    }
    
    const employee = employeeSnap.data() as Employee;
    const promotions = employee.promotions || [];
    
    // Create promotion object with ISO date string instead of serverTimestamp()
    // Firestore doesn't support serverTimestamp() inside arrays
    const newPromotion = {
      ...promotion,
      createdAt: new Date().toISOString(), // Use ISO string instead of serverTimestamp()
    };
    
    await updateDoc(employeeRef, {
      promotions: [...promotions, newPromotion],
      position: promotion.toPosition,
      basicSalary: promotion.toSalary,
      updatedAt: serverTimestamp(),
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error adding promotion:', error);
    return { success: false, error: error.message };
  }
};

// Salary record operations
export const createSalaryRecord = async (record: Omit<SalaryRecord, 'id'>) => {
  try {
    // Calculate total amount from items if items are provided
    let totalAmount = record.amount
    if (record.items && record.items.length > 0) {
      totalAmount = record.items.reduce((sum, item) => sum + item.amount, 0)
    }
    
    const docRef = await addDoc(collection(db, collections.salaryRecords), {
      ...record,
      amount: totalAmount, // Ensure amount is always set (either provided or calculated)
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Error creating salary record:', error);
    return { success: false, error: error.message };
  }
};

export const getSalaryRecords = async (employeeId?: string) => {
  try {
    let q;
    if (employeeId) {
      q = query(
        collection(db, collections.salaryRecords),
        where('employeeId', '==', employeeId),
        orderBy('year', 'desc'),
        orderBy('month', 'desc')
      );
    } else {
      q = query(
        collection(db, collections.salaryRecords),
        orderBy('year', 'desc'),
        orderBy('month', 'desc')
      );
    }
    
    const querySnapshot = await getDocs(q);
    const records: SalaryRecord[] = [];
    
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as SalaryRecord);
    });
    
    return { success: true, data: records };
  } catch (error: any) {
    console.error('Error getting salary records:', error);
    return { success: false, error: error.message };
  }
};

// Update employee status
export const updateEmployeeStatus = async (employeeId: string, status: Employee['status']) => {
  try {
    const docRef = doc(db, collections.employees, employeeId);
    await updateDoc(docRef, {
      status,
      statusChangeDate: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error updating employee status:', error);
    return { success: false, error: error.message };
  }
};

// Calculate days since joined
export const calculateDaysSinceJoined = (joiningDate: string): number => {
  const joinDate = new Date(joiningDate);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - joinDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Income record operations
export const createIncomeRecord = async (record: Omit<IncomeRecord, 'id'>) => {
  try {
    // Check if record for this month/year already exists
    const q = query(
      collection(db, collections.incomeRecords),
      where('month', '==', record.month),
      where('year', '==', record.year)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { success: false, error: 'Income record for this month already exists' };
    }

    const docRef = await addDoc(collection(db, collections.incomeRecords), {
      ...record,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Error creating income record:', error);
    return { success: false, error: error.message };
  }
};

export const getIncomeRecords = async (month?: number, year?: number) => {
  try {
    let q;
    if (month && year) {
      q = query(
        collection(db, collections.incomeRecords),
        where('month', '==', month),
        where('year', '==', year)
      );
    } else {
      q = query(
        collection(db, collections.incomeRecords),
        orderBy('year', 'desc'),
        orderBy('month', 'desc')
      );
    }
    
    const querySnapshot = await getDocs(q);
    const records: IncomeRecord[] = [];
    
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as IncomeRecord);
    });
    
    return { success: true, data: records };
  } catch (error: any) {
    console.error('Error getting income records:', error);
    return { success: false, error: error.message };
  }
};

export const getIncomeRecordsByMonths = async (monthYearPairs: Array<{ month: number; year: number }>) => {
  try {
    const allRecords: IncomeRecord[] = [];
    
    // Fetch all records and filter in memory (Firestore doesn't support OR on compound queries)
    const q = query(collection(db, collections.incomeRecords));
    const querySnapshot = await getDocs(q);
    
    const monthYearSet = new Set(monthYearPairs.map(my => `${my.year}-${my.month}`));
    
    querySnapshot.forEach((doc) => {
      const record = { id: doc.id, ...doc.data() } as IncomeRecord;
      if (monthYearSet.has(`${record.year}-${record.month}`)) {
        allRecords.push(record);
      }
    });
    
    // Sort by year and month descending
    allRecords.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
    
    return { success: true, data: allRecords };
  } catch (error: any) {
    console.error('Error getting income records by months:', error);
    return { success: false, error: error.message };
  }
};

export const updateIncomeRecord = async (id: string, updates: Partial<IncomeRecord>) => {
  try {
    const docRef = doc(db, collections.incomeRecords, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error updating income record:', error);
    return { success: false, error: error.message };
  }
};

export const deleteIncomeRecord = async (id: string) => {
  try {
    const docRef = doc(db, collections.incomeRecords, id);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting income record:', error);
    return { success: false, error: error.message };
  }
};

