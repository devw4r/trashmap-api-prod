import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import axios from 'axios';
import AddReport from './AddReport';
import * as Location from 'expo-location';

export default function App() {
  const mapRef = useRef(null);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const initLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);

      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    };

    initLocation();
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        'https://trashmap-api-presamordor-e0csfsedadffd9ey.canadacentral-01.azurewebsites.net/reports'
      );
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const normalizedReports = useMemo(() => {
    return (reports || [])
      .map((r) => ({
        ...r,
        id: String(r.id),
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
      }))
      .filter(
        (r) =>
          Number.isFinite(r.latitude) &&
          Number.isFinite(r.longitude)
      );
  }, [reports]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return '#ff3b30';
      case 'in_progress': return '#ff9500';
      case 'resolved': return '#34c759';
      default: return '#8e8e93';
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TrashMap</Text>
      </View>

      {/* MAP */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 19.4326,
          longitude: -99.1332,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
      >
        {normalizedReports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{
              latitude: report.latitude,
              longitude: report.longitude,
            }}
            pinColor={getStatusColor(report.status)}
          />
        ))}
      </MapView>

      {/* BOTÓN REPORTAR */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.reportButtonText}>＋</Text>
      </TouchableOpacity>

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Nuevo Reporte</Text>

          <AddReport
            onReportAdded={() => {
              fetchReports();
              setModalVisible(false);
            }}
          />

          {loading && <ActivityIndicator style={{ marginTop: 10 }} />}

          <FlatList
            data={normalizedReports}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.reportItem}>
                <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
                <Text style={{ color: getStatusColor(item.status) }}>
                  {item.status}
                </Text>
              </View>
            )}
          />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={{ color: '#fff' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#111',
    paddingTop: 50,
    paddingBottom: 15,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  reportButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: '#007AFF',
    width: 65,
    height: 65,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  reportButtonText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  reportItem: {
    padding: 12,
    marginVertical: 5,
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
  },
  closeButton: {
    backgroundColor: '#111',
    padding: 15,
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 20,
  },
});