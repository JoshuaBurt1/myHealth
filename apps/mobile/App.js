import React, { useEffect, useRef } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncHealthMetric } from '@my-health/shared';

const BACKGROUND_STEP_TASK = 'background-step-task';

// --- 1. Background Task Definition ---
TaskManager.defineTask(BACKGROUND_STEP_TASK, async () => {
  try {
    const userId = await AsyncStorage.getItem('user_id');
    if (!userId) return BackgroundFetch.BackgroundFetchResult.NoData;

    const lastSyncStr = await AsyncStorage.getItem('last_step_sync');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let start = lastSyncStr ? new Date(lastSyncStr) : new Date(Date.now() - 15 * 60000);

    if (start < twentyFourHoursAgo) start = twentyFourHoursAgo;
    const end = new Date();
    
    // Query the step history
    const result = await Pedometer.getStepCountAsync(start, end);
    console.log(`Syncing ${result.steps} steps from ${start.toISOString()} to ${end.toISOString()}`);
    
    if (result && result.steps > 0) {
      // Send to Firebase
      await syncHealthMetric(userId, 'steps', result.steps);
      // Update the timestamp for the next background wake-up
      await AsyncStorage.setItem('last_step_sync', end.toISOString());
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    console.error("Native Sync Error:", err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default function App() {
  const webViewRef = useRef(null);

  // --- 2. Initialize Tracking ---
  const startTracking = async (uid) => {
    await AsyncStorage.setItem('user_id', uid);
    
    const { status } = await Pedometer.requestPermissionsAsync();

    if (status === 'granted') {
      // Register the background fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_STEP_TASK, {
        minimumInterval: 15 * 60, // Minimum 15 minutes (OS enforced)
        stopOnTerminate: false,   // Keep running after app is swiped away (Android)
        startOnBoot: true,        // Start automatically after phone restarts (Android)
      });
    }
  };

  // --- 3. Handle Messages from Web App ---
  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'AUTH_SUCCESS') {
        startTracking(data.uid);
      }
    } catch (e) {
      console.error("Bridge Error:", e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView 
        ref={webViewRef}
        source={{ uri: 'https://myhealth79.web.app/' }} 
        onMessage={onMessage}
        style={{ flex: 1 }}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        startInLoadingState={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
});