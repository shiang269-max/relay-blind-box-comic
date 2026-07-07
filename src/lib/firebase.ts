import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyC4SBQuN2e57kThEdxUdZfOMQLUgZuFKAg",
  authDomain: "relay-comic.firebaseapp.com",
  databaseURL: "https://relay-comic-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "relay-comic",
  storageBucket: "relay-comic.firebasestorage.app",
  messagingSenderId: "481938883830",
  appId: "1:481938883830:web:69b7d119437ad90c8598d7"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
