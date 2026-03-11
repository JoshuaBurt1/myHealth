import React, { useRef } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { 
  initialize, 
  requestPermission, 
  readRecords, 
  getSdkStatus,
  SdkAvailabilityStatus 
} from 'react-native-health-connect';

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

      // Get today's data
      const startTime = new Date();
      startTime.setHours(0, 0, 0, 0);
      const endTime = new Date().toISOString();

      const { records: stepRecords } = await readRecords('Steps', {
        timeRangeFilter: { operator: 'between', startTime: startTime.toISOString(), endTime }
      });
      
      const { records: hrRecords } = await readRecords('HeartRate', {
        timeRangeFilter: { operator: 'between', startTime: startTime.toISOString(), endTime }
      });

      // Calculate totals
      const totalSteps = stepRecords.reduce((sum, r) => sum + (r.count || 0), 0);
      const lastHR = hrRecords.length > 0 
        ? hrRecords[hrRecords.length - 1].samples?.[0]?.beatsPerMinute 
        : null;

      return { steps: totalSteps, hr: lastHR };

    } catch (error) {
      console.error("Health Connect Error:", error);
      return { error: error.message };
    }
  };

  // --- 2. The Bridge Listener ---
  const onMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("[Bridge Message Received]:", data.type);
      
      // If the web app asks for a sync...
      if (data.type === 'SYNC_HEALTH_CONNECT') {
        const healthStats = await fetchHealthData();
        
        // Send the result back to the web app
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
        source={{ uri: 'https://myhealth79.web.app/' }} // Or your local dev IP for testing
        onMessage={onMessage}
        style={{ flex: 1 }}
        domStorageEnabled={true}
        javaScriptEnabled={true}
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