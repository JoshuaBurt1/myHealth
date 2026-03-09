// apps/mobile/App.js
import React, { useEffect } from 'react';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncHealthMetric } from '@my-health/shared';

const TRACKING_TASK = 'background-health-task';

// 1. Define the Task (Must be in global scope)
// apps/mobile/App.js
TaskManager.defineTask(TRACKING_TASK, async ({ data, error }) => {
  if (error) return;

  if (data) {
    try {
      // 1. Get the ID we saved during login
      const userId = await AsyncStorage.getItem('user_id');
      
      if (!userId) {
        console.log("No user logged in. Skipping background sync.");
        return;
      }

      // 2. Get step data
      const end = new Date();
      const start = new Date();
      start.setMinutes(end.getMinutes() - 15);
      
      const result = await Pedometer.getStepCountAsync(start, end);

      if (result.steps > 0) {
        // 3. Use the SHARED logic to update Firestore
        // This ensures the Web App and Mobile App see the same data!
        await syncHealthMetric(userId, 'steps', result.steps);
      }
    } catch (err) {
      console.error("Background sync failed:", err);
    }
  }
});

export default function App() {
  useEffect(() => {
    const startTracking = async () => {
      // 2. Request Permissions
      const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
      if (foreStatus !== 'granted') return;

      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backStatus !== 'granted') return;

      // 3. Start Location Tracking (The "Anchor" for background work)
      await Location.startLocationUpdatesAsync(TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15 * 60 * 1000, // Every 15 minutes
        distanceInterval: 50, // Or every 50 meters
        foregroundService: {
          notificationTitle: "Health Tracker Active",
          notificationBody: "Tracking your steps in the background.",
        },
      });
    };

    startTracking();
  }, []);

  return null; // Your UI here
}