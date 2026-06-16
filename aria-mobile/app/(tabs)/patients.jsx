import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Alert
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";

export default function PatientsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await api.get("/patients?page=1&per_page=50");
      setPatients(response.data.items || response.data || []);
    } catch (error) {
      console.log("Erreur chargement patients:", error);
      Alert.alert("Erreur", "Impossible de charger les patients");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const searchPatients = async (query) => {
    setSearch(query);
    if (query.length < 2) {
      fetchPatients();
      return;
    }
    try {
      const response = await api.get(`/patients/search?q=${query}`);
      setPatients(response.data || []);
    } catch (error) {
      console.log("Erreur recherche:", error);
    }
  };

  const getInitials = (first, last) =>
    `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const renderPatient = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/patient/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {getInitials(item.first_name, item.last_name)}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>
          {item.first_name} {item.last_name}
        </Text>
        <Text style={styles.cardSub}>
          Dossier #{item.medical_record_number || "—"}
        </Text>
        <Text style={styles.cardSub}>
          {item.date_of_birth
            ? new Date(item.date_of_birth).toLocaleDateString("fr-FR")
            : "Date non renseignée"}
        </Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Patients</Text>
          <Text style={styles.headerSub}>{patients.length} patient(s)</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role || "User"}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un patient..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={searchPatients}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => searchPatients("")}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        renderItem={renderPatient}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPatients();
            }}
            colors={["#1a73e8"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyText}>Aucun patient</Text>
            <Text style={styles.emptySub}>
              {search ? "Aucun résultat pour cette recherche" : "Tirez pour actualiser"}
            </Text>
          </View>
        }
        contentContainerStyle={patients.length === 0 && styles.emptyContainer}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/patient/new")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#1a1a1a" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  roleBadge: {
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: { fontSize: 12, fontWeight: "600", color: "#1a73e8" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: "#333" },
  clearSearch: { fontSize: 16, color: "#999", padding: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#e8e8e8",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#e8f0fe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#1a73e8" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", marginBottom: 3 },
  cardSub: { fontSize: 12, color: "#888", marginTop: 1 },
  arrow: { fontSize: 22, color: "#ccc", fontWeight: "300" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyContainer: { flexGrow: 1 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#555" },
  emptySub: { fontSize: 13, color: "#999", marginTop: 4 },
  fab: {
    position: "absolute",
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: "#fff", lineHeight: 32 },
});
