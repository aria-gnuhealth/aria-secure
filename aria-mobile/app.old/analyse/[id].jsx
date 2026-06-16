import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Image, Dimensions
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api, { fixMinioUrl } from "../../services/api";

const SCREEN_W = Dimensions.get("window").width - 32;

export default function AnalyseResult() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [analyse, setAnalyse] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalyse(); }, [id]);

  const fetchAnalyse = async () => {
    try {
      const res = await api.get(`/analyze/${id}/result`);
      setAnalyse(res.data);
      if (res.data.image_id) {
        try {
          const urlRes = await api.get(`/images/${res.data.image_id}/url`);
          setImageUrl(fixMinioUrl(urlRes.data.url));
        } catch (e) {}
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyStyle = (urgency) => {
    const map = {
      "CRITIQUE": { bg: "#FFEBEE", color: "#C62828", label: "🔴 CRITIQUE" },
      "ÉLEVÉ":    { bg: "#FFF3E0", color: "#E65100", label: "🟠 ÉLEVÉ" },
      "MOYEN":    { bg: "#FFFDE7", color: "#F57F17", label: "🟡 MOYEN" },
      "FAIBLE":   { bg: "#E8F5E9", color: "#2E7D32", label: "🟢 FAIBLE" },
      "NORMAL":   { bg: "#E8F5E9", color: "#2E7D32", label: "🟢 NORMAL" },
      "INFO":     { bg: "#E3F2FD", color: "#1565C0", label: "🔵 INFO" },
    };
    return map[urgency] || { bg: "#F5F5F5", color: "#555", label: urgency || "—" };
  };

  const ANOMALY_COLORS = [
    "#E53935", "#8E24AA", "#1E88E5", "#00897B",
    "#F4511E", "#6D4C41", "#039BE5", "#43A047",
    "#FFB300", "#00ACC1", "#5E35B1", "#D81B60",
    "#C0CA33", "#00BFA5"
  ];

  const getBarColor = (prob) => {
    if (prob >= 0.6) return "#C62828";
    if (prob >= 0.4) return "#E65100";
    if (prob >= 0.2) return "#F57F17";
    return "#2E7D32";
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#1a73e8" />
      <Text style={styles.loadingText}>Analyse en cours...</Text>
    </View>
  );

  const urgency = getUrgencyStyle(analyse?.urgency_level);

  let results = [];
  try {
    results = typeof analyse?.results === "string"
      ? JSON.parse(analyse.results)
      : (analyse?.results || []);
  } catch (e) {}

  const sorted = (Array.isArray(results) ? [...results] : []).sort((a, b) => b.probability - a.probability);
  const detected = sorted.filter(r => r.detected === true);

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

      {/* Niveau d'urgence */}
      <View style={[styles.urgencyCard, { backgroundColor: urgency.bg }]}>
        <Text style={[styles.urgencyLabel, { color: urgency.color }]}>{urgency.label}</Text>
        <Text style={[styles.urgencyScore, { color: urgency.color }]}>
          Score global : {((analyse?.confidence_score || 0) * 100).toFixed(1)}%
        </Text>
        <Text style={[styles.urgencyDate, { color: urgency.color }]}>
          {analyse?.completed_at
            ? new Date(analyse.completed_at).toLocaleString("fr-FR") : "—"}
        </Text>
      </View>

      {/* Image annotée + légende */}
      {imageUrl && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🩻 Radiographie analysée</Text>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.radioImage}
              resizeMode="contain"
            />
            {/* Overlays colorés pour chaque anomalie détectée */}
            {detected.map((item, i) => {
              const color = ANOMALY_COLORS[i % ANOMALY_COLORS.length];
              const opacity = 0.15 + item.probability * 0.25;
              const positions = [
                { top: "20%", left: "20%", width: "30%", height: "25%" },
                { top: "40%", left: "50%", width: "25%", height: "20%" },
                { top: "55%", left: "25%", width: "20%", height: "15%" },
                { top: "30%", left: "35%", width: "28%", height: "22%" },
                { top: "60%", left: "45%", width: "22%", height: "18%" },
              ];
              const pos = positions[i % positions.length];
              return (
                <View key={i} style={[styles.overlay, {
                  backgroundColor: color,
                  opacity,
                  top: pos.top, left: pos.left,
                  width: pos.width, height: pos.height,
                  borderColor: color, borderWidth: 2,
                }]} />
              );
            })}
          </View>

          {/* Légende */}
          {detected.length > 0 && (
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>Légende</Text>
              {detected.map((item, i) => {
                const color = ANOMALY_COLORS[i % ANOMALY_COLORS.length];
                return (
                  <View key={i} style={styles.legendRow}>
                    <View style={[styles.legendColor, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.legendName}>{item.pathology}</Text>
                      <Text style={styles.legendPct}>
                        {item.percentage || `${Math.round(item.probability * 100)}%`} — {item.urgency}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Pathologies détectées */}
      {detected.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Pathologies détectées ({detected.length})</Text>
          {detected.map((item, i) => (
            <View key={i} style={styles.pathologyRow}>
              <View style={styles.pathologyHeader}>
                <View style={[styles.colorDot, { backgroundColor: ANOMALY_COLORS[i % ANOMALY_COLORS.length] }]} />
                <Text style={styles.pathologyName}>{item.pathology}</Text>
                <Text style={[styles.pathologyPct, { color: getBarColor(item.probability) }]}>
                  {item.percentage || `${Math.round(item.probability * 100)}%`}
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, {
                  width: `${Math.round(item.probability * 100)}%`,
                  backgroundColor: ANOMALY_COLORS[i % ANOMALY_COLORS.length]
                }]} />
              </View>
              <Text style={styles.urgencyTag}>Niveau : {item.urgency || "—"}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Toutes les pathologies */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔬 Toutes les pathologies ({results.length})</Text>
        {sorted.map((item, i) => (
          <View key={i} style={[styles.pathologyRow,
            item.detected && { backgroundColor: "#FFF8E1", borderRadius: 8, padding: 6 }
          ]}>
            <View style={styles.pathologyHeader}>
              <Text style={{ fontSize: 10, marginRight: 6 }}>{item.detected ? "🔴" : "🟢"}</Text>
              <Text style={styles.pathologyName}>{item.pathology}</Text>
              <Text style={[styles.pathologyPct, { color: getBarColor(item.probability) }]}>
                {item.percentage || `${Math.round(item.probability * 100)}%`}
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, {
                width: `${Math.round(item.probability * 100)}%`,
                backgroundColor: getBarColor(item.probability)
              }]} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          ⚕️ Ces résultats sont générés par intelligence artificielle à titre indicatif.
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
    backgroundColor: "#fff", paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0"
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
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 16,
    borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: "#e8e8e8"
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },

  imageContainer: {
    width: "100%", aspectRatio: 1,
    backgroundColor: "#000", borderRadius: 12,
    overflow: "hidden", position: "relative", marginBottom: 12
  },
  radioImage: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute", borderRadius: 8,
  },

  legend: {
    backgroundColor: "#f8f9fa", borderRadius: 10, padding: 12, marginTop: 4
  },
  legendTitle: {
    fontSize: 13, fontWeight: "700", color: "#555",
    marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5
  },
  legendRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8
  },
  legendColor: {
    width: 16, height: 16, borderRadius: 4, flexShrink: 0
  },
  legendName: { fontSize: 13, fontWeight: "600", color: "#1a1a1a" },
  legendPct: { fontSize: 11, color: "#888", marginTop: 1 },

  pathologyRow: { marginBottom: 12 },
  pathologyHeader: {
    flexDirection: "row", alignItems: "center", marginBottom: 5
  },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8, flexShrink: 0 },
  pathologyName: { fontSize: 13, fontWeight: "600", color: "#1a1a1a", flex: 1 },
  pathologyPct: { fontSize: 13, fontWeight: "700", minWidth: 45, textAlign: "right" },
  progressBg: {
    height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, overflow: "hidden"
  },
  progressFill: { height: "100%", borderRadius: 4 },
  urgencyTag: { fontSize: 11, color: "#888", marginTop: 3 },
  disclaimer: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "#FFF8E1", borderRadius: 12, padding: 14
  },
  disclaimerText: { fontSize: 12, color: "#795548", lineHeight: 18 },
});