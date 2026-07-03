import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, StatusBar
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../services/api";
import { colors, shadows, radius } from "../../constants/theme";
import { useSettings } from "../../contexts/SettingsContext";

export default function TrashScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const { patient_id, patient_name } = useLocalSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchTrash(); }, []);

  const fetchTrash = async () => {
    try {
      const res = await api.get(`/patients/${patient_id}/trash`);
      setItems(res.data.items || []);
    } catch (e) {
      console.log(e);
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
            Alert.alert("✅ Restaurée", "Radiographie restaurée !");
            fetchTrash();
          } catch (e) {
            Alert.alert("Erreur", "Impossible de restaurer");
          }
        }
      }
    ]);
  };

  const deleteForever = async (imageId) => {
    Alert.alert("⚠️ Suppression définitive", "Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/images/${imageId}/permanent`);
            fetchTrash();
          } catch (e) {
            Alert.alert("Erreur", "Impossible de supprimer");
          }
        }
      }
    ]);
  };

  const emptyTrash = async () => {
    console.log("emptyTrash appelé, patient_id:", patient_id, "items:", items.length);
    if (items.length === 0) return;
    Alert.alert("Vider la corbeille", "Supprimer définitivement toutes les radiographies ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Vider", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/patients/${patient_id}/trash/empty`);
            fetchTrash();
            Alert.alert("✅ Corbeille vidée");
          } catch (e) {
            console.log("Erreur vider corbeille:", e.response?.status, e.response?.data, e.message);
            Alert.alert("Erreur", "Impossible de vider la corbeille");
          }
        }
      }
    ]);
  };

  const getBodyPartLabel = (bp) =>
    bp === "chest" ? "Thorax" : bp === "bone" ? "Os/Fracture" : "Autre";

  const getDaysColor = (days) => {
    if (days <= 1) return colors.critical;
    if (days <= 3) return colors.high;
    return colors.normal;
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar backgroundColor={colors.primaryDark} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>🗑️ Corbeille</Text>
            <Text style={styles.headerSub}>{patient_name} · {items.length} élément(s)</Text>
          </View>
          {items.length > 0 && (
            <TouchableOpacity style={styles.emptyBtn} onPress={emptyTrash}>
              <Text style={styles.emptyBtnText}>Tout supprimer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTrash(); }} colors={[colors.primary]} />
        }
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            🕐 Les radiographies sont automatiquement supprimées après <Text style={{ fontWeight: "700" }}>7 jours</Text>.
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗑️</Text>
            <Text style={styles.emptyTitle}>Corbeille vide</Text>
            <Text style={styles.emptySub}>Aucune radiographie supprimée</Text>
          </View>
        ) : (
          items.map((img) => (
            <View key={img.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.iconBox}>
                  <Text style={styles.iconText}>🩻</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{getBodyPartLabel(img.body_part)}</Text>
                  <Text style={styles.cardDate}>
                    Supprimé le {new Date(img.deleted_at).toLocaleString("fr-FR")}
                  </Text>
                  <View style={[styles.daysBadge, { backgroundColor: getDaysColor(img.days_left) + "20" }]}>
                    <Text style={[styles.daysText, { color: getDaysColor(img.days_left) }]}>
                      ⏳ Suppression dans {img.days_left} jour{img.days_left > 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.restoreBtn}
                  onPress={() => restoreImage(img.id)}
                >
                  <Text style={styles.restoreBtnText}>↩️ Restaurer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteForever(img.id)}
                >
                  <Text style={styles.deleteBtnText}>🗑️ Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  emptyBtn: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: colors.danger,
  },
  emptyBtnText: { fontSize: 12, color: colors.danger, fontWeight: "700" },

  content: { padding: 16, paddingBottom: 40 },

  infoCard: {
    backgroundColor: "#FFF8E1",
    borderRadius: radius.md, padding: 14, marginBottom: 16,
  },
  infoText: { fontSize: 13, color: "#795548", lineHeight: 18 },

  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: 6 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14,
    marginBottom: 12, ...shadows.small,
  },
  cardLeft: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  iconBox: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: colors.primaryBg,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  iconText: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  cardDate: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  daysBadge: {
    marginTop: 6, alignSelf: "flex-start",
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  daysText: { fontSize: 11, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 8 },
  restoreBtn: {
    flex: 1, backgroundColor: colors.normalBg,
    borderRadius: radius.md, padding: 10, alignItems: "center",
    borderWidth: 1, borderColor: colors.normal,
  },
  restoreBtnText: { color: colors.normal, fontSize: 13, fontWeight: "600" },
  deleteBtn: {
    flex: 1, backgroundColor: colors.dangerBg,
    borderRadius: radius.md, padding: 10, alignItems: "center",
    borderWidth: 1, borderColor: colors.danger,
  },
  deleteBtnText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
});
