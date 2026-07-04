import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView, FlatList
} from "react-native";
import { useRouter } from "expo-router";
import api from "../../services/api";
import { colors, shadows, radius } from "../../constants/theme";
import { useSettings } from "../../contexts/SettingsContext";

export default function NewDiscussionScreen() {
  const router = useRouter();
  const { theme, baseFontSize, t } = useSettings();
  const [radiologists, setRadiologists] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [selectedRadiologist, setSelectedRadiologist] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submittedAnalysisIds, setSubmittedAnalysisIds] = useState([]);

  useEffect(() => {
    fetchRadiologists();
    fetchRecentAnalyses();
    fetchSubmittedAnalyses();
  }, []);

  const fetchRadiologists = async () => {
    try {
      const res = await api.get("/auth/users");
      const radiologistList = (res.data || []).filter(u => u.role === "radiologist");
      setRadiologists(radiologistList);
    } catch (e) {
      console.log("Erreur radiologues:", e.message);
    }
  };

  const fetchSubmittedAnalyses = async () => {
    try {
      const res = await api.get("/chat/discussions");
      const discussions = res.data.discussions || res.data || [];
      const ids = discussions
        .filter(d => d.analysis_id && d.status !== "closed")
        .map(d => String(d.analysis_id));
      setSubmittedAnalysisIds(ids);
    } catch (e) {
      console.log("Erreur discussions:", e.message);
    }
  };

  const fetchRecentAnalyses = async () => {
    try {
      const patientsRes = await api.get("/patients?page=1&per_page=50");
      const patients = patientsRes.data.items || patientsRes.data || [];
      
      // Récupérer les analyses récentes
      let allAnalyses = [];
      for (const patient of patients.slice(0, 10)) {
        try {
          const imagesRes = await api.get(`/patients/${patient.id}/images`);
          const images = imagesRes.data.items || imagesRes.data || [];
          for (const img of images.slice(0, 3)) {
            try {
              const analysesRes = await api.get(`/analyze/image/${img.id}/analyses`);
              const imgAnalyses = analysesRes.data?.analyses || [];
              for (const a of imgAnalyses) {
                allAnalyses.push({
                  ...a,
                  patient_name: `${patient.first_name} ${patient.last_name}`,
                  body_part: img.body_part,
                });
              }
            } catch (e) {}
          }
        } catch (e) {}
      }
      setAnalyses(allAnalyses.slice(0, 20));
    } catch (e) {
      console.log("Erreur analyses:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedRadiologist) {
      Alert.alert("Erreur", "Sélectionnez un radiologue");
      return;
    }
    if (!selectedAnalysis) {
      Alert.alert("Erreur", "Sélectionnez une analyse à soumettre");
      return;
    }
    setSending(true);
    try {
      const res = await api.post("/chat/discussions", {
        analysis_id: selectedAnalysis.analysis_id,
        radiologist_id: selectedRadiologist.id,
        message: message.trim() || undefined,
      });
      router.replace(`/chat/${res.data.id}`);
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de créer la consultation");
    } finally {
      setSending(false);
    }
  };

  const getBodyPartLabel = (bp) =>
    bp === "chest" ? "Thorax" : bp === "bone" ? "Os/Fracture" : "Autre";

  const getUrgencyColor = (urgency) => ({
    CRITIQUE: colors.critical,
    ÉLEVÉ: colors.high,
    MOYEN: "#B7950B",
    NORMAL: colors.normal,
  })[urgency] || colors.textMuted;

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Chargement...</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar backgroundColor={colors.primaryDark} barStyle="light-content" />
      <View style={[styles.container, { backgroundColor: theme?.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouvelle consultation</Text>
          <Text style={styles.headerSub}>Soumettre une analyse à un radiologue</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>

          {/* Choisir le radiologue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Choisir un radiologue</Text>
            {radiologists.length === 0 ? (
              <Text style={styles.emptyText}>Aucun radiologue disponible</Text>
            ) : (
              radiologists.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.selectCard, selectedRadiologist?.id === r.id && styles.selectCardActive]}
                  onPress={() => setSelectedRadiologist(r)}
                >
                  <View style={styles.selectAvatar}>
                    <Text style={styles.selectAvatarText}>
                      {(r.first_name?.[0] || "R").toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.selectInfo}>
                    <Text style={styles.selectName}>{r.first_name} {r.last_name}</Text>
                    <Text style={styles.selectSub}>{r.email}</Text>
                  </View>
                  {selectedRadiologist?.id === r.id && (
                    <Text style={styles.checkIcon}>✅</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Choisir l'analyse */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Choisir une analyse</Text>
            {analyses.length === 0 ? (
              <Text style={styles.emptyText}>
                {analyses.filter(a => !submittedAnalysisIds.includes(String(a.analysis_id))).length === 0 && analyses.length > 0
                  ? "Toutes vos analyses ont déjà été soumises à un radiologue."
                  : "Aucune analyse disponible. Lancez d'abord une analyse IA."}
              </Text>
            ) : (
              analyses
                .filter(a => !submittedAnalysisIds.includes(String(a.analysis_id)))
                .map(a => (
                <TouchableOpacity
                  key={a.analysis_id}
                  style={[styles.selectCard, selectedAnalysis?.analysis_id === a.analysis_id && styles.selectCardActive]}
                  onPress={() => setSelectedAnalysis(a)}
                >
                  <View style={[styles.selectAvatar, { backgroundColor: colors.primaryBg }]}>
                    <Text style={styles.selectAvatarText}>🔬</Text>
                  </View>
                  <View style={styles.selectInfo}>
                    <Text style={styles.selectName}>{a.patient_name}</Text>
                    <Text style={styles.selectSub}>
                      {getBodyPartLabel(a.body_part)} · {a.model_name}
                    </Text>
                    {a.urgency_level && (
                      <Text style={[styles.urgencyTag, { color: getUrgencyColor(a.urgency_level) }]}>
                        {a.urgency_level}
                      </Text>
                    )}
                  </View>
                  {selectedAnalysis?.analysis_id === a.analysis_id && (
                    <Text style={styles.checkIcon}>✅</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Message initial */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Message (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Décrivez le cas clinique, vos questions..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              maxLength={1000}
            />
          </View>

          <TouchableOpacity
            style={[styles.createBtn, sending && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.createBtnText}>Envoyer la consultation →</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: colors.textSecondary },

  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 16 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  content: { padding: 16 },

  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 16,
    marginBottom: 16, ...shadows.small,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: "700", color: colors.textPrimary,
    marginBottom: 12,
  },
  emptyText: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },

  selectCard: {
    flexDirection: "row", alignItems: "center",
    padding: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: 8, gap: 12,
  },
  selectCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  selectAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryBg,
    justifyContent: "center", alignItems: "center",
  },
  selectAvatarText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  selectInfo: { flex: 1 },
  selectName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  selectSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  urgencyTag: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  checkIcon: { fontSize: 18 },

  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, padding: 12,
    fontSize: 15, color: colors.textPrimary,
  },
  inputMulti: { height: 100, textAlignVertical: "top" },

  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg, padding: 16,
    alignItems: "center", ...shadows.medium,
  },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
