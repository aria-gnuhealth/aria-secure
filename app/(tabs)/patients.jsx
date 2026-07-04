import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { Swipeable } from "react-native-gesture-handler";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Alert, StatusBar
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import api from "../../services/api";
import { colors, shadows, radius, palette } from "../../constants/theme";

const AVATAR_COLORS = [
  { bg: "#EBF4FB", text: "#1F6B9E" },
  { bg: "#F3F0FF", text: "#7C3AED" },
  { bg: "#FEF3C7", text: "#B45309" },
  { bg: "#ECFDF5", text: "#059669" },
  { bg: "#FEF2F2", text: "#DC2626" },
  { bg: "#F0F9FF", text: "#0284C7" },
];

export default function PatientsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, t } = useSettings();
  const [patients, setPatients] = useState([]);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const bg = theme?.bg || colors.background;
  const surface = theme?.surface || colors.surface;

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    try {
      const endpoint = false
        ? "/patients/radiologist/my-patients"
        : "/patients?page=1&per_page=50";
      const res = await api.get(endpoint);
      setPatients(res.data.items || res.data || []);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de charger les patients");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const searchPatients = async (query) => {
    setSearch(query);
    if (query.length < 2) { fetchPatients(); return; }
    try {
      const res = await api.get(`/patients/search?q=${query}`);
      setPatients(res.data || []);
    } catch (e) {}
  };

  const getAvatarStyle = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const getInitials = (first, last) => `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const getAge = (dob) => {
    if (!dob) return null;
    const age = Math.floor((Date.now() - new Date(dob)) / 31557600000);
    return `${age} ans`;
  };

  const deletePatient = (patientId, patientName) => {
    Alert.alert(
      "Supprimer le patient",
      `Voulez-vous supprimer ${patientName} ? Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/patients/${patientId}`);
              setPatients(prev => prev.filter(p => p.id !== patientId));
            } catch (e) {
              Alert.alert("Erreur", e.response?.data?.detail || "Impossible de supprimer");
            }
          }
        }
      ]
    );
  };

  const renderRightActions = (patientId, patientName) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => deletePatient(patientId, patientName)}
    >
      <Text style={styles.deleteActionIcon}>🗑️</Text>
      <Text style={styles.deleteActionText}>Supprimer</Text>
    </TouchableOpacity>
  );

  const renderPatient = ({ item, index }) => {
    const av = getAvatarStyle(item.first_name);
    const age = getAge(item.date_of_birth);
    const gender = item.gender === "M" ? "Homme" : item.gender === "F" ? "Femme" : null;

    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item.id, item.first_name + ' ' + item.last_name)}
        overshootRight={false}
      >
      <TouchableOpacity
        style={[styles.card, { backgroundColor: surface }]}
        onPress={() => router.push(`/patient/${item.id}`)}
        activeOpacity={0.65}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: av.bg }]}>
          <Text style={[styles.avatarText, { color: av.text }]}>
            {getInitials(item.first_name, item.last_name)}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: theme?.text || colors.textPrimary }]}>
            {item.first_name} {item.last_name}
          </Text>
          <View style={styles.cardMetaRow}>
            {age && <Text style={styles.cardMeta}>{age}</Text>}
            {age && gender && <Text style={styles.cardMetaDot}>·</Text>}
            {gender && <Text style={styles.cardMeta}>{gender}</Text>}
          </View>
          <Text style={styles.cardRecord}>#{item.medical_record_number}</Text>
        </View>

        {/* Chevron */}
        <View style={styles.chevronWrap}>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>
      </Swipeable>
    );
  };

  if (loading) return (
    <View style={[styles.loadingWrap, { backgroundColor: bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Chargement des patients...</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar backgroundColor={palette.navy} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Patients</Text>
            <Text style={styles.headerSub}>
              {patients.length} dossier{patients.length > 1 ? "s" : ""}
              {user?.role === "radiologist" ? " · Vos patients" : " · Tous les dossiers"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/patient/new")}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnIcon}>＋</Text>
            <Text style={styles.addBtnText}>Nouveau</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[
          styles.searchBox,
          focused && { borderColor: colors.primary, borderWidth: 1.5 }
        ]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: theme?.text || colors.textPrimary }]}
            placeholder="Rechercher un patient..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={searchPatients}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => searchPatients("")}
            >
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Liste */}
      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        renderItem={renderPatient}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPatients(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={() => patients.length > 0 ? (
          <Text style={styles.listHeader}>
            {search ? `Résultats pour "${search}"` : "Tous les patients"}
          </Text>
        ) : null}
        ListEmptyComponent={() => (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIcon}>🏥</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {search ? "Aucun résultat" : "Aucun patient"}
            </Text>
            <Text style={styles.emptyText}>
              {search
                ? `Aucun patient trouvé pour "${search}"`
                : "Ajoutez votre premier dossier patient"
              }
            </Text>
            {!search && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/patient/new")}
              >
                <Text style={styles.emptyBtnText}>＋ Ajouter un patient</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, color: colors.textMuted },

  // Header
  header: {
    backgroundColor: palette.navy,
    paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 3 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10,
  },
  addBtnIcon: { fontSize: 16, color: "#fff", fontWeight: "700" },
  addBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Search
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.xl, paddingHorizontal: 14, height: 46,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#fff" },
  clearBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  clearBtnText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  // List
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  listHeader: {
    fontSize: 11, fontWeight: "700", color: colors.textMuted,
    letterSpacing: 1, marginBottom: 10, marginTop: 8,
  },
  separator: { height: 8 },

  // Card
  deleteAction: {
    backgroundColor: "#E74C3C",
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    marginVertical: 6,
    borderRadius: 12,
  },
  deleteActionIcon: { fontSize: 20 },
  deleteActionText: { color: "#fff", fontSize: 12, fontWeight: "700", marginTop: 2 },
  card: {
    flexDirection: "row", alignItems: "center",
    borderRadius: radius.xl, padding: 14,
    ...shadows.small,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: "center", alignItems: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 18, fontWeight: "800" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 3, gap: 4 },
  cardMeta: { fontSize: 12, color: colors.textSecondary },
  cardMetaDot: { fontSize: 12, color: colors.textMuted },
  cardRecord: { fontSize: 11, color: colors.textMuted, marginTop: 3, fontWeight: "500" },
  chevronWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.gray100,
    justifyContent: "center", alignItems: "center",
  },
  chevron: { fontSize: 18, color: colors.textMuted, marginTop: -1 },

  // Empty
  emptyWrap: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryBg,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    marginTop: 24, backgroundColor: colors.primary,
    borderRadius: radius.full, paddingHorizontal: 24, paddingVertical: 14,
    ...shadows.colored(colors.primary),
  },
  emptyBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
