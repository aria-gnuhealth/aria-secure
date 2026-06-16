import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../services/api";

export default function TrashScreen() {
  const router = useRouter();
  const { patient_id, patient_name } = useLocalSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTrash();
  }, []);

  const fetchTrash = async () => {
    try {
      const res = await api.get(`/patients/${patient_id}/trash`);
      setItems(res.data.items || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const restoreImage = async (imageId) => {
    Alert.alert("Restaurer", "Restaurer cette radiographie ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Restaurer",
        onPress: async () => {
          try {
            await api.post(`/images/${imageId}/restore`);
            Alert.alert("✅ Restaurée", "Radiographie restaurée");
            fetchTrash();
          } catch (error) {
            Alert.alert("Erreur", "Impossible de restaurer");
          }
        },
      },
    ]);
  };

  const deleteForever = async (imageId) => {
    Alert.alert(
      "⚠️ Suppression définitive",
      "Cette action est irréversible. Supprimer définitivement ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/images/${imageId}/permanent`);
              fetchTrash();
            } catch (error) {
              Alert.alert("Erreur", "Impossible de supprimer");
            }
          },
        },
      ]
    );
  };

  const getBodyPartLabel = (bp) =>
    bp === "chest" ? "Thorax" : bp === "bone" ? "Os/Fracture" : "Autre";

  const getDaysColor = (days) => {
    if (days <= 1) return "#C62828";
    if (days <= 3) return "#E65100";
    return "#2E7D32";
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchTrash();
          }}
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🗑️ Corbeille</Text>
        <Text style={styles.headerSub}>{patient_name} — {items.length} élément(s)</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          🕐 Les radiographies supprimées sont automatiquement effacées après 7 jours.
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗑️</Text>
          <Text style={styles.emptyText}>Corbeille vide</Text>
        </View>
      ) : (
        items.map((img) => (
          <View key={img.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>🩻</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{getBodyPartLabel(img.body_part)}</Text>
                <Text style={styles.cardDate}>
                  Supprimé le {new Date(img.deleted_at).toLocaleString("fr-FR")}
                </Text>
                <View style={[styles.daysTag, { backgroundColor: getDaysColor(img.days_left) + "20" }]}>
                  <Text style={[styles.daysText, { color: getDaysColor(img.days_left) }]}>
                    ⏳ Suppression dans {img.days_left} jour{img.days_left > 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.restoreBtn} onPress={() => restoreImage(img.id)}>
                <Text style={styles.restoreBtnText}>↩️ Restaurer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteForever(img.id)}>
                <Text style={styles.deleteBtnText}>🗑️ Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
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
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  infoCard: {
    backgroundColor: "#FFF8E1",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
  },
  infoText: { fontSize: 13, color: "#795548", lineHeight: 18 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: "700", color: "#555" },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#e8e8e8",
  },
  cardHeader: { flexDirection: "row", gap: 12, marginBottom: 12 },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f0f4ff",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  cardDate: { fontSize: 12, color: "#888", marginBottom: 6 },
  daysTag: { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  daysText: { fontSize: 11, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8 },
  restoreBtn: { flex: 1, backgroundColor: "#E8F5E9", borderRadius: 10, padding: 10, alignItems: "center" },
  restoreBtnText: { color: "#2E7D32", fontSize: 13, fontWeight: "600" },
  deleteBtn: { flex: 1, backgroundColor: "#FFEBEE", borderRadius: 10, padding: 10, alignItems: "center" },
  deleteBtnText: { color: "#C62828", fontSize: 13, fontWeight: "600" },
});
