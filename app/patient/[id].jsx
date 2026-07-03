import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, RefreshControl, StatusBar,
  Dimensions
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { API_URL } from "../../constants/config";
import { colors, shadows, radius, palette } from "../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function ReportsSection({ patientId }) {
  const [reports, setReports] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await api.get(`/reports/patient/${patientId}`);
        setReports(res.data?.reports || []);
      } catch (e) { console.log("Reports err:", e.message); }
    };
    fetchReports();
  }, [patientId]);

  const openReport = async (report) => {
    if (!report.signed_url) {
      Alert.alert("Erreur", "URL du rapport non disponible");
      return;
    }
    Alert.alert(
      "Rapport PDF",
      `Rapport du ${report.generated_at ? new Date(report.generated_at).toLocaleDateString("fr-FR") : "—"}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Visualiser",
          onPress: async () => {
            const WebBrowser = require("expo-web-browser");
            const viewerUrl = `https://reports.aria-web.site?url=${encodeURIComponent(report.signed_url)}`;
            await WebBrowser.openBrowserAsync(viewerUrl);
          }
        },
        {
          text: "Partager",
          onPress: async () => {
            try {
              const FileSystem = require("expo-file-system/legacy");
              const Sharing = require("expo-sharing");
              const localPath = FileSystem.documentDirectory + `rapport_${report.report_id}.pdf`;
              const dl = await FileSystem.downloadAsync(report.signed_url, localPath);
              if (dl.status === 200) {
                await Sharing.shareAsync(dl.uri, { mimeType: "application/pdf", dialogTitle: "Rapport ARIA" });
              }
            } catch (e) {
              Alert.alert("Erreur", "Impossible de partager");
            }
          }
        },
        {
          text: "Télécharger",
          onPress: async () => {
            try {
              const FileSystem = require("expo-file-system/legacy");
              const Sharing = require("expo-sharing");
              const localPath = FileSystem.documentDirectory + `rapport_${report.report_id}.pdf`;
              const dl = await FileSystem.downloadAsync(report.signed_url, localPath);
              if (dl.status === 200) {
                await Sharing.shareAsync(dl.uri, { mimeType: "application/pdf", dialogTitle: "Télécharger Rapport ARIA", UTI: "com.adobe.pdf" });
              }
            } catch (e) {
              Alert.alert("Erreur", "Impossible de télécharger");
            }
          }
        },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            Alert.alert("Confirmer", "Supprimer ce rapport définitivement ?", [
              { text: "Annuler", style: "cancel" },
              {
                text: "Supprimer",
                style: "destructive",
                onPress: async () => {
                  try {
                    await api.delete(`/reports/${report.report_id}`);
                    setReports(prev => prev.filter(rep => rep.report_id !== report.report_id));
                    Alert.alert("✅", "Rapport supprimé");
                  } catch (e) {
                    Alert.alert("Erreur", e.response?.data?.detail || "Impossible de supprimer");
                  }
                }
              }
            ]);
          }
        },
      ]
    );
  };

  if (!reports.length) return null;

  return (
    <View style={{ marginHorizontal: 16, marginTop: 20 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginBottom: 10 }}>
        RAPPORTS PDF ({reports.length})
      </Text>
      {reports.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          <TouchableOpacity
            style={{ flex: 1, flexDirection: "row", alignItems: "center", padding: 14, gap: 10 }}
            onPress={() => openReport(r)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 24 }}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", color: colors.textPrimary, fontSize: 14 }}>
                Rapport #{reports.length - i} · {r.urgency || "—"}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {r.generated_at ? new Date(r.generated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ padding: 14, borderLeftWidth: 1, borderLeftColor: colors.border }}
            onPress={() => Alert.alert("Supprimer", "Supprimer ce rapport définitivement ?", [
              { text: "Annuler", style: "cancel" },
              { text: "Supprimer", style: "destructive", onPress: async () => {
                try {
                  await api.delete(`/reports/${r.report_id}`);
                  setReports(prev => prev.filter(rep => rep.report_id !== r.report_id));
                } catch (e) {
                  Alert.alert("Erreur", e.response?.data?.detail || "Impossible de supprimer");
                }
              }}
            ])}
          >
            <Text style={{ fontSize: 20 }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export default function PatientDetail() {
  const router = useRouter();
  const { theme } = useSettings();
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const [patient, setPatient] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reportLoadingId, setReportLoadingId] = useState(null);

  const bg = theme?.bg || colors.background;
  const surface = theme?.surface || colors.surface;

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    await Promise.all([fetchPatient(), fetchImages()]);
  };

  const fetchPatient = async () => {
    try {
      const res = await api.get(`/patients/${id}`);
      setPatient(res.data);
    } catch (e) {
      Alert.alert("Erreur", "Patient introuvable");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    try {
      const res = await api.get(`/patients/${id}/images`);
      const imgs = res.data.items || res.data || [];
      const imgsWithUrl = await Promise.all(
        imgs.map(async (img) => {
          try {
            const urlRes = await api.get(`/images/${img.id}/url`);
            return { ...img, url: urlRes.data.url };
          } catch { return { ...img, url: null }; }
        })
      );
      setImages(imgsWithUrl);
    } catch (e) {} finally {
      setRefreshing(false);
    }
  };

  const uploadImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission refusée", "Autorisez l'accès à la galerie dans les paramètres.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    Alert.alert(
      "Partie du corps",
      "Quelle région anatomique souhaitez-vous analyser ?",
      [
        { text: "🫁 Thorax", onPress: () => doUpload(asset, "chest") },
        { text: "🦴 Os / Fracture", onPress: () => doUpload(asset, "bone") },
        { text: "📋 Autre", onPress: () => doUpload(asset, "other") },
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  const doUpload = async (asset, bodyPart) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("patient_id", id);
      formData.append("body_part", bodyPart);
      formData.append("image", { uri: asset.uri, name: "radio.jpg", type: "image/jpeg" });
      await api.post("/images/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Alert.alert("✅ Radiographie uploadée", "L'image a été ajoutée au dossier.");
      fetchImages();
    } catch (e) {
      Alert.alert("Erreur d'upload", e.response?.data?.detail || e.message);
    } finally {
      setUploading(false);
    }
  };

  const analyzeImage = async (imageId, type) => {
    // Admin et radiologue ont accès sans premium
    if (!["admin", "radiologist"].includes(user?.role)) {
      try {
        const subRes = await api.get("/subscription/status");
        if (!subRes.data?.is_premium) {
          Alert.alert(
            "👑 Premium requis",
            "L'analyse IA est reservee aux abonnes Premium. 2 000 XAF/mois.",
            [
              { text: "Annuler", style: "cancel" },
              { text: "Passer a Premium", onPress: () => router.push("/payment") }
            ]
          );
          return;
        }
      } catch (e) {}
    }

    const label = type === "chest" ? "CheXpert — Thorax" : "MURA — Fractures";
    Alert.alert(
      "🤖 Analyse IA",
      `Lancer une analyse avec le modèle ${label} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Analyser", onPress: async () => {
            try {
              const endpoint = type === "chest"
                ? `/analyze/chest?image_id=${imageId}`
                : `/analyze/fracture?image_id=${imageId}`;
              const res = await api.post(endpoint);
              router.push(`/analyse/${res.data.analysis_id}`);
            } catch (e) {
              Alert.alert("Erreur", e.response?.data?.detail || "Analyse impossible");
            }
          }
        }
      ]
    );
  };

  const deleteImage = async (imageId) => {
    Alert.alert(
      "Supprimer la radiographie",
      "Cette action est irréversible. L'image sera définitivement supprimée.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/images/${imageId}/permanent`);
              fetchImages();
            } catch (e) {
              Alert.alert("Erreur", e.response?.data?.detail || "Impossible de supprimer");
            }
          }
        }
      ]
    );
  };

  const generateReport = async (imageId) => {
    setReportLoadingId(imageId);
    try {
      const analysesRes = await api.get(`/analyze/image/${imageId}/analyses`);
      const analysisId = analysesRes.data?.analyses?.[0]?.analysis_id;
      if (!analysisId) {
        Alert.alert("⚠️ Analyse requise", "Lancez d'abord une analyse IA sur cette radiographie.");
        return;
      }
      const reportRes = await api.post(`/reports/analysis/${analysisId}?regenerate=true`);
      const reportId = reportRes.data?.report_id;
      const token = await AsyncStorage.getItem("token");
      const fileUri = FileSystem.documentDirectory + `rapport_${Date.now()}.pdf`;
      const download = await FileSystem.downloadAsync(
        `${API_URL}/reports/${reportId}/download`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(
        "📄 Rapport généré",
        "Le rapport PDF est prêt.",
        [
          { text: "👁️ Visualiser", onPress: async () => await WebBrowser.openBrowserAsync(`${API_URL}/reports/${reportId}/download`) },
          { text: "📤 Partager", onPress: async () => { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(download.uri, { mimeType: "application/pdf" }); } },
          { text: "Fermer", style: "cancel" },
        ]
      );
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || e.message);
    } finally {
      setReportLoadingId(null);
    }
  };

  const deletePatient = () => {
    if (user?.role !== "admin" && user?.role !== "radiologist" && String(patient?.created_by) !== String(user?.id)) {
      Alert.alert("Permission refusée", "Vous ne pouvez supprimer que vos propres patients.");
      return;
    }
    Alert.alert(
      "⚠️ Supprimer le patient",
      "Cette action est irréversible. Toutes les radiographies et analyses seront supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/patients/${id}`);
              router.replace("/(tabs)/patients");
            } catch (e) {
              Alert.alert("Erreur", "Impossible de supprimer ce patient");
            }
          }
        }
      ]
    );
  };

  const getBodyPartConfig = (bp) => ({
    chest: { label: "Thorax",      icon: "🫁", color: colors.primary,  bg: colors.primaryBg },
    bone:  { label: "Os/Fracture", icon: "🦴", color: palette.violet,  bg: palette.violetLight },
    other: { label: "Autre",       icon: "📋", color: colors.textMuted, bg: colors.gray100 },
  })[bp] || { label: bp, icon: "🩻", color: colors.textMuted, bg: colors.gray100 };

  const getInitials = (first, last) =>
    `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const getAge = (dob) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob)) / 31557600000);
  };

  if (loading) return (
    <View style={[styles.centered, { backgroundColor: bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Chargement du dossier...</Text>
    </View>
  );

  const age = getAge(patient?.date_of_birth);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar backgroundColor={palette.navy} barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAll(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/patient/edit/${id}`)}
            >
              <Text style={styles.editBtnText}>✏️ Modifier</Text>
            </TouchableOpacity>
          </View>

          {/* Identité patient dans le header */}
          <View style={styles.headerPatient}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {getInitials(patient?.first_name, patient?.last_name)}
              </Text>
            </View>
            <View style={styles.headerPatientInfo}>
              <Text style={styles.headerPatientName}>
                {patient?.first_name} {patient?.last_name}
              </Text>
              <View style={styles.headerPatientMeta}>
                {!!age && <Text style={styles.headerMetaText}>{age} ans</Text>}
                {!!age && !!patient?.gender && <Text style={styles.headerMetaDot}>{" · "}</Text>}
                {patient?.gender && (
                  <Text style={styles.headerMetaText}>
                    {patient.gender === "M" ? "Homme" : "Femme"}
                  </Text>
                )}
              </View>
              <View style={styles.dossierPill}>
                <Text style={styles.dossierPillText}>#{patient?.medical_record_number}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Informations médicales */}
        <Text style={[styles.sectionLabel, { color: theme?.textMuted || colors.textMuted }]}>INFORMATIONS</Text>
        <View style={[styles.infoCard, { backgroundColor: surface }]}>
          {[
            { icon: "🎂", label: "Date de naissance", value: patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—" },
            { icon: "👤", label: "Genre", value: patient?.gender === "M" ? "Masculin" : patient?.gender === "F" ? "Féminin" : "—" },
            { icon: "📱", label: "Téléphone", value: patient?.phone || "—" },
            { icon: "📍", label: "Adresse", value: patient?.address || "—" },
          ].map((item, i) => (
            <View key={i} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme?.border || colors.border }]}>
              <View style={[styles.infoIconWrap, { backgroundColor: theme?.surfaceSecondary || colors.gray100 }]}>
                <Text style={styles.infoIcon}>{item.icon}</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme?.textMuted || colors.textMuted }]}>{item.label}</Text>
                <Text style={[styles.infoValue, { color: theme?.text || colors.textPrimary }]}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Radiographies */}
        <View style={styles.radioHeader}>
          <View>
            <Text style={[styles.sectionLabel, { color: theme?.textMuted || colors.textMuted, marginTop: 0 }]}>
              RADIOGRAPHIES
            </Text>
            <Text style={[styles.radioCount, { color: theme?.textSecondary || colors.textSecondary }]}>
              {images.length} image{images.length > 1 ? "s" : ""} dans ce dossier
            </Text>
          </View>
          <View style={styles.radioActions}>
            {["admin", "radiologist"].includes(user?.role) && (
              <TouchableOpacity
                style={styles.trashBtn}
                onPress={() => router.push(`/patient/trash?patient_id=${id}&patient_name=${patient?.first_name}%20${patient?.last_name}`)}
              >
                <Text style={styles.trashIcon}>🗑️</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.uploadBtn, uploading && { opacity: 0.7 }]}
              onPress={uploadImage}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.uploadBtnText}>＋ Uploader</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {images.length === 0 ? (
          <View style={[styles.emptyRadio, { backgroundColor: surface }]}>
            <View style={styles.emptyRadioIconWrap}>
              <Text style={styles.emptyRadioIcon}>🩻</Text>
            </View>
            <Text style={[styles.emptyRadioTitle, { color: theme?.text || colors.textPrimary }]}>
              Aucune radiographie
            </Text>
            <Text style={[styles.emptyRadioSub, { color: theme?.textMuted || colors.textMuted }]}>
              Uploadez une radio pour lancer une analyse IA
            </Text>
            <TouchableOpacity style={styles.emptyUploadBtn} onPress={uploadImage}>
              <Text style={styles.emptyUploadBtnText}>＋ Uploader une radiographie</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imagesList}>
            {images.map((img, index) => {
              const bpConf = getBodyPartConfig(img.body_part);
              return (
                <View key={img.id} style={[styles.imageCard, { backgroundColor: surface }]}>
                  {/* Badge partie du corps */}
                  <View style={styles.imageCardHeader}>
                    <View style={[styles.bpBadge, { backgroundColor: bpConf.bg }]}>
                      <Text style={styles.bpBadgeIcon}>{bpConf.icon}</Text>
                      <Text style={[styles.bpBadgeText, { color: bpConf.color }]}>{bpConf.label}</Text>
                    </View>
                    <View style={styles.imageCardHeaderRight}>
                      <Text style={[styles.imageDate, { color: theme?.textMuted || colors.textMuted }]}>
                        {img.acquisition_date
                          ? new Date(img.acquisition_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                          : "Date inconnue"
                        }
                      </Text>
                      <TouchableOpacity onPress={() => deleteImage(img.id)} style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Image */}
                  {img.url ? (
                    <Image
                      source={{ uri: img.url }}
                      style={styles.radioImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.radioPlaceholder, { backgroundColor: colors.gray100 }]}>
                      <Text style={styles.radioPlaceholderIcon}>🩻</Text>
                      <Text style={styles.radioPlaceholderText}>Image non disponible</Text>
                    </View>
                  )}

                  {/* Actions analyse */}
                  <View style={styles.analyzeRow}>
                    <Text style={[styles.analyzeLabel, { color: theme?.textSecondary || colors.textSecondary }]}>
                      Analyser avec :
                    </Text>
                    <View style={styles.analyzeBtns}>
                      <TouchableOpacity
                        style={[styles.analyzeBtn, { backgroundColor: colors.primaryBg }]}
                        onPress={() => analyzeImage(img.id, "chest")}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.analyzeBtnIcon}>🫁</Text>
                        <Text style={[styles.analyzeBtnText, { color: colors.primary }]}>Thorax</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.analyzeBtn, { backgroundColor: palette.violetLight }]}
                        onPress={() => analyzeImage(img.id, "fracture")}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.analyzeBtnIcon}>🦴</Text>
                        <Text style={[styles.analyzeBtnText, { color: palette.violet }]}>Fracture</Text>
                      </TouchableOpacity>
                    </View>
                  </View>


                </View>
              );
            })}
          </View>
        )}

        {/* Liste des rapports du patient */}
        <ReportsSection patientId={id} />



        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, color: colors.textMuted },

  // Header
  header: {
    backgroundColor: palette.navy,
    paddingTop: 52, paddingBottom: 24, paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 30, color: "#fff", fontWeight: "300" },
  editBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
  },
  editBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  headerPatient: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerAvatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
  headerAvatarText: { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerPatientInfo: { flex: 1 },
  headerPatientName: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  headerPatientMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  headerMetaText: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  headerMetaDot: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
  dossierPill: {
    marginTop: 8, alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  dossierPillText: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "600" },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1,
    marginHorizontal: 16, marginTop: 24, marginBottom: 8,
  },

  // Info card
  infoCard: {
    marginHorizontal: 16, borderRadius: radius.xl,
    overflow: "hidden", ...shadows.small,
  },
  infoRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    justifyContent: "center", alignItems: "center",
  },
  infoIcon: { fontSize: 16 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: "600" },

  // Radio header
  radioHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-end", marginHorizontal: 16, marginTop: 24, marginBottom: 12,
  },
  radioCount: { fontSize: 12, marginTop: 2 },
  radioActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  trashBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.dangerBg,
    justifyContent: "center", alignItems: "center",
  },
  trashIcon: { fontSize: 16 },
  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10,
    ...shadows.small,
  },
  uploadBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Empty radio
  emptyRadio: {
    marginHorizontal: 16, borderRadius: radius.xl,
    padding: 32, alignItems: "center",
    ...shadows.small,
  },
  emptyRadioIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryBg,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  emptyRadioIcon: { fontSize: 32 },
  emptyRadioTitle: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  emptyRadioSub: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 20 },
  emptyUploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyUploadBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Images list
  imagesList: { marginHorizontal: 16, gap: 12 },
  imageCard: {
    borderRadius: radius.xl, overflow: "hidden",
    ...shadows.small,
  },

  imageCardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 12,
  },
  bpBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  bpBadgeIcon: { fontSize: 14 },
  bpBadgeText: { fontSize: 12, fontWeight: "700" },
  imageCardHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  imageDate: { fontSize: 11 },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.dangerBg,
    justifyContent: "center", alignItems: "center",
  },
  deleteBtnIcon: { fontSize: 14 },

  radioImage: {
    width: "100%", height: 200, backgroundColor: "#000",
  },
  radioPlaceholder: {
    height: 120, justifyContent: "center", alignItems: "center", gap: 8,
  },
  radioPlaceholderIcon: { fontSize: 36 },
  radioPlaceholderText: { fontSize: 12, color: colors.textMuted },

  // Analyze
  analyzeRow: { padding: 12, paddingBottom: 8 },
  analyzeLabel: { fontSize: 11, fontWeight: "600", marginBottom: 8 },
  analyzeBtns: { flexDirection: "row", gap: 8 },
  analyzeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    borderRadius: radius.lg, paddingVertical: 12,
  },
  analyzeBtnIcon: { fontSize: 18 },
  analyzeBtnText: { fontSize: 13, fontWeight: "700" },

  // Report
  reportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: colors.success,
    margin: 12, marginTop: 4,
    borderRadius: radius.lg, paddingVertical: 14,
  },
  reportBtnIcon: { fontSize: 16 },
  reportBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Delete patient
  deletePatientBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginHorizontal: 16, marginTop: 24,
    borderRadius: radius.xl, paddingVertical: 16,
    borderWidth: 1.5, borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  deletePatientIcon: { fontSize: 16 },
  deletePatientText: { color: colors.danger, fontSize: 15, fontWeight: "700" },
});
