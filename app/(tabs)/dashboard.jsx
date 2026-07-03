import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Dimensions
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import api from "../../services/api";
import { colors, shadows, radius, palette } from "../../constants/theme";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

// ─── Composants réutilisables ─────────────────────────────────────────────────

function StatCard({ icon, value, label, color, bg, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { width: CARD_WIDTH }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.statIconWrap, { backgroundColor: bg }]}>
        <Text style={styles.statIcon}>{icon}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionButton({ icon, label, color, bg, onPress }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIconWrap, { backgroundColor: bg }]}>
        <Text style={styles.actionIcon}>{icon}</Text>
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Header({ color1, color2, greeting, name, role, roleIcon }) {
  return (
    <View style={[styles.header, { backgroundColor: color1 }]}>
      <StatusBar backgroundColor={color1} barStyle="light-content" />
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.userName} numberOfLines={1}>{name}</Text>
          <View style={[styles.rolePill, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Text style={styles.rolePillText}>{roleIcon} {role}</Text>
          </View>
        </View>
        <View style={[styles.avatarCircle, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <Text style={styles.avatarText}>
            {name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??"}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Dashboard Utilisateur ────────────────────────────────────────────────────
function DoctorDashboard({ user, stats, loading, refreshing, onRefresh, router }) {
  const { theme } = useSettings();
  const bg = theme?.bg || colors.background;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 6)  return "Bonne nuit 🌙";
    if (h < 12) return "Bonjour ☀️";
    if (h < 18) return "Bon après-midi 🌤";
    return "Bonsoir 🌙";
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <Header
          color1={palette.navy}
          greeting={getGreeting()}
          name={`${user?.firstName} ${user?.lastName}`}
          role="Utilisateur"
          roleIcon="👨‍⚕️"
        />

        <View style={[styles.body, { backgroundColor: bg }]}>

          {/* Stats */}
          <SectionTitle title="VUE D'ENSEMBLE" />
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard
                icon="👥" value={stats?.total_patients ?? "0"}
                label="Patients" color={colors.primary} bg={colors.primaryBg}
                onPress={() => router.push("/(tabs)/patients")}
              />
              <StatCard
                icon="🔬" value={stats?.total_analyses ?? "0"}
                label="Analyses" color={palette.violet} bg={palette.violetLight}
              />
              <StatCard
                icon="🚨" value={stats?.critical_analyses ?? "0"}
                label="Critiques" color={colors.danger} bg={colors.dangerBg}
              />
              <StatCard
                icon="⏳" value={stats?.pending_analyses ?? "0"}
                label="En attente" color={colors.info} bg={colors.infoBg}
              />
            </View>
          )}

          {/* Actions rapides */}
          <SectionTitle title="ACTIONS RAPIDES" />
          <View style={styles.actionsGrid}>
            <ActionButton icon="➕" label="Nouveau patient" color={colors.primary} bg={colors.primaryBg} onPress={() => router.push("/patient/new")} />
            <ActionButton icon="👥" label="Mes patients" color={palette.violet} bg={palette.violetLight} onPress={() => router.push("/(tabs)/patients")} />
            <ActionButton icon="💬" label="Consultations" color={colors.success} bg={colors.successBg} onPress={() => router.push("/(tabs)/chat")} />
          </View>

          {/* Banner IA */}
          <View style={styles.iaBanner}>
            <View style={styles.iaBannerLeft}>
              <Text style={styles.iaBannerTitle}>Intelligence Artificielle</Text>
              <Text style={styles.iaBannerText}>Analysez vos radiographies thoraciques et détectez les fractures en quelques secondes.</Text>
              <TouchableOpacity style={styles.iaBannerBtn} onPress={() => router.push("/(tabs)/patients")}>
                <Text style={styles.iaBannerBtnText}>Commencer une analyse →</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.iaBannerEmoji}>🤖</Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Dashboard Radiologue ─────────────────────────────────────────────────────
function RadiologistDashboard({ user, stats, loading, refreshing, onRefresh, router }) {
  const { theme } = useSettings();
  const bg = theme?.bg || colors.background;
  const [consultations, setConsultations] = useState([]);
  const [loadingConsult, setLoadingConsult] = useState(true);

  useEffect(() => { fetchConsultations(); }, []);

  const fetchConsultations = async () => {
    try {
      const res = await api.get("/chat/discussions");
      const all = res.data.discussions || res.data || [];
      setConsultations(all.filter(d => d.status === "open"));
    } catch (e) {}
    finally { setLoadingConsult(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { onRefresh(); fetchConsultations(); }} colors={[palette.violet]} />}
      >
        <Header
          color1={palette.violet}
          greeting="Tableau de bord"
          name={`Dr. ${user?.firstName} ${user?.lastName}`}
          role="Radiologue"
          roleIcon="🔬"
        />

        <View style={[styles.body, { backgroundColor: bg }]}>

          <SectionTitle title="STATISTIQUES" />
          <View style={styles.statsGrid}>
            <StatCard icon="💬" value={consultations.length} label="Consultations ouvertes" color={palette.violet} bg={palette.violetLight} onPress={() => router.push("/(tabs)/chat")} />
            <StatCard icon="👥" value={stats?.total_patients ?? "0"} label="Patients suivis" color={colors.primary} bg={colors.primaryBg} />
            <StatCard icon="🔬" value={stats?.total_analyses ?? "0"} label="Analyses effectuées" color={colors.success} bg={colors.successBg} />
            <StatCard icon="🚨" value={stats?.critical_analyses ?? "0"} label="Cas critiques" color={colors.danger} bg={colors.dangerBg} />
          </View>

          <SectionTitle title="ACCÈS RAPIDES" />
          <View style={styles.actionsGrid}>
            <ActionButton icon="💬" label="Consultations" color={palette.violet} bg={palette.violetLight} onPress={() => router.push("/(tabs)/chat")} />
            <ActionButton icon="👥" label="Mes patients" color={colors.primary} bg={colors.primaryBg} onPress={() => router.push("/(tabs)/patients")} />
            <ActionButton icon="👤" label="Mon profil" color={colors.success} bg={colors.successBg} onPress={() => router.push("/(tabs)/profil")} />
          </View>

          <SectionTitle title="CONSULTATIONS EN ATTENTE" action={consultations.length > 0 ? "Voir tout" : undefined} onAction={() => router.push("/(tabs)/chat")} />

          {loadingConsult ? (
            <ActivityIndicator color={palette.violet} style={{ marginVertical: 20 }} />
          ) : consultations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>Aucune consultation en attente</Text>
              <Text style={styles.emptyText}>Vous êtes à jour !</Text>
            </View>
          ) : (
            consultations.slice(0, 3).map((c, i) => (
              <TouchableOpacity key={i} style={styles.consultRow} onPress={() => router.push(`/chat/${c.id}`)}>
                <View style={[styles.consultDot, { backgroundColor: palette.violet }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.consultTitle}>Consultation médicale</Text>
                  <Text style={styles.consultDate}>{c.updated_at ? new Date(c.updated_at).toLocaleString("fr-FR") : ""}</Text>
                </View>
                <View style={[styles.consultBadge, { backgroundColor: palette.violetLight }]}>
                  <Text style={[styles.consultBadgeText, { color: palette.violet }]}>Ouverte</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Dashboard Admin ──────────────────────────────────────────────────────────
function AdminDashboard({ user, stats, loading, refreshing, onRefresh, router }) {
  const { theme } = useSettings();
  const bg = theme?.bg || colors.background;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.amber]} />}
      >
        <Header
          color1={palette.navy}
          greeting="Administration"
          name={`${user?.firstName} ${user?.lastName}`}
          role="Administrateur"
          roleIcon="⚙️"
        />

        <View style={[styles.body, { backgroundColor: bg }]}>

          <SectionTitle title="STATISTIQUES GLOBALES" />
          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator color={palette.amber} size="large" /></View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard icon="👥" value={stats?.total_patients ?? "0"} label="Patients total" color={palette.amber} bg={palette.amberLight} />
              <StatCard icon="🔬" value={stats?.total_analyses ?? "0"} label="Analyses total" color={palette.violet} bg={palette.violetLight} />
              <StatCard icon="🚨" value={stats?.critical_analyses ?? "0"} label="Cas critiques" color={colors.danger} bg={colors.dangerBg} />
              <StatCard icon="⏳" value={stats?.pending_analyses ?? "0"} label="En attente" color={colors.info} bg={colors.infoBg} />
            </View>
          )}

          <SectionTitle title="GESTION" />
          {[
            { icon: "⚙️", title: "Gestion des utilisateurs", desc: "Comptes, rôles et permissions", color: palette.amber, bg: palette.amberLight, route: "/(tabs)/admin_users" },
            { icon: "🏥", title: "Dossiers patients", desc: "Tous les dossiers médicaux", color: colors.primary, bg: colors.primaryBg, route: "/(tabs)/patients" },
            { icon: "💬", title: "Consultations", desc: "Historique des échanges", color: palette.violet, bg: palette.violetLight, route: "/(tabs)/chat" },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={styles.adminRow} onPress={() => router.push(item.route)} activeOpacity={0.7}>
              <View style={[styles.adminRowIcon, { backgroundColor: item.bg }]}>
                <Text style={styles.adminRowEmoji}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.adminRowTitle, { color: item.color }]}>{item.title}</Text>
                <Text style={styles.adminRowDesc}>{item.desc}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchStats(); }, []);

  // Rafraichissement temps reel via WebSocket
  const handleWsMessage = useCallback((data) => {
    if ([
      "new_message", "review_completed", "new_discussion",
      "role_changed", "status_changed", "account_deleted",
      "analysis_validated", "analysis_rejected"
    ].includes(data.type)) {
      fetchStats();
    }
  }, []);
  useWebSocket(handleWsMessage);

  const fetchStats = async () => {
    try {
      const res = await api.get("/patients/stats/summary");
      setStats(res.data);
    } catch (e) {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const props = { user, stats, loading, refreshing, onRefresh: () => { setRefreshing(true); fetchStats(); }, router };

  if (user?.role === "radiologist") return <RadiologistDashboard {...props} />;
  if (user?.role === "admin") return <AdminDashboard {...props} />;
  return <DoctorDashboard {...props} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingTop: 52, paddingBottom: 28, paddingHorizontal: 20 },
  headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flex: 1, marginRight: 12 },
  greeting: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: "500", marginBottom: 4 },
  userName: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  rolePill: { marginTop: 8, alignSelf: "flex-start", borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  rolePillText: { fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: "600" },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#fff" },

  // Body
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  // Section
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 1 },
  sectionAction: { fontSize: 13, color: colors.primary, fontWeight: "600" },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: 16,
    alignItems: "flex-start",
    ...shadows.small,
  },
  statIconWrap: { width: 44, height: 44, borderRadius: radius.md, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "500" },

  // Loading
  loadingBox: { height: 160, justifyContent: "center", alignItems: "center" },

  // Actions
  actionsGrid: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: 14,
    alignItems: "center", ...shadows.small,
  },
  actionIconWrap: { width: 46, height: 46, borderRadius: radius.lg, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },

  // IA Banner
  iaBanner: {
    backgroundColor: palette.navy,
    borderRadius: radius.xxl, padding: 20,
    flexDirection: "row", alignItems: "center",
    marginTop: 24, marginBottom: 8,
    ...shadows.medium,
  },
  iaBannerLeft: { flex: 1, marginRight: 12 },
  iaBannerTitle: { fontSize: 15, fontWeight: "800", color: "#fff", marginBottom: 6 },
  iaBannerText: { fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 18, marginBottom: 14 },
  iaBannerBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 8,
    alignSelf: "flex-start",
  },
  iaBannerBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  iaBannerEmoji: { fontSize: 52 },

  // Consultations
  consultRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: 14, marginBottom: 8, ...shadows.xs,
  },
  consultDot: { width: 10, height: 10, borderRadius: 5 },
  consultTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  consultDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  consultBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  consultBadgeText: { fontSize: 11, fontWeight: "700" },

  // Empty
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: 28, alignItems: "center", ...shadows.xs,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  emptyText: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  // Admin
  adminRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: 16, marginBottom: 10, ...shadows.xs,
  },
  adminRowIcon: { width: 52, height: 52, borderRadius: radius.lg, justifyContent: "center", alignItems: "center" },
  adminRowEmoji: { fontSize: 24 },
  adminRowTitle: { fontSize: 15, fontWeight: "700" },
  adminRowDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
});
