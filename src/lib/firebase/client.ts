import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBHI-5I2BOWEFALho8Yd7vzwF8Ayozr_ms",
  authDomain: "calorie-line-app.firebaseapp.com",
  projectId: "calorie-line-app",
  storageBucket: "calorie-line-app.firebasestorage.app",
  messagingSenderId: "903200043425",
  appId: "1:903200043425:web:c2e3d063dea360d766dbe0",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: "select_account",
});
