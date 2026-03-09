import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncHealthMetric } from '@my-health/shared';

const TRACKING_TASK = 'background-health-task';

// --- 1. Background Task Definition ---
TaskManager.defineTask(TRACKING_TASK, async ({ data, error }) => {
  if (error) return;
  try {
    const userId = await AsyncStorage.getItem('user_id');
    if (!userId) return; 

    const lastSyncStr = await AsyncStorage.getItem('last_step_sync');
    const start = lastSyncStr ? new Date(lastSyncStr) : new Date(Date.now() - 15 * 60000);
    const end = new Date();
    
    const result = await Pedometer.getStepCountAsync(start, end);
    if (result.steps > 0) {
      await syncHealthMetric(userId, 'steps', result.steps);
      await AsyncStorage.setItem('last_step_sync', end.toISOString());
    }
  } catch (err) {
    console.error("Native Sync Error:", err);
  }
});

export default function App() {
  const webViewRef = useRef(null);

  // --- 2. Initialize Tracking (Types removed for .js) ---
  const startTracking = async (uid) => {
    await AsyncStorage.setItem('user_id', uid);
    
    const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
    const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
    const isAvailable = await Pedometer.isAvailableAsync();

    if (isAvailable && foreStatus === 'granted' && backStatus === 'granted') {
      await Location.startLocationUpdatesAsync(TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15 * 60 * 1000,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: "myHealth Pedometer",
          notificationBody: "Tracking your steps in the background",
          notificationColor: "#3F51B5"
        },
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