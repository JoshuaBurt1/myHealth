import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { syncHealthMetric } from '@my-health/shared'; // Using your shared logic!

const TRACKING_TASK = 'background-health-task';

TaskManager.defineTask(TRACKING_TASK, async ({ data, error }) => {
  if (error) return;
  if (data) {
    const { locations } = data;
    const [location] = locations;
    
    // Fetch steps from Native Pedometer (more accurate than Accelerometer math)
    const end = new Date();
    const start = new Date();
    start.setMinutes(end.getMinutes() - 5);
    
    const result = await Pedometer.getStepCountAsync(start, end);
    const userId = "get-from-async-storage"; // Consistent with your Web login

    // Call your shared logic to update Firestore
    await syncHealthMetric(userId, 'steps', result.steps);
  }
});