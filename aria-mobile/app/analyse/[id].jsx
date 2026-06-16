import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../services/api";

export default function AnalyseResult() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [analyse, setAnalyse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchAnalyse();
  }, [id]);

  const fetchAnalyse = async () => {
    try {
      const res = await api.get(`/analyze/${id}/result`);
      setAnalyse(res.data);
    } catch (error) {
      console.log("Erreur chargement analyse:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyStyle = (urgency) => {
    const map = {
      "CRITIQUE": { bg: "#FFEBEE", color: "#C62828", label: "🔴 CRITIQUE" },
      "ÉLEVÉ": { bg: "#FFF3E0", color: "#E65100", label: "🟠 ÉLEVÉ" },
      "MOYEN": { bg: "#FFFDE7", color: "#F57F17", label: "🟡 MOYEN" },
      "FAIBLE": { bg: "#E8F5E9", color: "#2E7D32", label: "🟢 FAIBLE" },
      "NORMAL": { bg: "#E8F5E9", color: "#2E7D32", label: "🟢 NORMAL" },
    };
    return map[urgency] || { bg: "#F5F5F5", color: "#555", label: urgency || "—" };
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Chargement des résultats...</Text>
      </View>
    );
  }

  if (!analyse) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 18, color: "#555" }}>Aucun résultat</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#1a73e8", marginTop: 16 }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const urgency = getUrgencyStyle(analyse?.urgency_level);
  let results = [];
  try {
    results = typeof analyse?.results === "string"
      ? JSON.parse(analyse.results)
      : (analyse?.results || []);
  } catch (e) {}

  const detected = results.filter(r => r.detected);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Résultat IA</Text>
        <Text style={styles.headerSub}>
          {analyse?.model?.name || "CheXpert"} v{analyse?.model?.version || "1.0"}
        </Text>
      </View>

      <View style={[styles.urgencyCard, { backgroundColor: urgency.bg }]}>
        <Text style={[styles.urgencyLabel, { color: urgency.color }]}>{urgency.label}</Text>
        <Text style={[styles.urgencyScore, { color: urgency.color }]}>
          Score : {((analyse?.confidence_score || 0) * 100).toFixed(1)}%
        </Text>
        <Text style={[styles.urgencyDate, { color: urgency.color }]}>
          {analyse?.completed_at
            ? new Date(analyse.completed_at).toLocaleString("fr-FR")
            : "—"}
        </Text>
      </View>

      {detected.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Anomalies détectées ({detected.length})</Text>
          {detected.map((item, i) => (
            <View key={i} style={styles.findingCard}>
              <View style={styles.findingHeader}>
                <Text style={styles.findingName}>{item.pathology}</Text>
                <Text style={[styles.findingBadge, { backgroundColor: (item.color || "#F57F17") + "30" }]}>
                  <Text style={[styles.findingBadgeText, { color: item.color || "#F57F17" }]}>
                    {item.urgency || "MOYEN"}
                  </Text>
                </Text>
              </View>
              <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, {
                    width: item.percentage || `${Math.round((item.probability || 0) * 100)}%`,
                    backgroundColor: item.color || "#F57F17"
                  }]} />
                </View>
                <Text style={styles.progressText}>
                  {item.percentage || `${Math.round((item.probability || 0) * 100)}%`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.section, { alignItems: "center", paddingVertical: 24 }]}>
          <Text style={{ fontSize: 40 }}>✅</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#2e7d32" }}>
            Aucune anomalie détectée
          </Text>
        </View>
      )}

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          ⚕️ Ces résultats sont générés par IA à titre indicatif.
          Ils ne remplacent pas le diagnostic d'un médecin qualifié.
        </Text>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 16, color: "#1a73e8" },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  urgencyCard: { margin: 16, borderRadius: 16, padding: 20 },
  urgencyLabel: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  urgencyScore: { fontSize: 15, fontWeight: "500", marginBottom: 4 },
  urgencyDate: { fontSize: 13 },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "#e8e8e8",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  findingCard: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 10,
  },
  findingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  findingName: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  findingBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  findingBadgeText: { fontSize: 11, fontWeight: "600" },
  progressContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  progressText: { fontSize: 12, color: "#666", width: 45, textAlign: "right" },
  disclaimer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    padding: 14,
  },
  disclaimerText: { fontSize: 12, color: "#795548", lineHeight: 18 },
});
