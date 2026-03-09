// apps/mobile/src/auth/AuthProvider.js (or wherever you handle login)
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase'; // Your mobile firebase config
import AsyncStorage from '@react-native-async-storage/async-storage';

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Save to AsyncStorage so the Background Task can find it later
    await AsyncStorage.setItem('user_id', user.uid);
    console.log("User ID saved for background sync:", user.uid);
  } else {
    await AsyncStorage.removeItem('user_id');
  }
});