import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, RefreshControl
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { fixMinioUrl } from "../../services/api";
import { API_URL } from "../../constants/config";

export default function PatientDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [patient, setPatient] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    fetchPatient();
    fetchImages();
  }, [id]);

  const fetchPatient = async () => {
    try {
      const res = await api.get(`/patients/${id}`);
      setPatient(res.data);
    } catch (error) {
      Alert.alert("Erreur", "Patient introuvable");
      router.back();
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
          } catch {
            return { ...img, url: null };
          }
        })
      );
      setImages(imgsWithUrl);
    } catch (error) {
      console.log("Erreur chargement images:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const uploadImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled) return;
    const asset = result.assets[0];

    Alert.alert("Partie du corps", "Quelle partie du corps ?", [
      { text: "Thorax", onPress: () => doUpload(asset, "chest") },
      { text: "Os/Fracture", onPress: () => doUpload(asset, "bone") },
      { text: "Autre", onPress: () => doUpload(asset, "other") },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const doUpload = async (asset, bodyPart) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("patient_id", id);
      formData.append("body_part", bodyPart);
      formData.append("image", {
        uri: asset.uri,
        name: "radio.jpg",
        type: "image/jpeg",
      });

      await api.post("/images/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("✅ Succès", "Image uploadée !");
      fetchImages();
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'uploader l'image");
      console.log(error);
    } finally {
      setUploading(false);
    }
  };

  const analyzeImage = async (imageId, type) => {
    const label = type === "chest" ? "CheXpert (thorax)" : "MURA (fractures)";
    Alert.alert("Lancer l'analyse IA", `Analyser avec ${label} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Analyser",
        onPress: async () => {
          try {
            const endpoint = type === "chest"
              ? `/analyze/chest?image_id=${imageId}`
              : `/analyze/fracture?image_id=${imageId}`;
            const res = await api.post(endpoint);
            router.push(`/analyse/${res.data.analysis_id}`);
          } catch (error) {
            Alert.alert("Erreur", "Analyse impossible pour le moment");
            console.log(error);
          }
        },
      },
    ]);
  };

  const deleteImage = async (imageId) => {
    Alert.alert("Supprimer", "Déplacer dans la corbeille ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/images/${imageId}`);
            fetchImages();
          } catch (error) {
            Alert.alert("Erreur", "Impossible de supprimer");
          }
        },
      },
    ]);
  };

  const generateReport = async () => {
    if (images.length === 0) {
      Alert.alert("Attention", "Uploadez d'abord une radiographie");
      return;
    }

    setGeneratingReport(true);
    try {
      const lastImage = images[0];
      const analysesRes = await api.get(`/analyze/image/${lastImage.id}/analyses`);
      const analysisId = analysesRes.data?.analyses?.[0]?.analysis_id;

      if (!analysisId) {
        Alert.alert("Attention", "Lancez d'abord une analyse IA");
        setGeneratingReport(false);
        return;
      }

      const reportRes = await api.post(`/reports/analysis/${analysisId}?regenerate=true`);
      const reportId = reportRes.data?.report_id;

      if (!reportId) {
        Alert.alert("Erreur", "Impossible de générer le rapport");
        setGeneratingReport(false);
        return;
      }

      const token = await AsyncStorage.getItem("token");
      const fileUri = FileSystem.documentDirectory +
        `rapport_${patient?.last_name}_${Date.now()}.pdf`;

      const download = await FileSystem.downloadAsync(
        `${API_URL}/reports/${reportId}/download`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(download.uri, {
          mimeType: "application/pdf",
          dialogTitle: `Rapport - ${patient?.first_name} ${patient?.last_name}`,
        });
      } else {
        Alert.alert("✅ Rapport généré", `Fichier sauvegardé : ${download.uri}`);
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de générer le rapport");
      console.log(error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const deletePatient = () => {
    Alert.alert(
      "⚠️ Supprimer le patient",
      "Cette action est irréversible. Toutes ses radiographies et analyses seront également supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/patients/${id}`);
              Alert.alert("✅ Patient supprimé", "", [
                { text: "OK", onPress: () => router.replace("/(tabs)/patients") },
              ]);
            } catch (error) {
              Alert.alert("Erreur", "Impossible de supprimer le patient");
            }
          },
        },
      ]
    );
  };

  const getBodyPartLabel = (bp) =>
    bp === "chest" ? "Thorax" :
    bp === "bone" ? "Os/Fracture" :
    bp === "other" ? "Autre" : "Radio";

  const getInitials = (first, last) =>
    `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchPatient();
            fetchImages();
          }}
          colors={["#1a73e8"]}
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Dossier patient</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push(`/patient/edit/${id}`)}
          >
            <Text style={styles.editBtnText}>✏️ Modifier</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(patient?.first_name, patient?.last_name)}
            </Text>
          </View>
          <View>
            <Text style={styles.patientName}>
              {patient?.first_name} {patient?.last_name}
            </Text>
            <Text style={styles.patientSub}>
              Dossier #{patient?.medical_record_number}
            </Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Date de naissance</Text>
            <Text style={styles.infoValue}>
              {patient?.date_of_birth
                ? new Date(patient.date_of_birth).toLocaleDateString("fr-FR")
                : "—"}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Genre</Text>
            <Text style={styles.infoValue}>
              {patient?.gender === "M" ? "Masculin" : patient?.gender === "F" ? "Féminin" : "—"}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Téléphone</Text>
            <Text style={styles.infoValue}>{patient?.phone || "—"}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Adresse</Text>
            <Text style={styles.infoValue}>{patient?.address || "—"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Radiographies ({images.length})</Text>
          <View style={styles.sectionActions}>
            <TouchableOpacity
              style={styles.trashBtn}
              onPress={() =>
                router.push(
                  `/patient/trash?patient_id=${id}&patient_name=${patient?.first_name} ${patient?.last_name}`
                )
              }
            >
              <Text style={styles.trashBtnText}>🗑️ Corbeille</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={uploadImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.uploadBtnText}>+ Uploader</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {images.length === 0 ? (
          <View style={styles.emptyImages}>
            <Text style={styles.emptyIcon}>🩻</Text>
            <Text style={styles.emptyText}>Aucune radiographie</Text>
            <Text style={styles.emptySub}>
              Uploadez une radio pour lancer une analyse IA
            </Text>
          </View>
        ) : (
          images.map((img) => (
            <View key={img.id} style={styles.imageCard}>
              {img.url ? (
                <Image
                  source={{ uri: img.url }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>🩻</Text>
                </View>
              )}
              <View style={styles.imageInfo}>
                <Text style={styles.imageName}>
                  🩻 {getBodyPartLabel(img.body_part)}
                </Text>
                <Text style={styles.imageDate}>
                  {img.acquisition_date
                    ? new Date(img.acquisition_date).toLocaleString("fr-FR")
                    : "—"}
                </Text>
              </View>
              <View style={styles.imageActions}>
                <TouchableOpacity
                  style={[styles.analyzeBtn, { backgroundColor: "#e8f5e9" }]}
                  onPress={() => analyzeImage(img.id, "chest")}
                >
                  <Text style={[styles.analyzeBtnText, { color: "#2e7d32" }]}>
                    🫁 Thorax
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.analyzeBtn, { backgroundColor: "#e3f2fd" }]}
                  onPress={() => analyzeImage(img.id, "fracture")}
                >
                  <Text style={[styles.analyzeBtnText, { color: "#1565c0" }]}>
                    🦴 Fracture
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.analyzeBtn, { backgroundColor: "#ffebee" }]}
                  onPress={() => deleteImage(img.id)}
                >
                  <Text style={[styles.analyzeBtnText, { color: "#c62828" }]}>
                    🗑️
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity
        style={styles.reportBtn}
        onPress={generateReport}
        disabled={generatingReport}
      >
        {generatingReport ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.reportBtnText}>📄 Générer rapport PDF</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.deletePatientBtn} onPress={deletePatient}>
        <Text style={styles.deletePatientText}>🗑️ Supprimer le patient</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  editBtn: {
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editBtnText: { color: "#1a73e8", fontSize: 14, fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "#e8e8e8",
  },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e8f0fe",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#1a73e8" },
  patientName: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  patientSub: { fontSize: 13, color: "#888", marginTop: 2 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  infoItem: { width: "47%" },
  infoLabel: { fontSize: 11, color: "#999", marginBottom: 3, textTransform: "uppercase" },
  infoValue: { fontSize: 14, fontWeight: "500", color: "#1a1a1a" },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "#e8e8e8",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  sectionActions: { flexDirection: "row", gap: 8 },
  trashBtn: {
    backgroundColor: "#fff3e0",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#ffe0b2",
  },
  trashBtnText: { fontSize: 12, color: "#e65100", fontWeight: "600" },
  uploadBtn: {
    backgroundColor: "#1a73e8",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  uploadBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  emptyImages: { alignItems: "center", paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: "600", color: "#555" },
  emptySub: { fontSize: 12, color: "#999", marginTop: 4, textAlign: "center" },
  imageCard: {
    borderWidth: 0.5,
    borderColor: "#e8e8e8",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  imagePreview: { width: "100%", height: 180 },
  imagePlaceholder: {
    width: "100%",
    height: 100,
    backgroundColor: "#f0f4ff",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: { fontSize: 40 },
  imageInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  imageName: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  imageDate: { fontSize: 12, color: "#888" },
  imageActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  analyzeBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  analyzeBtnText: { fontSize: 13, fontWeight: "600" },
  reportBtn: {
    backgroundColor: "#34a853",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  reportBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  deletePatientBtn: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ff3b30",
  },
  deletePatientText: { color: "#ff3b30", fontSize: 16, fontWeight: "700" },
});
