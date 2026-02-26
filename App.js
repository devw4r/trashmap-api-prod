import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from "expo-location";
import axios from "axios";

import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";

// Recomendado por AuthSession para cerrar sesiones/popup correctamente
WebBrowser.maybeCompleteAuthSession();

const API =
  "https://trashmap-api-presamordor-e0csfsedadffd9ey.canadacentral-01.azurewebsites.net/reports"; // [1](https://solerainc-my.sharepoint.com/personal/esteban_salto_solera_com/Documents/Microsoft%20Copilot%20Chat%20Files/App%20%281%29.js)

/** ---------- Bottom Sheet Modal (Drop-off) ---------- */
function BottomSheet({ visible, onClose, title, children }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide" // slide desde abajo [2](https://reactnative.dev/docs/modal)
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* evita que el click dentro cierre */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sheetContent}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function App() {
  const mapRef = useRef(null);

  // ⚠️ IMPORTANTE: el scheme debe existir en app.json para builds (warning que viste) [3](https://docs.expo.dev/versions/latest/sdk/auth-session/)
  // Ajusta aquí el scheme para que coincida con tu app.json/app.config.js.
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "presawatch", // [1](https://solerainc-my.sharepoint.com/personal/esteban_salto_solera_com/Documents/Microsoft%20Copilot%20Chat%20Files/App%20%281%29.js)
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    // Para Expo Go normalmente necesitas expoClientId (Web app con redirect auth.expo.io)
    // expoClientId: "PEGA_TU_EXPO_CLIENT_ID",
    androidClientId:
      "890052014169-4672ttjupn05hhf92oh2l0cb2lnat1v9.apps.googleusercontent.com", // [1](https://solerainc-my.sharepoint.com/personal/esteban_salto_solera_com/Documents/Microsoft%20Copilot%20Chat%20Files/App%20%281%29.js)
    webClientId:
      "890052014169-bd5h39u45vk2g1d0a3uu3fcig7ut2er6.apps.googleusercontent.com", // [1](https://solerainc-my.sharepoint.com/personal/esteban_salto_solera_com/Documents/Microsoft%20Copilot%20Chat%20Files/App%20%281%29.js)
    responseType: "id_token",
    redirectUri,
  });

  const [user, setUser] = useState(null);

  const [reports, setReports] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [loadingReports, setLoadingReports] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // campos crear reporte
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStatus, setNewStatus] = useState("open");

  const region = useMemo(
    () => ({
      latitude: 19.4326,
      longitude: -101.253, // lo dejé como lo tenías; puedes ajustar a -99.1332 si quieres CDMX
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }),
    []
  );

  // auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      // si loguea, cerramos modal login
      if (currentUser) setShowLogin(false);
    });
    return unsubscribe;
  }, []);

  // Google response → Firebase credential
  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response?.params?.id_token;
      if (!idToken) {
        console.log("No id_token received");
        return;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      signInWithCredential(auth, credential).catch((err) => {
        console.log("Firebase error:", err);
        Alert.alert("Error", "No se pudo iniciar sesión con Firebase.");
      });
    }
  }, [response]);

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await axios.get(API);
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "No se pudieron cargar los reportes.");
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    const base =
      selectedStatus === "all"
        ? reports
        : reports.filter((r) => r.status === selectedStatus);

    return base
      .filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          !isNaN(Number(r.latitude)) &&
          !isNaN(Number(r.longitude))
      )
      .map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        id: String(r.id),
      }));
  }, [reports, selectedStatus]);

  const goToMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso requerido", "Activa permisos de ubicación.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        1000
      );
    } catch (e) {
      Alert.alert("Error", "No se pudo obtener tu ubicación.");
    }
  };

  const openCreateModal = () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    setShowCreate(true);
  };

  const createReport = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Falta título", "Escribe un título para el reporte.");
      return;
    }

    setCreating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso requerido", "Activa permisos de ubicación.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const payload = {
        title: newTitle.trim(),
        description: newDesc.trim(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        status: newStatus,
      };

      await axios.post(API, payload);

      // reset form
      setNewTitle("");
      setNewDesc("");
      setNewStatus("open");
      setShowCreate(false);

      // refresh list/markers
      fetchReports();
      Alert.alert("Listo", "Reporte creado correctamente.");
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "No se pudo crear el reporte.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* MAPA COMO FONDO (fix clave) */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        showsUserLocation
      >
        {filteredReports.map((r) => (
          <Marker
            key={r.id}
            coordinate={{ latitude: r.latitude, longitude: r.longitude }}
          >
            <Callout>
              <View style={{ maxWidth: 200 }}>
                <Text style={{ fontWeight: "bold" }}>{r.title}</Text>
                <Text>{r.status}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* OVERLAYS */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        {/* Caja usuario */}
        {user && (
          <View style={styles.userBox} pointerEvents="auto">
            <Text style={{ fontSize: 12 }} numberOfLines={1}>
              {user.displayName || user.email || "Usuario"}
            </Text>
            <TouchableOpacity onPress={() => signOut(auth)}>
              <Text style={{ color: "red", fontSize: 10 }}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Barra de filtros simple */}
        <View style={styles.filterRow} pointerEvents="auto">
          {["all", "open", "closed"].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.filterChip,
                selectedStatus === s && styles.filterChipActive,
              ]}
              onPress={() => setSelectedStatus(s)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedStatus === s && styles.filterTextActive,
                ]}
              >
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.refreshBtn} onPress={fetchReports}>
            <Text style={{ color: "white" }}>
              {loadingReports ? "..." : "↻"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* FAB Ubicación */}
        <TouchableOpacity style={styles.locBtn} onPress={goToMyLocation}>
          <Text style={{ color: "white", fontSize: 18 }}>📍</Text>
        </TouchableOpacity>

        {/* FAB Crear reporte */}
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <Text style={{ color: "white", fontSize: 22 }}>＋</Text>
        </TouchableOpacity>

        {/* FAB Login (si no hay user) */}
        {!user && (
          <TouchableOpacity style={styles.loginFab} onPress={() => setShowLogin(true)}>
            <Text style={{ color: "white" }}>Login</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* MODAL LOGIN (drop-off) */}
      <BottomSheet
        visible={showLogin}
        onClose={() => setShowLogin(false)}
        title="Iniciar sesión"
      >
        <Text style={styles.sheetHint}>
          Inicia sesión con Google para crear reportes.
        </Text>

        <TouchableOpacity
          disabled={!request}
          style={[styles.primaryBtn, !request && { opacity: 0.6 }]}
          onPress={() => promptAsync()}
        >
          <Text style={styles.primaryBtnText}>Continuar con Google</Text>
        </TouchableOpacity>

        <Text style={styles.sheetSmall}>
          Tip: para producción, asegúrate de configurar el scheme en app.json. [3](https://docs.expo.dev/versions/latest/sdk/auth-session/)
        </Text>
      </BottomSheet>

      {/* MODAL CREAR REPORTE (drop-off) */}
      <BottomSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        title="Crear reporte"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TextInput
            placeholder="Título"
            value={newTitle}
            onChangeText={setNewTitle}
            style={styles.input}
          />
          <TextInput
            placeholder="Descripción"
            value={newDesc}
            onChangeText={setNewDesc}
            style={[styles.input, { height: 90 }]}
            multiline
          />

          <Text style={styles.label}>Status</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {["open", "closed"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusPill,
                  newStatus === s && styles.statusPillActive,
                ]}
                onPress={() => setNewStatus(s)}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    newStatus === s && styles.statusPillTextActive,
                  ]}
                >
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 14 }]}
            onPress={createReport}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryBtnText}>Crear reporte (con mi ubicación)</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  userBox: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 50,
    backgroundColor: "white",
    padding: 8,
    borderRadius: 12,
    elevation: 6,
    maxWidth: 180,
  },

  filterRow: {
    position: "absolute",
    top: 40,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  filterChip: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },

  filterChipActive: {
    backgroundColor: "#0E7490",
    borderColor: "#0E7490",
  },

  filterText: {
    fontSize: 12,
    color: "#111",
  },

  filterTextActive: {
    color: "white",
    fontWeight: "700",
  },

  refreshBtn: {
    marginLeft: "auto",
    backgroundColor: "#111827",
    width: 38,
    height: 38,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },

  locBtn: {
    position: "absolute",
    bottom: 190,
    right: 20,
    backgroundColor: "#0E7490",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 7,
  },

  addBtn: {
    position: "absolute",
    bottom: 120,
    right: 20,
    backgroundColor: "#16A34A",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 7,
  },

  loginFab: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "#4285F4",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 26,
    elevation: 6,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },

  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 18,
  },

  sheetHeader: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginRight: 6,
  },

  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },

  sheetClose: {
    fontSize: 18,
    padding: 6,
    color: "#111827",
  },

  sheetContent: {
    paddingHorizontal: 16,
    gap: 10,
  },

  sheetHint: {
    color: "#374151",
  },

  sheetSmall: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 6,
  },

  primaryBtn: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtnText: {
    color: "white",
    fontWeight: "700",
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
  },

  label: {
    fontWeight: "700",
    color: "#111827",
    marginTop: 6,
  },

  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },

  statusPillActive: {
    backgroundColor: "#0E7490",
    borderColor: "#0E7490",
  },

  statusPillText: {
    color: "#111827",
    fontWeight: "600",
  },

  statusPillTextActive: {
    color: "white",
  },
});