import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, RefreshControl, TextInput
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { colors, shadows, radius } from "../../constants/theme";
import { useSettings } from "../../contexts/SettingsContext";

export default function AdminUsersScreen() {
  const router = useRouter();
  const { theme, baseFontSize, t } = useSettings();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") {
      Alert.alert("Accès refusé", "Seuls les administrateurs peuvent accéder à cette page.");
      router.back();
      return;
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data || []);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const changeRole = (userId, currentRole, userName) => {
    const roles = [
      { label: "👨‍⚕️ Médecin", value: "doctor" },
      { label: "🔬 Radiologue", value: "radiologist" },
      { label: "💉 Infirmier(e)", value: "nurse" },
      { label: "⚙️ Administrateur", value: "admin" },
      { label: "📋 Auditeur", value: "auditor" },
    ];

    Alert.alert(
      `Changer le rôle de ${userName}`,
      `Rôle actuel : ${getRoleLabel(currentRole)}`,
      [
        ...roles
          .filter(r => r.value !== currentRole)
          .map(r => ({
            text: r.label,
            onPress: () => confirmRoleChange(userId, r.value, userName, r.label),
          })),
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  const confirmRoleChange = async (userId, newRole, userName, roleLabel) => {
    Alert.alert(
      "Confirmer",
      `Changer le rôle de ${userName} en ${roleLabel} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: async () => {
            try {
              await api.put(`/auth/users/${userId}/role`, { role: newRole });
              Alert.alert("✅ Rôle modifié", `${userName} est maintenant ${roleLabel}`);
              fetchUsers();
            } catch (e) {
              Alert.alert("Erreur", e.response?.data?.detail || "Impossible de modifier le rôle");
            }
          }
        }
      ]
    );
  };

  const toggleUserStatus = async (userId, isActive, userName) => {
    const action = isActive ? "désactiver" : "activer";
    Alert.alert(
      `${isActive ? "Désactiver" : "Activer"} le compte`,
      `Voulez-vous ${action} le compte de ${userName} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: isActive ? "Désactiver" : "Activer",
          style: isActive ? "destructive" : "default",
          onPress: async () => {
            try {
              await api.put(`/auth/users/${userId}/status`, { is_active: !isActive });
              fetchUsers();
            } catch (e) {
              Alert.alert("Erreur", e.response?.data?.detail || "Impossible de modifier le statut");
            }
          }
        }
      ]
    );
  };

  const getRoleLabel = (role) => ({
    doctor: "Utilisateur", radiologist: "Radiologue", admin: "Admin"
  })[role] || role;

  const getRoleColor = (role) => ({
    doctor: colors.primary, radiologist: "#8B5CF6",
    nurse: colors.normal, admin: colors.high, auditor: colors.textMuted
  })[role] || colors.primary;

  const getInitials = (first, last) =>
    `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const filteredUsers = users.filter(u =>
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase()
      .includes(search.toLowerCase())
  );

  const renderUser = ({ item }) => {
    const roleColor = getRoleColor(item.role);
    const isCurrentUser = item.id === user?.id;

    return (
      <View style={[styles.card, !item.is_active && styles.cardInactive]}>
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: roleColor + "20" }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {getInitials(item.first_name, item.last_name)}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardName}>
                {item.first_name} {item.last_name}
                {isCurrentUser && <Text style={styles.youBadge}> (vous)</Text>}
              </Text>
              {!item.is_active && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveBadgeText}>Inactif</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardEmail}>{item.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + "20" }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>
                {getRoleLabel(item.role)}
              </Text>
            </View>
          </View>
        </View>

        {!isCurrentUser && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => changeRole(item.id, item.role, `${item.first_name} ${item.last_name}`)}
            >
              <Text style={styles.actionBtnIcon}>🔄</Text>
              <Text style={styles.actionBtnText}>Changer rôle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, item.is_active ? styles.actionBtnDanger : styles.actionBtnSuccess]}
              onPress={() => toggleUserStatus(item.id, item.is_active, `${item.first_name} ${item.last_name}`)}
            >
              <Text style={styles.actionBtnIcon}>{item.is_active ? "🚫" : "✅"}</Text>
              <Text style={[styles.actionBtnText, item.is_active ? { color: colors.danger } : { color: colors.normal }]}>
                {item.is_active ? "Désactiver" : "Activer"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  // Statistiques
  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    doctors: users.filter(u => u.role === "doctor").length,
    radiologists: users.filter(u => u.role === "radiologist").length,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme?.bg }]}>
      <StatusBar backgroundColor={colors.primaryDark} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des utilisateurs</Text>
        <Text style={styles.headerSub}>{users.length} compte(s) enregistré(s)</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Total", value: stats.total, color: colors.primary },
          { label: "Actifs", value: stats.active, color: colors.normal },
          { label: "Utilisateurs", value: stats.doctors, color: colors.primary },
          { label: "Radiologues", value: stats.radiologists, color: "#8B5CF6" },
        ].map((s, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Recherche */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un utilisateur..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchUsers(); }}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>Aucun utilisateur trouvé</Text>
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
  },
  backBtn: { marginBottom: 8 },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 16 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md, padding: 10, alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2, fontWeight: "600" },

  searchWrapper: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg, paddingHorizontal: 12, height: 42,
    borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  clearBtn: { fontSize: 16, color: colors.textMuted, padding: 4 },

  list: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14,
    marginBottom: 12, ...shadows.small,
  },
  cardInactive: { opacity: 0.6 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: "700" },
  cardInfo: { flex: 1 },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  youBadge: { fontSize: 12, color: colors.textMuted, fontWeight: "400" },
  inactiveBadge: {
    backgroundColor: colors.dangerBg, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  inactiveBadgeText: { fontSize: 10, color: colors.danger, fontWeight: "700" },
  cardEmail: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  roleBadge: {
    marginTop: 6, alignSelf: "flex-start",
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  roleText: { fontSize: 11, fontWeight: "700" },

  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: radius.md, padding: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
  },
  actionBtnDanger: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  actionBtnSuccess: { borderColor: colors.normal, backgroundColor: colors.normalBg },
  actionBtnIcon: { fontSize: 16 },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },

  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
});
