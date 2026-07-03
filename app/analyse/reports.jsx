import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../services/api";

export default function AnalysisReports() {
  const router = useRouter();
  const { analysis_id } = useLocalSearchParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  console.log("🔍 Analysis ID reçu :", analysis_id);

  useEffect(() => {
    if (analysis_id) {
      fetchReports();
    } else {
      setError("ID d'analyse manquant");
      setLoading(false);
    }
  }, [analysis_id]);

  const fetchReports = async () => {
    try {
      const url = `/reports/analysis/${analysis_id}/reports`;
      console.log("📡 Appel API :", url);
      const res = await api.get(url);
      console.log("📦 Réponse :", JSON.stringify(res.data, null, 2));
      setReports(res.data.reports || []);
    } catch (error) {
      console.log("❌ Erreur chargement rapports:", error);
      setError(error.response?.data?.detail || error.message);
      Alert.alert("Erreur", "Impossible de charger les rapports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteReport = async (reportId) => {
    Alert.alert("Supprimer", "Supprimer ce rapport ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/reports/${reportId}`);
            fetchReports();
          } catch (error) {
            Alert.alert("Erreur", "Impossible de supprimer");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: "red", fontSize: 16 }}>❌ {error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: "#1a73e8", fontSize: 16 }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchReports} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📄 Rapports disponibles</Text>
        <Text style={styles.headerSub}>{reports.length} rapport(s)</Text>
      </View>

      {reports.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📄</Text>
          <Text style={styles.emptyText}>Aucun rapport</Text>
          <Text style={styles.emptySub}>Générez un rapport depuis le dossier patient</Text>
        </View>
      ) : (
        reports.map((report) => (
          <View key={report.id} style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>📄 Rapport #{report.id.slice(0, 8)}</Text>
              <Text style={styles.cardDate}>
                Généré le {new Date(report.generated_at).toLocaleString("fr-FR")}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => router.push(`/analyse/report/${report.id}`)}
              >
                <Text style={styles.downloadBtnText}>⬇️ Télécharger</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteReport(report.id)}
              >
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
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
  backText: { fontSize: 16, color: "#1a73e8", marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#555" },
  emptySub: { fontSize: 13, color: "#999", marginTop: 4 },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#e8e8e8",
  },
  cardInfo: { marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  cardDate: { fontSize: 12, color: "#888", marginTop: 4 },
  actions: { flexDirection: "row", gap: 8 },
  downloadBtn: {
    flex: 1,
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  downloadBtnText: { color: "#1565c0", fontSize: 13, fontWeight: "600" },
  deleteBtn: {
    backgroundColor: "#ffebee",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    width: 50,
  },
  deleteBtnText: { color: "#c62828", fontSize: 16 },
});
