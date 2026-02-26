import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCJ-T_cwN6F-8SVOB48fIqqbTJSDtSoGz8",
  authDomain: "presawatch.firebaseapp.com",
  projectId: "presawatch",
  storageBucket: "presawatch.firebasestorage.app",
  messagingSenderId: "344850391677",
  appId: "1:344850391677:web:be62d08cb1fc8e68ce4714"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});