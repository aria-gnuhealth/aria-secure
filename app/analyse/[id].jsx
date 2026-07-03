import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, StatusBar, Modal, TextInput, Alert
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../services/api";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "../../contexts/AuthContext";
import { colors, shadows, radius } from "../../constants/theme";
import { useSettings } from "../../contexts/SettingsContext";

export default function AnalyseResult() {
  const router = useRouter();
  const { theme, baseFontSize, t } = useSettings();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [analyse, setAnalyse] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [sendingToRadio, setSendingToRadio] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");

  const handleWsMessage = useCallback((data) => {
    if (["analysis_validated", "analysis_rejected"].includes(data.type) && data.analysis_id === id) {
      fetchFeedback(id);
    }
  }, [id]);
  useWebSocket(handleWsMessage);

  useEffect(() => {
    if (id) {
      fetchAnalyse(id);
      fetchFeedback(id);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    if (id) {
      fetchAnalyse(id);
      fetchFeedback(id);
    }
  }, [id]));

  const fetchFeedback = async (analysisId) => {
    try {
      const res = await api.get(`/analyze/${analysisId}/feedback`);
      setFeedback(res.data);
      if (res.data.clinical_feedback) {
        setFeedbackText(res.data.clinical_feedback);
      }
    } catch (e) {
      console.log("Erreur feedback:", e.message);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert("Erreur", "Le feedback ne peut pas être vide");
      return;
    }
    setSubmittingFeedback(true);
    try {
      await api.post(`/analyze/${id}/feedback`, { feedback: feedbackText.trim() });
      Alert.alert("✅ Validé", "Feedback clinique enregistré avec succès");
      setShowFeedbackModal(false);
      fetchFeedback(id);
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible d'enregistrer le feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const fetchAnalyse = async (analysisId) => {
    try {
      const res = await api.get(`/analyze/${analysisId}/result`);
      setAnalyse(res.data);
      if (res.data.heatmap_url) {
        setHeatmapUrl(res.data.heatmap_url);
      }
      if (res.data.image_id) {
        try {
          const urlRes = await api.get(`/images/${res.data.image_id}/url`);
          setImageUrl(urlRes.data.url);
        } catch (e) {}
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendToRadiologist = async () => {
    setSendingToRadio(true);
    try {
      const radioRes = await api.get("/auth/users", { params: { role: "radiologist", is_active: true } });
      const radiologists = radioRes.data?.items || radioRes.data || [];
      console.log("RADIOLOGISTS:", JSON.stringify(radiologists?.length));
      if (!radiologists || radiologists.length === 0) {
        Alert.alert("Aucun radiologue", "Aucun radiologue disponible pour le moment.");
        return;
      }
      // Afficher la liste des radiologues
      const buttons = radiologists.slice(0, 5).map(r => ({
        text: `${r.first_name || r.firstName} ${r.last_name || r.lastName}`,
        onPress: async () => {
          try {
            await api.post("/chat/discussions", {
              radiologist_id: r.id,
              analysis_id: id,
              message: "Bonjour, je vous soumets cette analyse pour validation clinique."
            });
            Alert.alert("✅ Envoyé", `L'analyse a été envoyée à ${r.first_name || r.firstName} ${r.last_name || r.lastName}.`);
          } catch (e) {
            Alert.alert("Erreur", e.response?.data?.detail || e.message);
          }
        }
      }));
      buttons.push({ text: "Annuler", style: "cancel" });
      Alert.alert("Choisir un radiologue", "Sélectionnez le radiologue à qui envoyer cette analyse :", buttons);
    } catch (e) {
      console.log("RADIO ERROR:", e.response?.data, e.message);
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de charger les radiologues: " + e.message);
    } finally {
      setSendingToRadio(false);
    }
  };

  const downloadReport = async () => {
    setGeneratingReport(true);
    try {
      // Générer le rapport
      const res = await api.post(`/reports/analysis/${id}`);
      const reportId = res.data?.report_id;
      if (!reportId) throw new Error("Rapport non généré");
      
      // Obtenir l'URL signée
      const urlRes = await api.get(`/reports/${reportId}/signed-url`);
      const signedUrl = urlRes.data?.url;
      if (!signedUrl) throw new Error("URL non disponible");

      // Télécharger le PDF localement
      const localPath = FileSystem.documentDirectory + `rapport_aria_${reportId}.pdf`;
      const download = await FileSystem.downloadAsync(signedUrl, localPath);
      
      if (download.status === 200) {
        const reportViewerUrl = `https://reports.aria-web.site?url=${encodeURIComponent(signedUrl)}`;
        Alert.alert(
          "Rapport PDF",
          "Que souhaitez-vous faire ?",
          [
            {
              text: "Visualiser",
              onPress: async () => {
                const WebBrowser = require("expo-web-browser");
                await WebBrowser.openBrowserAsync(reportViewerUrl);
              }
            },
            {
              text: "Partager",
              onPress: async () => {
                await Sharing.shareAsync(download.uri, {
                  mimeType: "application/pdf",
                  dialogTitle: "Rapport ARIA Medical",
                  UTI: "com.adobe.pdf"
                });
              }
            },
            { text: "Annuler", style: "cancel" }
          ]
        );
      }
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de générer le rapport: " + e.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const validateAnalysis = async () => {
    try {
      await api.post(`/radiologist/validate/${id}`, { feedback: feedbackText || "Analyse validée." });
      Alert.alert("✅ Validé", "L'analyse a été validée. Le médecin sera notifié.");
      fetchFeedback(id);
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de valider");
    }
  };

  const rejectAnalysis = async () => {
    if (!rejectMotif.trim()) {
      Alert.alert("Erreur", "Veuillez saisir un motif de rejet");
      return;
    }
    try {
      await api.post(`/radiologist/reject/${id}?reason=${encodeURIComponent(rejectMotif)}`);
      Alert.alert("❌ Rejeté", "L'analyse a été rejetée. Le médecin sera notifié.");
      setShowRejectModal(false);
      fetchFeedback(id);
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de rejeter");
    }
  };

  const getUrgencyStyle = (urgency) => {
    const map = {
      "CRITIQUE": { bg: colors.criticalBg, color: colors.critical, label: "🔴 CRITIQUE", border: colors.critical },
      "ÉLEVÉ":    { bg: colors.highBg, color: colors.high, label: "🟠 ÉLEVÉ", border: colors.high },
      "MOYEN":    { bg: colors.mediumBg, color: "#B7950B", label: "🟡 MOYEN", border: colors.medium },
      "FAIBLE":   { bg: colors.normalBg, color: colors.normal, label: "🟢 FAIBLE", border: colors.normal },
      "NORMAL":   { bg: colors.normalBg, color: colors.normal, label: "🟢 NORMAL", border: colors.normal },
      "INFO":     { bg: colors.infoBg, color: colors.info, label: "🔵 INFO", border: colors.info },
    };
    return map[urgency] || { bg: colors.surfaceSecondary, color: colors.textSecondary, label: urgency || "—", border: colors.border };
  };

  const ANOMALY_COLORS = [
    "#E74C3C", "#8B5CF6", "#1F6B9E", "#27AE60",
    "#E67E22", "#8B4513", "#039BE5", "#43A047",
    "#FFB300", "#00ACC1", "#5E35B1", "#D81B60",
  ];

  const getBarColor = (prob) => {
    if (prob >= 0.6) return colors.critical;
    if (prob >= 0.4) return colors.high;
    if (prob >= 0.2) return "#B7950B";
    return colors.normal;
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Analyse en cours...</Text>
    </View>
  );

  if (error) return (
    <View style={styles.centered}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
        <Text style={styles.retryBtnText}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const urgency = getUrgencyStyle(analyse?.urgency_level);

  // Détecter le type de résultat (CheXpert = tableau, MURA = objet)
  let results = [];
  let muraResult = null;
  try {
    const raw = typeof analyse?.results === "string"
      ? JSON.parse(analyse.results)
      : (analyse?.results || []);
    if (Array.isArray(raw)) {
      results = raw;
    } else if (raw && typeof raw === "object") {
      muraResult = raw; // Format MURA
    }
  } catch (e) {}

  const sorted = [...results].sort((a, b) => b.probability - a.probability);
  const detected = sorted.filter(r => r.detected === true);

  return (
    <View style={[styles.container, { backgroundColor: theme?.bg }]}>
      <StatusBar backgroundColor={colors.primaryDark} barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
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
        <View style={[styles.urgencyCard, { backgroundColor: urgency.bg, borderLeftColor: urgency.border }]}>
          <View style={styles.urgencyRow}>
            <Text style={[styles.urgencyLabel, { color: urgency.color }]}>{urgency.label}</Text>
            <Text style={[styles.urgencyScore, { color: urgency.color }]}>
              {((analyse?.confidence_score || 0) * 100).toFixed(1)}%
            </Text>
          </View>
          <Text style={[styles.urgencyDate, { color: urgency.color }]}>
            {analyse?.completed_at
              ? new Date(analyse.completed_at).toLocaleString("fr-FR") : "—"}
          </Text>
        </View>

        {/* Image annotée */}
        {imageUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🩻 Radiographie analysée</Text>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.radioImage}
                resizeMode="contain"
              />
              {/* Overlays CheXpert */}
              {detected.map((item, i) => {
                const color = ANOMALY_COLORS[i % ANOMALY_COLORS.length];
                const positions = [
                  { top: "20%", left: "20%", width: "30%", height: "25%" },
                  { top: "40%", left: "50%", width: "25%", height: "20%" },
                  { top: "55%", left: "25%", width: "20%", height: "15%" },
                  { top: "30%", left: "35%", width: "28%", height: "22%" },
                ];
                const pos = positions[i % positions.length];
                return (
                  <View key={i} style={[styles.overlay, {
                    backgroundColor: color,
                    opacity: 0.15 + item.probability * 0.2,
                    borderColor: color,
                    borderWidth: 2,
                    top: pos.top, left: pos.left,
                    width: pos.width, height: pos.height,
                  }]} />
                );
              })}
              {/* Overlay MURA - image annotée backend */}
              {muraResult && heatmapUrl && (
                <Image
                  source={{ uri: heatmapUrl }}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              )}
            </View>

            {/* Légende CheXpert */}
            {detected.length > 0 && (
              <View style={styles.legend}>
                <Text style={styles.legendTitle}>Légende</Text>
                {detected.map((item, i) => (
                  <View key={i} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: ANOMALY_COLORS[i % ANOMALY_COLORS.length] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.legendName}>{item.pathology}</Text>
                      <Text style={styles.legendPct}>
                        {item.percentage || `${Math.round(item.probability * 100)}%`} · {item.urgency || "—"}
                      </Text>
                    </View>
                  </View>
                ))}
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
                  <View style={[styles.pathologyDot, { backgroundColor: ANOMALY_COLORS[i % ANOMALY_COLORS.length] }]} />
                  <Text style={styles.pathologyName}>{item.pathology}</Text>
                  <Text style={[styles.pathologyPct, { color: getBarColor(item.probability) }]}>
                    {item.percentage || `${Math.round(item.probability * 100)}%`}
                  </Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, {
                    width: `${Math.round(item.probability * 100)}%`,
                    backgroundColor: ANOMALY_COLORS[i % ANOMALY_COLORS.length],
                  }]} />
                </View>
                <Text style={styles.urgencyTag}>Niveau : {item.urgency || "—"}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Résultat MURA */}
        {muraResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🦴 Résultat Fracture (MURA)</Text>
            <View style={[styles.muraCard, { backgroundColor: muraResult.is_abnormal ? colors.criticalBg : colors.normalBg, borderColor: muraResult.is_abnormal ? colors.critical : colors.normal }]}>
              <Text style={[styles.muraDiag, { color: muraResult.is_abnormal ? colors.critical : colors.normal }]}>
                {muraResult.diagnostic || (muraResult.is_abnormal ? "🔴 FRACTURE DÉTECTÉE" : "🟢 NORMAL")}
              </Text>
              <View style={styles.muraRow}>
                <Text style={styles.muraLabel}>Probabilité</Text>
                <Text style={[styles.muraValue, { color: muraResult.is_abnormal ? colors.critical : colors.normal }]}>
                  {muraResult.percentage || `${Math.round((muraResult.probability || 0) * 100)}%`}
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, {
                  width: muraResult.percentage || `${Math.round((muraResult.probability || 0) * 100)}%`,
                  backgroundColor: muraResult.is_abnormal ? colors.critical : colors.normal,
                }]} />
              </View>
              <View style={[styles.muraRow, { marginTop: 12 }]}>
                <Text style={styles.muraLabel}>Recommandation</Text>
              </View>
              <Text style={[styles.muraReco, { color: muraResult.is_abnormal ? colors.critical : colors.normal }]}>
                {muraResult.recommandation || "Consulter un spécialiste"}
              </Text>
            </View>
          </View>
        )}

        {!muraResult && detected.length === 0 && (
          <View style={[styles.section, styles.normalResult]}>
            <Text style={styles.normalIcon}>✅</Text>
            <Text style={styles.normalTitle}>Aucune anomalie détectée</Text>
            <Text style={styles.normalSub}>Tous les indicateurs sont dans la normale</Text>
          </View>
        )}

        {/* Toutes les pathologies */}
        {sorted.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔬 Toutes les pathologies ({sorted.length})</Text>
            {sorted.map((item, i) => (
              <View key={i} style={[styles.pathologyRow, item.detected && styles.pathologyDetected]}>
                <View style={styles.pathologyHeader}>
                  <Text style={styles.pathologyStatus}>{item.detected ? "🔴" : "🟢"}</Text>
                  <Text style={styles.pathologyName}>{item.pathology}</Text>
                  <Text style={[styles.pathologyPct, { color: getBarColor(item.probability) }]}>
                    {item.percentage || `${Math.round(item.probability * 100)}%`}
                  </Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, {
                    width: `${Math.round(item.probability * 100)}%`,
                    backgroundColor: getBarColor(item.probability),
                  }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Section Feedback Clinique */}
        {feedback?.is_validated ? (
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackHeader}>
              <Text style={styles.feedbackTitle}>✅ Validé par un radiologue</Text>
              <Text style={styles.feedbackDate}>
                {feedback.validated_by} · {feedback.validated_at ? new Date(feedback.validated_at).toLocaleDateString("fr-FR") : ""}
              </Text>
            </View>
            <Text style={styles.feedbackText}>{feedback.clinical_feedback}</Text>
            {user?.role === "radiologist" && (
              <TouchableOpacity style={styles.editFeedbackBtn} onPress={() => setShowFeedbackModal(true)}>
                <Text style={styles.editFeedbackBtnText}>✏️ Modifier le feedback</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          user?.role === "radiologist" && (
            <TouchableOpacity style={styles.addFeedbackBtn} onPress={() => setShowFeedbackModal(true)}>
              <Text style={styles.addFeedbackBtnText}>🔬 Ajouter un feedback clinique</Text>
            </TouchableOpacity>
          )
        )}

        {/* Modal Feedback */}
        <Modal visible={showFeedbackModal} transparent animationType="slide" onRequestClose={() => setShowFeedbackModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.feedbackModal}>
              <Text style={styles.feedbackModalTitle}>🔬 Feedback clinique</Text>
              <Text style={styles.feedbackModalSub}>
                Votre avis en tant que radiologue sera affiché avec l'analyse
              </Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Décrivez votre interprétation clinique, vos recommandations..."
                placeholderTextColor="#9ca3af"
                value={feedbackText}
                onChangeText={setFeedbackText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <View style={styles.feedbackModalActions}>
                <TouchableOpacity
                  style={styles.cancelFeedbackBtn}
                  onPress={() => setShowFeedbackModal(false)}
                >
                  <Text style={styles.cancelFeedbackBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitFeedbackBtn, submittingFeedback && { opacity: 0.7 }]}
                  onPress={submitFeedback}
                  disabled={submittingFeedback}
                >
                  {submittingFeedback
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.submitFeedbackBtnText}>✅ Valider</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Actions - Boutons principaux */}
        <View style={{ marginHorizontal: 16, marginTop: 16, gap: 12 }}>

          {/* Bouton Télécharger rapport - pour tous */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#1F6B9E" }, generatingReport && { opacity: 0.7 }]}
            onPress={downloadReport}
            disabled={generatingReport}
            activeOpacity={0.8}
          >
            {generatingReport
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Text style={styles.actionBtnIcon}>📄</Text>
                  <Text style={styles.actionBtnText}>Télécharger le rapport PDF</Text>
                </>
            }
          </TouchableOpacity>

          {/* Bouton Envoyer au radiologue - doctor uniquement */}
          {user?.role === "doctor" && !feedback?.is_validated && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#8B5CF6" }, sendingToRadio && { opacity: 0.7 }]}
              onPress={sendToRadiologist}
              disabled={sendingToRadio}
              activeOpacity={0.8}
            >
              {sendingToRadio
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Text style={styles.actionBtnIcon}>🔬</Text>
                    <Text style={styles.actionBtnText}>Envoyer au radiologue</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          {/* Boutons Valider/Rejeter - radiologue uniquement */}
          {user?.role === "radiologist" && !feedback?.is_validated && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#27AE60", flex: 1 }]}
                onPress={() => {
                  Alert.alert("Valider l'analyse", "Confirmez-vous la validation de cette analyse ?", [
                    { text: "Annuler", style: "cancel" },
                    { text: "Valider", onPress: validateAnalysis }
                  ]);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>✅</Text>
                <Text style={styles.actionBtnText}>Valider</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#E74C3C", flex: 1 }]}
                onPress={() => setShowRejectModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>❌</Text>
                <Text style={styles.actionBtnText}>Rejeter</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Modal Rejet */}
        <Modal visible={showRejectModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.feedbackModal}>
              <Text style={styles.feedbackModalTitle}>❌ Motif de rejet</Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Expliquez le motif du rejet..."
                placeholderTextColor="#9ca3af"
                value={rejectMotif}
                onChangeText={setRejectMotif}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <View style={styles.feedbackModalActions}>
                <TouchableOpacity style={styles.cancelFeedbackBtn} onPress={() => setShowRejectModal(false)}>
                  <Text style={styles.cancelFeedbackBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitFeedbackBtn, { backgroundColor: "#E74C3C" }]} onPress={rejectAnalysis}>
                  <Text style={styles.submitFeedbackBtnText}>Rejeter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Avertissement */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚕️ Ces résultats sont générés par intelligence artificielle à titre indicatif et ne remplacent pas le diagnostic d'un professionnel de santé qualifié.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textSecondary },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: "#fff", fontWeight: "600" },

  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 16 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  urgencyCard: {
    marginHorizontal: 16, marginTop: 16,
    borderRadius: radius.lg, padding: 16,
    borderLeftWidth: 4,
    ...shadows.small,
  },
  urgencyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  urgencyLabel: { fontSize: 20, fontWeight: "700" },
  urgencyScore: { fontSize: 24, fontWeight: "800" },
  urgencyDate: { fontSize: 12 },

  section: {
    backgroundColor: colors.surface,
    marginHorizontal: 16, marginTop: 16,
    borderRadius: radius.lg, padding: 16,
    ...shadows.small,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 14 },

  imageContainer: {
    width: "100%", aspectRatio: 1,
    backgroundColor: "#000", borderRadius: radius.md,
    overflow: "hidden", position: "relative", marginBottom: 12,
  },
  radioImage: { width: "100%", height: "100%" },
  overlay: { position: "absolute", borderRadius: 6 },

  legend: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 12 },
  legendTitle: { fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
  legendName: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  legendPct: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  pathologyRow: { marginBottom: 14 },
  pathologyDetected: {
    backgroundColor: colors.criticalBg,
    borderRadius: radius.sm, padding: 8, marginBottom: 10,
  },
  pathologyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  pathologyDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  pathologyStatus: { fontSize: 12, marginRight: 6 },
  pathologyName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  pathologyPct: { fontSize: 13, fontWeight: "700" },
  progressBg: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  urgencyTag: { fontSize: 11, color: colors.textMuted, marginTop: 4 },

  normalResult: { alignItems: "center", paddingVertical: 24 },
  normalIcon: { fontSize: 48, marginBottom: 12 },
  normalTitle: { fontSize: 18, fontWeight: "700", color: colors.normal },
  normalSub: { fontSize: 13, color: colors.textMuted, marginTop: 6 },

  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20,
  },
  actionBtnIcon: { fontSize: 18 },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disclaimer: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: "#FFF8E1", borderRadius: radius.lg, padding: 14,
  },
  disclaimerText: { fontSize: 12, color: "#795548", lineHeight: 18 },
  feedbackCard: {
    backgroundColor: "#F0FFF4", marginHorizontal: 16, marginTop: 16,
    borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: "#27AE60",
  },
  feedbackHeader: { marginBottom: 10 },
  feedbackTitle: { fontSize: 15, fontWeight: "700", color: "#27AE60" },
  feedbackDate: { fontSize: 11, color: "#5A6A7A", marginTop: 3 },
  feedbackText: { fontSize: 14, color: "#1A2332", lineHeight: 22 },
  editFeedbackBtn: {
    marginTop: 12, backgroundColor: "#fff", borderRadius: 8,
    padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#27AE60",
  },
  editFeedbackBtnText: { color: "#27AE60", fontWeight: "600", fontSize: 13 },
  addFeedbackBtn: {
    marginHorizontal: 16, marginTop: 16, backgroundColor: "#EBF4FB",
    borderRadius: 12, padding: 16, alignItems: "center",
    borderWidth: 1.5, borderColor: "#1F6B9E", borderStyle: "dashed",
  },
  addFeedbackBtnText: { color: "#1F6B9E", fontWeight: "700", fontSize: 15 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  feedbackModal: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  feedbackModalTitle: { fontSize: 20, fontWeight: "700", color: "#1A2332", marginBottom: 6 },
  feedbackModalSub: { fontSize: 13, color: "#5A6A7A", marginBottom: 16 },
  feedbackInput: {
    backgroundColor: "#F5F7FA", borderWidth: 1.5, borderColor: "#DDE3EA",
    borderRadius: 12, padding: 14, fontSize: 15, color: "#1A2332",
    minHeight: 140, marginBottom: 16,
  },
  feedbackModalActions: { flexDirection: "row", gap: 10 },
  cancelFeedbackBtn: {
    flex: 1, backgroundColor: "#F5F7FA", borderRadius: 10,
    padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#DDE3EA",
  },
  cancelFeedbackBtnText: { color: "#5A6A7A", fontWeight: "600" },
  submitFeedbackBtn: {
    flex: 2, backgroundColor: "#1F6B9E", borderRadius: 10,
    padding: 14, alignItems: "center",
  },
  submitFeedbackBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  muraCard: {
    borderRadius: radius.md, padding: 16,
    borderWidth: 1.5, marginBottom: 8,
  },
  muraDiag: { fontSize: 20, fontWeight: "800", marginBottom: 12 },
  muraRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  muraLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  muraValue: { fontSize: 22, fontWeight: "800" },
  muraReco: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  muraLabel2: {
    position: "absolute",
    top: "25%", left: "30%",
    backgroundColor: colors.critical,
    borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  muraLabelText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
