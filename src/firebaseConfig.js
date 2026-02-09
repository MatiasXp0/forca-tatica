import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDjssGbT5ZH5pAW6AD8zZd1hEtYJ5rQKPE',
  authDomain: 'forca-tatica.firebaseapp.com',
  databaseURL: 'https://forca-tatica-default-rtdb.firebaseio.com',
  projectId: 'forca-tatica',
  storageBucket: 'forca-tatica.firebasestorage.app',
  messagingSenderId: '336042214784',
  appId: '1:336042214784:web:adfdbe720072cc63c02d65',
  measurementId: 'G-P7JNS8G3T7',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
