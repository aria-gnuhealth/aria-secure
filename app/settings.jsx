import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput, StatusBar, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { colors, shadows, radius, palette } from "../constants/theme";
import api from "../services/api";

export default function SettingsScreen() {
  const router = useRouter();
  const {
    theme, darkMode, language, notifications, fontSize,
    toggleDarkMode, changeLanguage, toggleNotifications, changeFontSize
  } = useSettings();
  const { user } = useAuth();
  const [section, setSection] = useState(null);
  const [form, setForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: ""
  });
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  useEffect(() => {
    api.get("/auth/2fa/status").then(r => setTwoFaEnabled(r.data?.two_factor_enabled || false)).catch(() => {});
  }, []);

  const toggle2FA = async (val) => {
    try {
      await api.post("/auth/2fa/toggle", { enabled: val });
      setTwoFaEnabled(val);
      Alert.alert(val ? "✅ 2FA activé" : "2FA désactivé", val ? "Un code sera envoyé par email à chaque connexion." : "L'authentification à deux facteurs est désactivée.");
    } catch (e) {
      Alert.alert("Erreur", "Impossible de modifier le 2FA");
    }
  };
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const bg = theme?.bg || colors.background;
  const surface = theme?.surface || colors.surface;

  const handleEditProfile = async () => {
    if (!form.firstName || !form.lastName) {
      Alert.alert("Erreur", "Prénom et nom obligatoires");
      return;
    }
    setLoading(true);
    try {
      await api.put("/auth/me", {
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone
      });
      Alert.alert("✅ Profil mis à jour", "Vos informations ont été enregistrées.");
      setSection(null);
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de modifier le profil");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.newPass || !passwords.confirm) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires");
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      Alert.alert("Erreur", "Les nouveaux mots de passe ne correspondent pas");
      return;
    }
    if (passwords.newPass.length < 8) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    setLoading(true);
    try {
      await api.put("/auth/change-password", {
        current_password: passwords.current,
        new_password: passwords.newPass
      });
      Alert.alert("✅ Mot de passe modifié");
      setPasswords({ current: "", newPass: "", confirm: "" });
      setSection(null);
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Mot de passe actuel incorrect");
    } finally {
      setLoading(false);
    }
  };

  // ── Écran Modifier profil ─────────────────────────────────────────
  if (section === "profile") return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar backgroundColor={palette.navy} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSection(null)} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier le profil</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formBody}>
        <View style={[styles.formCard, { backgroundColor: surface }]}>
          {[
            { key: "firstName", label: "Prénom", placeholder: "Votre prénom", icon: "👤" },
            { key: "lastName",  label: "Nom",    placeholder: "Votre nom",    icon: "👤" },
            { key: "phone",     label: "Téléphone", placeholder: "+237 699 000 000", icon: "📱", keyboard: "phone-pad" },
          ].map((f, i) => (
            <View key={f.key} style={[styles.field, i > 0 && { marginTop: 14 }]}>
              <Text style={[styles.fieldLabel, { color: theme?.textSecondary || colors.textSecondary }]}>{f.label}</Text>
              <View style={[styles.inputWrap, { backgroundColor: theme?.surfaceSecondary || colors.gray100, borderColor: theme?.border || colors.border }]}>
                <Text style={styles.inputIcon}>{f.icon}</Text>
                <TextInput
                  style={[styles.fieldInput, { color: theme?.text || colors.textPrimary }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={theme?.textMuted || colors.textMuted}
                  value={form[f.key]}
                  onChangeText={v => setForm({ ...form, [f.key]: v })}
                  keyboardType={f.keyboard || "default"}
                  autoCapitalize="words"
                />
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleEditProfile}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Enregistrer les modifications</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ── Écran Modifier mot de passe ───────────────────────────────────
  if (section === "password") return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar backgroundColor={palette.navy} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSection(null)} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier le mot de passe</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formBody}>
        <View style={[styles.formCard, { backgroundColor: surface }]}>
          <View style={styles.pwdInfo}>
            <Text style={styles.pwdInfoIcon}>🔒</Text>
            <Text style={[styles.pwdInfoText, { color: theme?.textSecondary || colors.textSecondary }]}>
              Minimum 8 caractères avec lettres et chiffres
            </Text>
          </View>
          {[
            { key: "current", label: "Mot de passe actuel",   placeholder: "••••••••", show: showCurrent, toggle: () => setShowCurrent(!showCurrent) },
            { key: "newPass", label: "Nouveau mot de passe",  placeholder: "Min. 8 caractères", show: showNew, toggle: () => setShowNew(!showNew) },
            { key: "confirm", label: "Confirmer le nouveau",  placeholder: "Répéter le mot de passe", show: showNew, toggle: null },
          ].map((f, i) => (
            <View key={f.key} style={[styles.field, i > 0 && { marginTop: 14 }]}>
              <Text style={[styles.fieldLabel, { color: theme?.textSecondary || colors.textSecondary }]}>{f.label}</Text>
              <View style={[styles.inputWrap, { backgroundColor: theme?.surfaceSecondary || colors.gray100, borderColor: theme?.border || colors.border }]}>
                <Text style={styles.inputIcon}>🔑</Text>
                <TextInput
                  style={[styles.fieldInput, { color: theme?.text || colors.textPrimary }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={theme?.textMuted || colors.textMuted}
                  value={passwords[f.key]}
                  onChangeText={v => setPasswords({ ...passwords, [f.key]: v })}
                  secureTextEntry={!f.show}
                />
                {f.toggle && (
                  <TouchableOpacity onPress={f.toggle}>
                    <Text style={{ fontSize: 16 }}>{f.show ? "🙈" : "👁️"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Modifier le mot de passe</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ── Écran principal paramètres ────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar backgroundColor={palette.navy} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Apparence */}
        <SectionLabel label="APPARENCE" />
        <SettingCard surface={surface}>
          <SettingRow
            icon="🌙" label="Mode sombre"
            right={
              <Switch
                value={!!darkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ true: colors.primary, false: colors.gray200 }}
                thumbColor="#fff"
              />
            }
            theme={theme}
          />
          <SettingRow
            icon="🔤" label="Taille du texte"
            right={
              <View style={styles.sizeRow}>
                {[
                  { key: "small",  label: "A",  size: 13 },
                  { key: "medium", label: "A",  size: 16 },
                  { key: "large",  label: "A",  size: 20 },
                ].map(s => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.sizeBtn, fontSize === s.key && styles.sizeBtnActive]}
                    // onPress={() => changeFontSize(s.key)}
                  >
                    <Text style={[{ fontSize: s.size, color: colors.textMuted }, fontSize === s.key && { color: colors.primary, fontWeight: "700" }]}>
                      A
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
            theme={theme}
            border
          />
        </SettingCard>

        {/* Langue */}
        <SectionLabel label="LANGUE" />
        <SettingCard surface={surface}>
          {[
            { code: "fr", flag: "🇫🇷", label: "Français" },
            { code: "en", flag: "🇬🇧", label: "English" },
          ].map((l, i) => (
            <SettingRow
              key={l.code}
              icon={l.flag}
              label={l.label}
              right={language === l.code
                ? <View style={styles.checkCircle}><Text style={styles.checkIcon}>✓</Text></View>
                : null
              }
              onPress={() => changeLanguage(l.code)}
              theme={theme}
              border={i > 0}
            />
          ))}
        </SettingCard>

        {/* Notifications */}
        <SectionLabel label="NOTIFICATIONS" />
        <SettingCard surface={surface}>
          <SettingRow
            icon="🔔" label="Notifications push"
            sublabel="Recevoir les alertes et messages"
            right={
              <Switch
                value={!!notifications}
                onValueChange={toggleNotifications}
                trackColor={{ true: colors.primary, false: colors.gray200 }}
                thumbColor="#fff"
              />
            }
            theme={theme}
          />
        </SettingCard>

        {/* Compte */}
        <SectionLabel label="COMPTE" />
        <SettingCard surface={surface}>
          <SettingRow
            icon="👤" label="Modifier le profil"
            sublabel={`${user?.firstName} ${user?.lastName}`}
            right={<Text style={styles.chevron}>›</Text>}
            onPress={() => setSection("profile")}
            theme={theme}
          />
          <SettingRow
            icon="🔒" label="Modifier le mot de passe"
            right={<Text style={styles.chevron}>›</Text>}
            onPress={() => setSection("password")}
            theme={theme}
            border
          />
        </SettingCard>

        {/* Sécurité */}
        <SectionLabel label="SÉCURITÉ & CONFIDENTIALITÉ" />
        <SettingCard surface={surface}>
          <SettingRow
            icon="🛡️" label="Authentification deux facteurs"
            sublabel={twoFaEnabled ? "Activée — code email à chaque connexion" : "Désactivée — connexion directe"}
            right={
              <Switch
                value={twoFaEnabled}
                onValueChange={toggle2FA}
                trackColor={{ false: "#ddd", true: colors.primary }}
                thumbColor="#fff"
              />
            }
            theme={theme}
          />
          <SettingRow
            icon="📋" label="Politique de confidentialité"
            right={<Text style={styles.chevron}>›</Text>}
            onPress={() => Alert.alert("Confidentialité", "Vos données médicales sont chiffrées (AES-256) et conformes au RGPD. Elles ne sont jamais partagées sans votre consentement.")}
            theme={theme}
            border
          />
          <SettingRow
            icon="⚖️" label="Conditions d'utilisation"
            right={<Text style={styles.chevron}>›</Text>}
            onPress={() => Alert.alert("Conditions", "ARIA est un outil d'aide au diagnostic. Les résultats IA sont indicatifs et ne remplacent pas l'avis d'un professionnel de santé qualifié.")}
            theme={theme}
            border
          />
        </SettingCard>

        {/* À propos */}
        <SectionLabel label="À PROPOS" />
        <SettingCard surface={surface}>
          <SettingRow icon="🫁" label="ARIA Medical" sublabel="Automated Radiography Intelligent Analysis" theme={theme} />
          <SettingRow icon="ℹ️" label="Version" right={<Text style={[styles.versionText]}>1.0.0</Text>} theme={theme} border />
          <SettingRow
            icon="📧" label="Support"
            sublabel="ariasecure.support@gmail.com"
            right={<Text style={styles.chevron}>›</Text>}
            theme={theme}
            border
          />
        </SettingCard>

      </ScrollView>
    </View>
  );
}

// ── Composants ────────────────────────────────────────────────────────────────

function SectionLabel({ label }) {
  return (
    <Text style={styles.sectionLabel}>{label}</Text>
  );
}

function SettingCard({ children, surface }) {
  return (
    <View style={[styles.card, { backgroundColor: surface }]}>
      {children}
    </View>
  );
}

function SettingRow({ icon, label, sublabel, right, onPress, theme, border, danger }) {
  return (
    <TouchableOpacity
      style={[styles.row, border && { borderTopWidth: 1, borderTopColor: theme?.border || colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: theme?.surfaceSecondary || colors.gray100 }]}>
        <Text style={styles.rowIcon}>{icon}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: danger ? colors.danger : (theme?.text || colors.textPrimary) }]}>
          {label}
        </Text>
        {sublabel && (
          <Text style={[styles.rowSublabel, { color: theme?.textMuted || colors.textMuted }]}>{sublabel}</Text>
        )}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    backgroundColor: palette.navy,
    paddingTop: 52, paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 30, color: "#fff", fontWeight: "300" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: colors.textMuted,
    letterSpacing: 1, marginHorizontal: 16,
    marginTop: 24, marginBottom: 8,
  },

  card: {
    marginHorizontal: 16, borderRadius: radius.xl,
    overflow: "hidden", ...shadows.small,
  },

  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowIconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    justifyContent: "center", alignItems: "center",
  },
  rowIcon: { fontSize: 17 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowSublabel: { fontSize: 12, marginTop: 2 },
  rowRight: { marginLeft: 8 },

  chevron: { fontSize: 20, color: colors.textMuted },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  checkIcon: { color: "#fff", fontSize: 13, fontWeight: "800" },
  comingSoon: { fontSize: 11, color: colors.textMuted, fontStyle: "italic" },
  versionText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },

  sizeRow: { flexDirection: "row", gap: 6 },
  sizeBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.gray100,
  },
  sizeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },

  // Formulaires
  formBody: { padding: 16, paddingBottom: 40 },
  formCard: { borderRadius: radius.xl, padding: 20, ...shadows.small },

  pwdInfo: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.infoBg, borderRadius: radius.lg,
    padding: 12, marginBottom: 20,
  },
  pwdInfoIcon: { fontSize: 20 },
  pwdInfoText: { fontSize: 13, flex: 1, lineHeight: 18 },

  field: {},
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: radius.xl,
    paddingHorizontal: 14, height: 52, gap: 10,
  },
  inputIcon: { fontSize: 16 },
  fieldInput: { flex: 1, fontSize: 15 },

  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.xl,
    paddingVertical: 16, alignItems: "center", marginTop: 24,
    ...shadows.small,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
