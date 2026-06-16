import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl
} from "react-native";
import api from "../../services/api";

export default function DashboardScreen() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get("/patients/stats/summary");
      setStats(res.data);
    } catch (error) {
      console.log("Erreur stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tableau de bord</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: "#e3f2fd" }]}>
          <Text style={[styles.statNumber, { color: "#1565c0" }]}>
            {stats?.total_patients || 0}
          </Text>
          <Text style={styles.statLabel}>Patients</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: "#e8f5e9" }]}>
          <Text style={[styles.statNumber, { color: "#2e7d32" }]}>
            {stats?.total_analyses || 0}
          </Text>
          <Text style={styles.statLabel}>Analyses</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: "#fff3e0" }]}>
          <Text style={[styles.statNumber, { color: "#e65100" }]}>
            {stats?.critical_analyses || 0}
          </Text>
          <Text style={styles.statLabel}>Critiques</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: "#fce4ec" }]}>
          <Text style={[styles.statNumber, { color: "#c62828" }]}>
            {stats?.pending_analyses || 0}
          </Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#1a1a1a" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: "47%",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  statNumber: { fontSize: 32, fontWeight: "700" },
  statLabel: { fontSize: 14, color: "#555", marginTop: 4 },
});
