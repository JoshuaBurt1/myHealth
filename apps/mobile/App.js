import React, { useRef } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { googleWebClientId } from '../../packages/shared/index';
import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus
} from 'react-native-health-connect';
try {
  GoogleSignin.configure({
    // Type 3: The actual Web Client ID
    webClientId: '702841156351-28u6bar82g96trp3nje8ro14m7nrn885.apps.googleusercontent.com',
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
  console.log("[GoogleSignin]: Configuration successful");
} catch (error) {
  console.error("[GoogleSignin Config Error]:", error);
}
export default function App() {
  const webViewRef = useRef(null);
  // --- 1. The Health Connect Fetcher ---
  const fetchHealthData = async () => {
    try {
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        throw new Error("Health Connect not available");
      }
      await initialize();
      // Request permissions for Steps and Heart Rate
      await requestPermission([
        { recordType: 'Steps', accessType: 'read' },
        { recordType: 'HeartRate', accessType: 'read' }
      ]);
      // Calculate Yesterday and Today Timeframes
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0); // Start of yesterday
      const endTime = now.toISOString();
      // Fetch 2 days of steps
      const { records: stepRecords } = await readRecords('Steps', {
        timeRangeFilter: { operator: 'between', startTime: yesterday.toISOString(), endTime }
      });
      // Only really need today for Heart Rate snapshot
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const { records: hrRecords } = await readRecords('HeartRate', {
        timeRangeFilter: { operator: 'between', startTime: todayStart.toISOString(), endTime }
      });
      // Helper to safely format dates to local YYYY-MM-DD
      const getLocalYYYYMMDD = (dateObj) => {
        return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000))
          .toISOString()
          .split('T')[0];
      };
      const todayStr = getLocalYYYYMMDD(now);
      const yesterdayStr = getLocalYYYYMMDD(yesterday);
      let todaySteps = 0;
      let yesterdaySteps = 0;
      // Group steps by day
      stepRecords.forEach(r => {
        const recordDate = getLocalYYYYMMDD(new Date(r.startTime));
        if (recordDate === todayStr) {
          todaySteps += (r.count || 0);
        } else if (recordDate === yesterdayStr) {
          yesterdaySteps += (r.count || 0);
        }
      });
      const lastHR = hrRecords.length > 0
        ? hrRecords[hrRecords.length - 1].samples?.[0]?.beatsPerMinute
        : null;
      // Pass neatly packaged objects
      return {
        today: { date: todayStr, steps: todaySteps },
        yesterday: { date: yesterdayStr, steps: yesterdaySteps },
        hr: lastHR
      };
    } catch (error) {
      console.error("Health Connect Error:", error);
      return { error: error.message };
    }
  };
  // --- 2. The Bridge Listener ---
  const onMessage = async (event) => {
    try {
      // Safety check for event data
      const rawData = event.nativeEvent.data;
      if (!rawData) return;
      const data = JSON.parse(rawData);
      console.log("[Bridge Message Received]:", data.type);
      if (data.type === 'TRIGGER_GOOGLE_LOGIN') {
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        // Safety: check if idToken exists before sending back
        if (userInfo.data?.idToken) {
          // Use JSON.stringify for the payload to handle escaping automatically
          const jsCode = `
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'GOOGLE_LOGIN_SUCCESS',
                payload: ${JSON.stringify(userInfo.data.idToken)}
              })
            }));
            true;
          `;
          webViewRef.current?.injectJavaScript(jsCode);
        }
      }
      if (data.type === 'SYNC_HEALTH_CONNECT') {
        const healthStats = await fetchHealthData();
        if (webViewRef.current) {
          const jsCode = `
            window.dispatchEvent(new MessageEvent('message', {
              data: ${JSON.stringify({
                type: 'HEALTH_CONNECT_RESULT',
                payload: healthStats
              })}
            }));
            true;
          `;
          webViewRef.current.injectJavaScript(jsCode);
        }
      }
    } catch (e) {
      console.log("[Bridge Error]:", e.message);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://myhealth79.web.app/' }}
        geolocationEnabled={true}
        onMessage={onMessage}
        style={{ flex: 1 }}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        thirdPartyCookiesEnabled={true}
        allowFileAccess={true}
        originWhitelist={['*']}
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