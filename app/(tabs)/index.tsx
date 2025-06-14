import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { BACKGROUND_LOCATION_TASK, initializeLocationTask, logForegroundLocation } from '../../tasks/locationTask';
import { syncPendingLocations } from '../../utils/supabase';
import { useLocationHistory } from '../../hooks/useLocationHistory';
import Mapbox from '@rnmapbox/maps';

Mapbox.setAccessToken('pk.eyJ1IjoiYmh1bmFraXQiLCJhIjoiY204bXEzMGI1MGsyZDJqb21xczVwa2g2NSJ9.V7Rq9S46fNJNUI_YStsBCg');

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { pathCoordinates, addNewLocation, getGeoJSONLine } = useLocationHistory();

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        initializeLocationTask();
        await syncPendingLocations();
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Location permission denied');
          return;
        }

        const isBackgroundActive = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        
        if (isBackgroundActive) {
          const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setLocation(currentLocation);
        } else {
          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 20,
            },
            async (newLocation) => {
              setLocation(newLocation);
              await logForegroundLocation(newLocation, addNewLocation);
            }
          );
        }
      } catch (error) {
        console.error('Location setup error:', error);
        setErrorMsg('Failed to start location tracking');
      }
    })();

    return () => subscription?.remove();
  }, []);

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <Mapbox.MapView style={styles.map}>
      <Mapbox.Camera
        zoomLevel={16}
        centerCoordinate={[location.coords.longitude, location.coords.latitude]}
        animationMode="flyTo"
        animationDuration={1000}
      />
      
      {pathCoordinates.length > 1 && (
        <Mapbox.ShapeSource id="pathSource" shape={getGeoJSONLine()}>
          <Mapbox.LineLayer
            id="pathLayer"
            style={{
              lineColor: '#935EFF',
              lineWidth: 4,
              lineOpacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </Mapbox.ShapeSource>
      )}
      
      <Mapbox.LocationPuck visible={true} puckBearingEnabled={true} puckBearing="heading" />
    </Mapbox.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18 },
  errorText: { fontSize: 16, color: 'red', textAlign: 'center' },
});