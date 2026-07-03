import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, RefreshControl,
  TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { colors, shadows, radius } from "../../constants/theme";
import { useSettings } from "../../contexts/SettingsContext";

const TABS = ["Utilisateurs", "Logs", "Créer"];

export default function AdminUsersTab() {
  const { user } = useAuth();
  const { theme, baseFontSize, t } = useSettings();
  const [activeTab, setActiveTab] = useState("Utilisateurs");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Formulaire création
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "",
    password: "", role: "radiologist"
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchLogs();
    // WebSocket rafraichit les logs en temps reel
  }, []);

  // WebSocket temps reel
  const handleWsMessage = useCallback((data) => {
    fetchLogs();
    if ([
      "user_created", "role_changed", "status_changed", "account_deleted"
    ].includes(data.type)) {
      fetchUsers();
    }
  }, []);
  useWebSocket(handleWsMessage);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data || []);
    } catch (e) {
      console.log("Erreur users:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await api.get("/audit/audit/logs?limit=100&per_page=100");
      setLogs(res.data?.logs || res.data?.items || []);
    } catch (e) {
      console.log("Erreur logs:", e.response?.status, e.message);
    } finally {
      setLogsLoading(false);
    }
  };

  const changeRole = (userId, currentRole, userName) => {
    const roles = [
      { label: "👤 Utilisateur", value: "doctor" },
      { label: "🔬 Radiologue", value: "radiologist" },
      { label: "⚙️ Administrateur", value: "admin" },
    ];
    Alert.alert(
      `Rôle de ${userName}`,
      `Actuel : ${getRoleLabel(currentRole)}`,
      [
        ...roles.filter(r => r.value !== currentRole).map(r => ({
          text: r.label,
          onPress: async () => {
            try {
              await api.put(`/auth/users/${userId}/role`, { role: r.value });
              Alert.alert("✅ Modifié", `${userName} → ${r.label}`);
              fetchUsers();
            } catch (e) {
              Alert.alert("Erreur", e.response?.data?.detail || "Impossible");
            }
          }
        })),
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  const toggleStatus = async (userId, isActive, userName) => {
    Alert.alert(
      isActive ? "Désactiver" : "Activer",
      `${isActive ? "Désactiver" : "Activer"} le compte de ${userName} ?`,
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
              Alert.alert("Erreur", "Impossible de modifier");
            }
          }
        }
      ]
    );
  };

  const deleteUser = (userId, userName) => {
    Alert.alert(
      "🗑️ Supprimer définitivement",
      `Voulez-vous vraiment supprimer le compte de ${userName} ?

Cette action est irréversible et l'utilisateur sera notifié par email.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/auth/users/${userId}`);
              Alert.alert("✅ Supprimé", `Le compte de ${userName} a été supprimé.`);
              fetchUsers();
            } catch (e) {
              Alert.alert("Erreur", e.response?.data?.detail || "Impossible de supprimer");
            }
          }
        }
      ]
    );
  };

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires");
      return;
    }
    if (form.password.length < 8) {
      Alert.alert("Erreur", "Mot de passe minimum 8 caractères");
      return;
    }
    setCreating(true);
    try {
      await api.post("/auth/users/create", form);
      Alert.alert("✅ Compte créé", `${form.first_name} ${form.last_name} (${getRoleLabel(form.role)})`);
      setForm({ first_name: "", last_name: "", email: "", password: "", role: "radiologist" });
      fetchUsers();
      setActiveTab("Utilisateurs");
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de créer le compte");
    } finally {
      setCreating(false);
    }
  };

  const getRoleLabel = (role) => ({
    doctor: "Utilisateur", radiologist: "Radiologue",
    admin: "Admin"
  })[role] || role;

  const getRoleColor = (role) => ({
    doctor: colors.primary, radiologist: "#8B5CF6", admin: "#B45309"
  })[role] || colors.primary;

  const getInitials = (first, last) =>
    `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const getLogIcon = (action) => {
    if (!action) return "📋";
    const a = action.toLowerCase();
    if (a.includes("login") || a.includes("connect")) return "🔑";
    if (a.includes("logout")) return "🚪";
    if (a.includes("create") || a.includes("upload")) return "➕";
    if (a.includes("delete") || a.includes("remove")) return "🗑️";
    if (a.includes("analys")) return "🔬";
    if (a.includes("report")) return "📄";
    if (a.includes("patient")) return "👥";
    return "📋";
  };

  const filtered = users.filter(u =>
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    doctors: users.filter(u => u.role === "doctor").length,
    radiologists: users.filter(u => u.role === "radiologist").length,
  };

  const renderUser = ({ item }) => {
    const roleColor = getRoleColor(item.role);
    const isMe = item.id === user?.id;
    return (
      <View style={[styles.card, !item.is_active && { opacity: 0.5 }]}>
        <View style={styles.cardRow}>
          <View style={[styles.avatar, { backgroundColor: roleColor + "20" }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {getInitials(item.first_name, item.last_name)}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.cardName}>{item.first_name} {item.last_name}</Text>
              {isMe && <Text style={{ fontSize: 10, color: colors.textMuted }}>(vous)</Text>}
              {!item.is_active && (
                <View style={styles.inactiveDot}>
                  <Text style={styles.inactiveDotText}>Inactif</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardEmail}>{item.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + "15" }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>{getRoleLabel(item.role)}</Text>
            </View>
          </View>
        </View>
        {!isMe && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => changeRole(item.id, item.role, `${item.first_name} ${item.last_name}`)}
            >
              <Text style={styles.actionText}>🔄 Changer rôle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, item.is_active ? styles.dangerBtn : styles.successBtn]}
              onPress={() => toggleStatus(item.id, item.is_active, `${item.first_name} ${item.last_name}`)}
            >
              <Text style={[styles.actionText, { color: item.is_active ? colors.danger : colors.normal }]}>
                {item.is_active ? "🚫 Désactiver" : "✅ Activer"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => deleteUser(item.id, `${item.first_name} ${item.last_name}`)}
            >
              <Text style={[styles.actionText, { color: "#DC2626" }]}>🗑️ Supprimer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderLog = ({ item }) => (
    <View style={styles.logCard}>
      <Text style={styles.logIcon}>{getLogIcon(item.action)}</Text>
      <View style={styles.logInfo}>
        <Text style={styles.logAction}>{item.action || "Action"}</Text>
        <Text style={styles.logUser}>{item.user_email || item.user_id || "—"}</Text>
        <Text style={styles.logDate}>
          {item.created_at ? new Date(item.created_at).toLocaleString("fr-FR") : "—"}
        </Text>
        {item.details && (
          <Text style={styles.logDetails} numberOfLines={1}>{JSON.stringify(item.details)}</Text>
        )}
      </View>
    </View>
  );

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#B45309" />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme?.bg }]}>
      <StatusBar backgroundColor="#92400E" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚙️ Administration</Text>
        <Text style={styles.headerSub}>{users.length} compte(s) · {logs.length} logs</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Total", value: stats.total },
          { label: "Actifs", value: stats.active },
          { label: "Utilisateurs", value: stats.doctors },
          { label: "Radiologues", value: stats.radiologists },
        ].map((s, i) => (
          <View key={i} style={styles.statBox}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "Utilisateurs" ? "👥 " : tab === "Logs" ? "📋 " : "➕ "}{tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu par onglet */}
      {activeTab === "Utilisateurs" && (
        <>
          <View style={styles.searchWrapper}>
            <View style={styles.searchBox}>
              <Text>🔍 </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Text style={{ color: colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderUser}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchUsers(); }}
                colors={["#B45309"]}
              />
            }
          />
        </>
      )}

      {activeTab === "Logs" && (
        <>
          <View style={styles.logsHeader}>
            <Text style={styles.logsHeaderText}>
              📋 {logs.length} action(s) enregistrée(s)
            </Text>
            <TouchableOpacity onPress={fetchLogs} style={styles.refreshBtn}>
              <Text style={styles.refreshBtnText}>🔄 Actualiser</Text>
            </TouchableOpacity>
          </View>
          {logsLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#B45309" />
              <Text style={{ marginTop: 12, color: colors.textSecondary }}>Chargement des logs...</Text>
            </View>
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(item, i) => String(item.id || i)}
              renderItem={renderLog}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); fetchLogs(); }}
                  colors={["#B45309"]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyLogs}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>Aucun log disponible</Text>
                  <Text style={{ color: colors.textMuted, marginTop: 6 }}>
                    Les actions apparaîtront ici automatiquement
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {activeTab === "Créer" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.createForm}>
            <View style={styles.createCard}>
              <Text style={styles.createTitle}>Créer un nouveau compte</Text>

              {[
                { key: "first_name", label: "Prénom *", placeholder: "Jean" },
                { key: "last_name", label: "Nom *", placeholder: "Dupont" },
                { key: "email", label: "Email *", placeholder: "jean@aria.com", keyboard: "email-address" },
                { key: "password", label: "Mot de passe *", placeholder: "Min. 8 caractères", secure: true },
              ].map(f => (
                <View key={f.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={form[f.key]}
                    onChangeText={v => setForm({ ...form, [f.key]: v })}
                    keyboardType={f.keyboard || "default"}
                    secureTextEntry={f.secure || false}
                    autoCapitalize={f.key === "email" ? "none" : "words"}
                  />
                </View>
              ))}

              <Text style={styles.fieldLabel}>Rôle *</Text>
              <View style={styles.rolesGrid}>
                {[
                  { value: "radiologist", label: "🔬 Radiologue" },
                  { value: "admin", label: "⚙️ Admin" },
                  { value: "doctor", label: "👤 Utilisateur" },
                  
                  
                ].map(r => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.roleBtn, form.role === r.value && styles.roleBtnActive]}
                    onPress={() => setForm({ ...form, role: r.value })}
                  >
                    <Text style={[styles.roleBtnText, form.role === r.value && styles.roleBtnTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.createBtnText}>Créer le compte →</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#B45309",
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  statsRow: {
    flexDirection: "row", backgroundColor: "#B45309",
    paddingHorizontal: 16, paddingBottom: 16, gap: 8,
  },
  statBox: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md, padding: 10, alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  tabsRow: {
    flexDirection: "row", backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: "#B45309" },
  tabText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  tabTextActive: { color: "#B45309" },
  searchWrapper: { padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg, paddingHorizontal: 12, height: 42,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 14, marginBottom: 12, ...shadows.small,
  },
  cardRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: "700" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  cardEmail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  roleBadge: { marginTop: 5, alignSelf: "flex-start", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  roleText: { fontSize: 11, fontWeight: "700" },
  inactiveDot: { backgroundColor: colors.dangerBg, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  inactiveDotText: { fontSize: 10, color: colors.danger, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, alignItems: "center", padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  dangerBtn: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  successBtn: { borderColor: colors.normal, backgroundColor: colors.normalBg },
  deleteBtn: { borderColor: "#DC2626", backgroundColor: "#FEE2E2" },
  actionText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  logCard: {
    flexDirection: "row", backgroundColor: colors.surface,
    borderRadius: radius.md, padding: 12, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: "#B45309",
  },
  logIcon: { fontSize: 22, marginRight: 12, marginTop: 2 },
  logInfo: { flex: 1 },
  logAction: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  logUser: { fontSize: 12, color: colors.primary, marginTop: 2 },
  logDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  logDetails: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  emptyLogs: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.textSecondary },
  createForm: { padding: 16, paddingBottom: 40 },
  createCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, ...shadows.small },
  createTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, marginBottom: 8 },
  fieldInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.textPrimary,
  },
  rolesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  roleBtn: {
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.surfaceSecondary,
  },
  roleBtnActive: { borderColor: "#B45309", backgroundColor: "#FEF3C7" },
  roleBtnText: { fontSize: 13, color: colors.textSecondary },
  roleBtnTextActive: { color: "#B45309", fontWeight: "700" },
  createBtn: {
    backgroundColor: "#B45309", borderRadius: radius.lg,
    padding: 16, alignItems: "center", ...shadows.medium,
  },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  logsHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  logsHeaderText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  refreshBtn: {
    backgroundColor: "#FEF3C7", borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "#B45309",
  },
  refreshBtnText: { fontSize: 12, color: "#B45309", fontWeight: "700" },
});
