import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Alert
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { colors, shadows, radius } from "../../constants/theme";
import { useSettings } from "../../contexts/SettingsContext";

export default function ChatTabScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, baseFontSize } = useSettings();
  const [discussions, setDiscussions] = useState([]);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState("all");

  useEffect(() => { fetchDiscussions(); }, [filter]);

  const fetchDiscussions = async () => {
    try {
      // Admin voit toutes les discussions
      const endpoint = user?.role === "admin"
        ? "/chat/discussions?all=true"
        : "/chat/discussions";
      const res = await api.get(endpoint);
      const all = res.data.discussions || res.data || [];
      const filtered = filter === "all" ? all : all.filter(d => d.status === filter);
      setDiscussions(filtered);
    } catch (e) {
      console.log("Erreur discussions:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createDiscussion = () => {
    if (!["doctor", "admin"].includes(user?.role)) {
      return;
    }
    router.push("/chat/new");
  };

  const getStatusColor = (status) => ({
    open: colors.normal,
    pending: colors.high,
    closed: colors.textMuted,
    urgent: colors.critical,
  })[status] || colors.textMuted;

  const getStatusLabel = (status) => ({
    open: "Ouvert",
    pending: "En attente",
    closed: "Fermé",
    urgent: "Urgent",
  })[status] || status;

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "À l'instant";
    if (diff < 3600000) return `${Math.floor(diff/60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h`;
    return d.toLocaleDateString("fr-FR");
  };

  const hideDiscussion = (item) => {
    Alert.alert(
      "🗑️ Supprimer la conversation",
      "Voulez-vous masquer cette conversation ? Elle restera visible pour l autre participant.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.post(`/chat/discussions/${item.id}/hide`);
              setDiscussions(prev => prev.filter(d => d.id !== item.id));
            } catch (e) {
              Alert.alert("Erreur", "Impossible de masquer cette conversation");
            }
          }
        }
      ]
    );
  };

  const renderDiscussion = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface }]}
      onPress={() => router.push(`/chat/${item.id}`)}
      onLongPress={() => hideDiscussion(item)}
      delayLongPress={600}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarIcon}>💬</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: theme.text }, { color: theme.text, fontSize: baseFontSize + 1 }]} numberOfLines={1}>
            {item.analysis_patient_name || item.title || "Consultation"}
          </Text>
          {item.last_message && (
            <Text style={[styles.cardPreview, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.last_message.content}
            </Text>
          )}
          <View style={styles.cardMeta}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
            <Text style={styles.cardDate}>{formatDate(item.updated_at)}</Text>
          </View>
        </View>
      </View>
      {item.unread_count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar backgroundColor={colors.primaryDark} barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Consultations</Text>
          <Text style={styles.headerSub}>{user?.role === "admin" ? "Consultations admin-radiologue" : user?.role === "radiologist" ? "Consultations assignées" : "Chat utilisateur-radiologue"}</Text>
        </View>
        {["doctor", "admin"].includes(user?.role) && (
          <TouchableOpacity style={styles.newBtn} onPress={createDiscussion}>
            <Text style={styles.newBtnText}>+ Nouveau</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres pour radiologue */}
      {["radiologist", "admin"].includes(user?.role) && (
        <View style={styles.filtersRow}>
          {[
            { value: "all", label: "Toutes" },
            { value: "open", label: "🟢 Ouvertes" },
            { value: "closed", label: "⬜ Fermées" },
          ].map(f => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterBtn, filter === f.value && styles.filterBtnActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={discussions}
        keyExtractor={(item) => item.id}
        renderItem={renderDiscussion}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchDiscussions(); }}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Aucune consultation</Text>
            <Text style={styles.emptySub}>
              {user?.role === "doctor"
                ? "Créez une consultation pour contacter un radiologue"
                : "Aucune consultation en attente"
              }
            </Text>
            {["doctor", "admin"].includes(user?.role) && (
              <TouchableOpacity style={styles.emptyBtn} onPress={createDiscussion}>
                <Text style={styles.emptyBtnText}>+ Nouvelle consultation</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  newBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  newBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    flexDirection: "row", alignItems: "center",
    // backgroundColor géré dynamiquement
    borderRadius: radius.lg, padding: 14,
    marginBottom: 10, ...shadows.small,
  },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primaryBg,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  avatarIcon: { fontSize: 22 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  cardPreview: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600" },
  cardDate: { fontSize: 11, color: colors.textMuted },
  unreadBadge: {
    backgroundColor: colors.critical,
    borderRadius: radius.full, minWidth: 22, height: 22,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 6,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: "center", paddingHorizontal: 32 },
  emptyBtn: {
    marginTop: 20, backgroundColor: colors.primary,
    borderRadius: radius.full, paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  filtersRow: {
    flexDirection: "row", gap: 8, padding: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
  },
  filterBtnActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
  filterText: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },
  filterTextActive: { color: colors.primary, fontWeight: "700" },
});
