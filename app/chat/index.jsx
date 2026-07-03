import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, RefreshControl
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { colors, shadows, radius } from "../../constants/theme";
import { useSettings } from "../../contexts/SettingsContext";

export default function ChatListScreen() {
  const router = useRouter();
  const { theme, baseFontSize, t } = useSettings();
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchDiscussions(); }, []);

  const fetchDiscussions = async () => {
    try {
      const res = await api.get("/chat/discussions");
      setDiscussions(res.data.discussions || res.data || []);
    } catch (e) {
      console.log("Erreur discussions:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createDiscussion = () => {
    if (!["doctor", "admin"].includes(user?.role)) {
      Alert.alert("Info", "Seuls les utilisateurs et admins peuvent initier une consultation.");
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

  const getPriorityColor = (priority) => ({
    urgent: colors.critical,
    high: colors.high,
    normal: colors.primary,
    low: colors.textMuted,
  })[priority] || colors.primary;

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

  const renderDiscussion = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/chat/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, { backgroundColor: getPriorityColor(item.priority) + "20" }]}>
          <Text style={styles.avatarIcon}>💬</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          {item.last_message && (
            <Text style={styles.cardPreview} numberOfLines={1}>
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
    <View style={[styles.container, { backgroundColor: theme?.bg }]}>
      <StatusBar backgroundColor={colors.primaryDark} barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Consultations</Text>
          <Text style={styles.headerSub}>Chat utilisateur-radiologue</Text>
        </View>
        {["doctor", "admin"].includes(user?.role) && (
          <TouchableOpacity style={styles.newBtn} onPress={createDiscussion}>
            <Text style={styles.newBtnText}>+ Nouveau</Text>
          </TouchableOpacity>
        )}
      </View>

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
            {user?.role === "doctor" && (
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
  container: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14,
    marginBottom: 10, ...shadows.small,
  },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
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
});
