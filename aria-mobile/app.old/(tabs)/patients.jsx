import { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput, RefreshControl
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../services/api";

export default function PatientsScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadUser();
    fetchPatients();
  }, []);

  const loadUser = async () => {
    const u = await AsyncStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
  };

  const fetchPatients = async (p = 1) => {
    try {
      const res = await api.get(`/patients?page=${p}&per_page=20`);
      setPatients(res.data.items);
      setTotal(res.data.total);
      setPage(p);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const searchPatients = async (q) => {
    setSearch(q);
    if (q.length < 2) {
      fetchPatients();
      return;
    }
    try {
      const res = await api.get(`/patients/search?q=${q}`);
      setPatients(res.data);
    } catch (e) {
      console.log(e);
    }
  };

  const getInitials = (first, last) =>
    `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const getRoleColor = (role) => {
    const colors = {
      user: "#1a73e8", radiologist: "#9c27b0",
      nurse: "#00897b", admin: "#e65100", auditor: "#546e7a"
    };
    return colors[role] || "#666";
  };

  const renderPatient = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/patient/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: "#e8f0fe" }]}>
        <Text style={styles.avatarText}>
          {getInitials(item.first_name, item.last_name)}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.first_name} {item.last_name}</Text>
        <Text style={styles.cardSub}>Dossier #{item.medical_record_number || "—"}</Text>
        <Text style={styles.cardSub}>
          {item.date_of_birth ? `Né(e) le ${new Date(item.date_of_birth).toLocaleDateString("fr-FR")}` : "Date de naissance non renseignée"}
        </Text>
      </View>
      <View style={styles.cardArrow}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Chargement des patients...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Patients</Text>
          <Text style={styles.headerSub}>{total} patient{total > 1 ? "s" : ""} au total</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user?.role) + "20" }]}>
          <Text style={[styles.roleText, { color: getRoleColor(user?.role) }]}>
            {user?.role || "—"}
          </Text>
        </View>
      </View>

      {/* Recherche */}
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

      {/* Liste */}
      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        renderItem={renderPatient}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchPatients();
          }} colors={["#1a73e8"]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyText}>Aucun patient trouvé</Text>
            <Text style={styles.emptySub}>Tirez vers le bas pour actualiser</Text>
          </View>
        }
        contentContainerStyle={patients.length === 0 && styles.emptyContainer}
      />

      {/* Bouton ajouter */}
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f9fa" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0"
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#1a1a1a" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },

  searchContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", margin: 16, borderRadius: 12,
    paddingHorizontal: 14, borderWidth: 0.5, borderColor: "#e0e0e0"
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: "#333" },
  clearSearch: { fontSize: 16, color: "#999", padding: 4 },

  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: "#e8e8e8"
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: "center", alignItems: "center", marginRight: 14
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#1a73e8" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", marginBottom: 3 },
  cardSub: { fontSize: 12, color: "#888", marginTop: 1 },
  cardArrow: { paddingLeft: 8 },
  arrowText: { fontSize: 22, color: "#ccc", fontWeight: "300" },

  empty: { alignItems: "center", paddingTop: 60 },
  emptyContainer: { flexGrow: 1 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#555" },
  emptySub: { fontSize: 13, color: "#999", marginTop: 4 },

  fab: {
    position: "absolute", bottom: 28, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#1a73e8", justifyContent: "center", alignItems: "center",
    elevation: 6
  },
  fabText: { fontSize: 28, color: "#fff", lineHeight: 32 },
});
