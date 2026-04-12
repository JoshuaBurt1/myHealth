// LocationContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

interface LocationContextType {
  userLocation: [number, number] | null;
  locationError: string | null;
}

const LocationContext = createContext<LocationContextType>({
  userLocation: null,
  locationError: null,
});

export const useLocation = () => useContext(LocationContext);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    // watchPosition fires automatically whenever the device's location changes
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setLocationError(null);
      },
      (error) => {
        console.warn("Location error:", error.message);
        setLocationError(error.message);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return (
    <LocationContext.Provider value={{ userLocation, locationError }}>
      {children}
    </LocationContext.Provider>
  );
};