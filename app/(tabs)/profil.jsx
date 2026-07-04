import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, Linking
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { colors, shadows, radius, palette } from "../../constants/theme";
import api from "../../services/api";

export default function ProfilScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const { user, logout } = useAuth();

  const bg = theme?.bg || colors.background;
  const surface = theme?.surface || colors.surface;
  const [subscription, setSubscription] = useState(null);

  useEffect(() => { fetchSubscription(); }, []);
  useFocusEffect(useCallback(() => { fetchSubscription(); }, []));

  const fetchSubscription = async () => {
    try {
      const res = await api.get("/subscription/status");
      setSubscription(res.data);
    } catch (e) {}
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric"
    });
  };

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Voulez-vous vraiment vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Déconnexion", style: "destructive", onPress: async () => await logout() }
      ]
    );
  };

  const getRoleConfig = (role) => ({
    doctor:     { label: "Utilisateur",    color: colors.primary,  bg: colors.primaryBg,       icon: "👨‍⚕️" },
    radiologist:{ label: "Radiologue",     color: palette.violet,  bg: palette.violetLight,    icon: "🔬" },
    admin:      { label: "Administrateur", color: palette.amber,   bg: palette.amberLight,     icon: "⚙️" },
    nurse:      { label: "Utilisateur",    color: colors.primary,  bg: colors.primaryBg,       icon: "👤" },
  })[role] || { label: role, color: colors.primary, bg: colors.primaryBg, icon: "👤" };

  const getInitials = (first, last) =>
    `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const roleConf = getRoleConfig(user?.role);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar backgroundColor={palette.navy} barStyle="light-content" />

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mon profil</Text>
          <Text style={styles.headerSub}>Gérez votre compte ARIA</Text>
        </View>

        {/* Carte identité */}
        <View style={[styles.identityCard, { backgroundColor: surface }]}>
          {/* Avatar */}
          <View style={[styles.avatarWrap, { backgroundColor: roleConf.bg }]}>
            <Text style={[styles.avatarText, { color: roleConf.color }]}>
              {getInitials(user?.firstName, user?.lastName)}
            </Text>
          </View>

          <Text style={[styles.fullName, { color: theme?.text || colors.textPrimary }]}>
            {user?.firstName} {user?.lastName}
          </Text>

          <View style={[styles.rolePill, { backgroundColor: roleConf.bg }]}>
            <Text style={styles.rolePillIcon}>{roleConf.icon}</Text>
            <Text style={[styles.rolePillText, { color: roleConf.color }]}>{roleConf.label}</Text>
          </View>

          <Text style={[styles.emailText, { color: theme?.textSecondary || colors.textSecondary }]}>
            {user?.email}
          </Text>
        </View>

        {/* Section Compte */}
        <Text style={[styles.sectionLabel, { color: theme?.textMuted || colors.textMuted }]}>COMPTE</Text>
        <View style={[styles.menuCard, { backgroundColor: surface }]}>
          <MenuItem
            icon="👤" label="Modifier le profil"
            onPress={() => router.push("/settings")}
            theme={theme}
          />
          <MenuItem
            icon="🔒" label="Modifier le mot de passe"
            onPress={() => router.push("/settings")}
            theme={theme}
            border
          />
          <MenuItem
            icon="⚙️" label="Paramètres"
            onPress={() => router.push("/settings")}
            theme={theme}
            border
          />
        </View>

        {/* Section Admin */}
        {user?.role === "admin" && (
          <>
            <Text style={[styles.sectionLabel, { color: theme?.textMuted || colors.textMuted }]}>ADMINISTRATION</Text>
            <View style={[styles.menuCard, { backgroundColor: surface }]}>
              <MenuItem
                icon="⚙️" label="Gestion des utilisateurs"
                onPress={() => router.push("/(tabs)/admin_users")}
                theme={theme}
                accent={palette.amber}
              />
            </View>
          </>
        )}

        {/* Premium - pas pour admin */}
        {user?.role !== "admin" && (
          <View>
          <Text style={[styles.sectionLabel, { color: theme?.textMuted || colors.textMuted }]}>ABONNEMENT</Text>
        {subscription?.is_premium ? (
          <View style={[styles.premiumActiveCard, { backgroundColor: surface }]}>
            <View style={styles.premiumActiveTop}>
              <Text style={styles.premiumActiveCrown}>👑</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumActiveTitle}>Vous êtes Premium</Text>
                <Text style={styles.premiumActiveSub}>
                  Expire le {formatDate(subscription.end_date)}
                </Text>
              </View>
              <View style={styles.premiumActiveBadge}>
                <Text style={styles.premiumActiveBadgeText}>ACTIF</Text>
              </View>
            </View>
            <View style={styles.premiumActiveFeatures}>
              {["Analyses IA illimitées", "Rapports PDF", "Chat illimité"].map((f, i) => (
                <View key={i} style={styles.premiumActiveFeature}>
                  <Text style={styles.premiumActiveFeatureCheck}>✓</Text>
                  <Text style={styles.premiumActiveFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.renewBtn} onPress={() => router.push("/payment")}>
              <Text style={styles.renewBtnText}>Renouveler · {subscription.days_remaining}j restants</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.premiumCard}
            onPress={() => { console.log("GO PAYMENT"); router.push("/payment"); }}
            activeOpacity={0.85}
          >
            <View style={styles.premiumLeft}>
              <Text style={styles.premiumCrown}>👑</Text>
              <View>
                <Text style={styles.premiumTitle}>Passer à Premium</Text>
                <Text style={styles.premiumSub}>Analyses illimitées · 2 000 XAF/mois</Text>
              </View>
            </View>
            <Text style={styles.premiumArrow}>›</Text>
          </TouchableOpacity>
            )}
          </View>
        )}

        {/* Section Support */}
        <Text style={[styles.sectionLabel, { color: theme?.textMuted || colors.textMuted }]}>SUPPORT</Text>
        <View style={[styles.menuCard, { backgroundColor: surface }]}>
          <MenuItem
            icon="📧" label="Contacter le support"
            sublabel="ariasecure.support@gmail.com"
            onPress={() => Linking.openURL("mailto:ariasecure.support@gmail.com?subject=" + encodeURIComponent("Support ARIA"))}
            theme={theme}
            border
          />
          <MenuItem
            icon="📖" label="À propos"
            sublabel="Guide complet d'utilisation"
            onPress={() => router.push("/guide")}
            theme={theme}
            border
          />
          <MenuItem
            icon="🛡️" label="Politique de confidentialité"
            onPress={() => Alert.alert("Confidentialité", "Vos données médicales sont chiffrées et conformes au RGPD.")}
            theme={theme}
            border
          />
          <MenuItem
            icon="ℹ️" label="Version ARIA"
            sublabel="1.0.0"
            theme={theme}
            border
          />
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, label, sublabel, onPress, theme, border, accent }) {
  const textColor = accent || (theme?.text || colors.textPrimary);
  return (
    <TouchableOpacity
      style={[styles.menuItem, border && { borderTopWidth: 1, borderTopColor: theme?.border || colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.65}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: (theme?.surfaceSecondary || colors.gray100) }]}>
        <Text style={styles.menuIcon}>{icon}</Text>
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, { color: textColor }]}>{label}</Text>
        {sublabel && <Text style={[styles.menuSublabel, { color: theme?.textMuted || colors.textMuted }]}>{sublabel}</Text>}
      </View>
      {onPress && <Text style={[styles.menuChevron, { color: theme?.textMuted || colors.textMuted }]}>›</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    backgroundColor: palette.navy,
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 3 },

  // Identity card
  identityCard: {
    marginHorizontal: 16, marginTop: 16,
    borderRadius: radius.xxl, padding: 24,
    alignItems: "center",
    ...shadows.medium,
  },
  avatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
  },
  avatarText: { fontSize: 32, fontWeight: "800" },
  fullName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3, marginBottom: 8 },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 7,
    marginBottom: 10,
  },
  rolePillIcon: { fontSize: 14 },
  rolePillText: { fontSize: 13, fontWeight: "700" },
  emailText: { fontSize: 13 },

  // Sections
  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1,
    marginHorizontal: 16, marginTop: 24, marginBottom: 8,
  },
  menuCard: {
    marginHorizontal: 16, borderRadius: radius.xl,
    overflow: "hidden", ...shadows.small,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    justifyContent: "center", alignItems: "center",
  },
  menuIcon: { fontSize: 17 },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: "600" },
  menuSublabel: { fontSize: 12, marginTop: 2 },
  menuChevron: { fontSize: 20 },

  // Premium actif
  premiumActiveCard: {
    marginHorizontal: 16, borderRadius: radius.xl,
    overflow: "hidden", ...shadows.small,
    borderWidth: 2, borderColor: "#FCD34D",
  },
  premiumActiveTop: {
    flexDirection: "row", alignItems: "center",
    padding: 16, gap: 12,
    backgroundColor: palette.navy,
  },
  premiumActiveCrown: { fontSize: 32 },
  premiumActiveTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  premiumActiveSub: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  premiumActiveBadge: {
    backgroundColor: "#FCD34D", borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  premiumActiveBadgeText: { fontSize: 10, fontWeight: "800", color: palette.navy },
  premiumActiveFeatures: { padding: 14, gap: 8 },
  premiumActiveFeature: { flexDirection: "row", alignItems: "center", gap: 8 },
  premiumActiveFeatureCheck: { fontSize: 14, color: colors.success, fontWeight: "800" },
  premiumActiveFeatureText: { fontSize: 14, color: colors.textPrimary, fontWeight: "500" },
  renewBtn: {
    margin: 14, marginTop: 0, borderRadius: radius.lg,
    paddingVertical: 12, alignItems: "center",
    backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primary,
  },
  renewBtnText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  // Premium actif
  premiumActiveCard: {
    marginHorizontal: 16, borderRadius: radius.xl,
    overflow: "hidden", ...shadows.small,
    borderWidth: 2, borderColor: "#FCD34D",
  },
  premiumActiveTop: {
    flexDirection: "row", alignItems: "center",
    padding: 16, gap: 12,
    backgroundColor: palette.navy,
  },
  premiumActiveCrown: { fontSize: 32 },
  premiumActiveTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  premiumActiveSub: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  premiumActiveBadge: {
    backgroundColor: "#FCD34D", borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  premiumActiveBadgeText: { fontSize: 10, fontWeight: "800", color: palette.navy },
  premiumActiveFeatures: { padding: 14, gap: 8 },
  premiumActiveFeature: { flexDirection: "row", alignItems: "center", gap: 8 },
  premiumActiveFeatureCheck: { fontSize: 14, color: colors.success, fontWeight: "800" },
  premiumActiveFeatureText: { fontSize: 14, color: colors.textPrimary, fontWeight: "500" },
  renewBtn: {
    margin: 14, marginTop: 0, borderRadius: radius.lg,
    paddingVertical: 12, alignItems: "center",
    backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primary,
  },
  renewBtnText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  // Premium
  premiumCard: {
    marginHorizontal: 16, borderRadius: radius.xl,
    backgroundColor: palette.navy,
    padding: 18, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
    ...shadows.medium,
  },
  premiumLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  premiumCrown: { fontSize: 32 },
  premiumTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  premiumSub: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  premiumArrow: { fontSize: 24, color: "rgba(255,255,255,0.5)", fontWeight: "700" },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, marginTop: 24,
    borderRadius: radius.xl, paddingVertical: 16,
    borderWidth: 1.5, borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  logoutIcon: { fontSize: 18 },
  logoutText: { fontSize: 16, fontWeight: "700", color: colors.danger },
});
