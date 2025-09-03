// firestore.js - Firebase & Firestore (optional). Safe no-op if scripts blocked.
const firebaseConfig = {
  apiKey: "AIzaSyBW5iWg5mCgbzjF9MBdR32VJi4uX2JHf0A",
  authDomain: "mcb-database-b9815.firebaseapp.com",
  projectId: "mcb-database-b9815",
  storageBucket: "mcb-database-b9815.firebasestorage.app",
  messagingSenderId: "541175340452",
  appId: "1:541175340452:web:156f7c14ef081bde633531",
  measurementId: "G-Y2DY5J84RL"
};

try{
  if(typeof firebase!=='undefined' && !firebase.apps?.length){
    firebase.initializeApp(firebaseConfig);
    window.fs = firebase.firestore();
    try{ fs.enablePersistence && fs.enablePersistence(); }catch(e){ console.warn('FS persistence not enabled', e); }
  }
}catch(e){ console.warn('Firebase init skipped', e); }
// Force sync between IndexedDB and Firestore
async function forceSync() {
  console.log("🔄 Forcing sync between IndexedDB and Firestore...");
  // Example: loop through your IndexedDB stores and push to Firestore
  // Then pull down latest data from Firestore
  // (Implementation depends on your schema)

  // For now just simulate
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 1000);
  });
}
