import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Animated
} from "react-native";
import { useRouter } from "expo-router";
import api from "../../services/api";
import { colors, shadows, radius } from "../../constants/theme";
import AriaLogo from "../../components/AriaLogo";

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Trop faible", color: "#E74C3C" };
  if (score === 2) return { score, label: "Faible", color: "#E67E22" };
  if (score === 3) return { score, label: "Moyen", color: "#F1C40F" };
  if (score === 4) return { score, label: "Fort", color: "#2ECC71" };
  return { score, label: "Très fort", color: "#27AE60" };
}

export default function RegisterScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "", confirm_password: "" });
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(cardAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const update = (key, val) => setForm({ ...form, [key]: val });
  const strength = getPasswordStrength(form.password);
  const passwordsMatch = form.password && form.confirm_password && form.password === form.confirm_password;
  const passwordMismatch = form.confirm_password && form.password !== form.confirm_password;

  const handleRegister = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.password || !form.confirm_password) {
      Alert.alert("Champs manquants", "Tous les champs sont obligatoires"); return;
    }
    if (form.password.length < 8) { Alert.alert("Erreur", "Minimum 8 caractères requis"); return; }
    if (form.password !== form.confirm_password) { Alert.alert("Erreur", "Les mots de passe ne correspondent pas"); return; }
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    setLoading(true);
    try {
      await api.post("/auth/register", { first_name: form.first_name, last_name: form.last_name, email: form.email, password: form.password, role: "doctor" });
      Alert.alert("✅ Compte créé !", "Un email de vérification a été envoyé à " + form.email + ". Vérifiez votre boîte mail et vos spams.",
        [{ text: "Se connecter", onPress: () => router.replace("/(auth)/login") }]);
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Erreur lors de l'inscription");
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar backgroundColor="#0A2A3F" barStyle="light-content" />
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }] }]}>
          <AriaLogo size={72} />
          <Text style={styles.logoTitle}>ARIA</Text>
          <Text style={styles.logoSub}>Créer un compte médical sécurisé</Text>
        </Animated.View>
        <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardAnim }] }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Créer un compte</Text>
            <Text style={styles.cardSub}>Accès sécurisé aux analyses IA</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Prénom *</Text>
                <TextInput style={[styles.input, focusedField === "first_name" && styles.inputFocused]} placeholder="Prénom" placeholderTextColor={colors.textMuted} value={form.first_name} onChangeText={v => update("first_name", v)} onFocus={() => setFocusedField("first_name")} onBlur={() => setFocusedField(null)} autoCapitalize="words" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nom *</Text>
                <TextInput style={[styles.input, focusedField === "last_name" && styles.inputFocused]} placeholder="Nom" placeholderTextColor={colors.textMuted} value={form.last_name} onChangeText={v => update("last_name", v)} onFocus={() => setFocusedField("last_name")} onBlur={() => setFocusedField(null)} autoCapitalize="words" />
              </View>
            </View>
            <Text style={styles.label}>Email professionnel *</Text>
            <View style={[styles.inputBox, focusedField === "email" && styles.inputFocused]}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput style={styles.inputInner} placeholder="utilisateur@hopital.fr" placeholderTextColor={colors.textMuted} value={form.email} onChangeText={v => update("email", v)} keyboardType="email-address" autoCapitalize="none" onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)} />
            </View>
            <Text style={styles.label}>Mot de passe *</Text>
            <View style={[styles.inputBox, focusedField === "password" && styles.inputFocused]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput style={styles.inputInner} placeholder="Min. 8 caractères" placeholderTextColor={colors.textMuted} value={form.password} onChangeText={v => update("password", v)} secureTextEntry={!showPassword} onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField(null)} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
            {form.password.length > 0 && (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthBars}>
                  {[1,2,3,4,5].map(i => <View key={i} style={[styles.strengthBar, { backgroundColor: i <= strength.score ? strength.color : colors.border }]} />)}
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              </View>
            )}
            <Text style={styles.label}>Confirmer le mot de passe *</Text>
            <View style={[styles.inputBox, focusedField === "confirm" && styles.inputFocused, passwordsMatch && styles.inputSuccess, passwordMismatch && styles.inputError]}>
              <Text style={styles.inputIcon}>🔐</Text>
              <TextInput style={styles.inputInner} placeholder="Répétez le mot de passe" placeholderTextColor={colors.textMuted} value={form.confirm_password} onChangeText={v => update("confirm_password", v)} secureTextEntry={!showConfirm} onFocus={() => setFocusedField("confirm")} onBlur={() => setFocusedField(null)} />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Text style={styles.eyeIcon}>{showConfirm ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
              {passwordsMatch && <Text style={{ fontSize: 18 }}>✅</Text>}
              {passwordMismatch && <Text style={{ fontSize: 18 }}>❌</Text>}
            </View>
            {passwordMismatch && <Text style={styles.errorText}>Les mots de passe ne correspondent pas</Text>}

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity style={[styles.registerBtn, loading && { opacity: 0.7 }]} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerBtnText}>Créer mon compte →</Text>}
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
              <Text style={styles.loginLinkText}>Déjà un compte ? <Text style={styles.loginLinkBold}>Se connecter</Text></Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A2A3F" },
  scroll: { flexGrow: 1 },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 28, alignItems: "center" },
  logoTitle: { fontSize: 30, fontWeight: "800", color: "#fff", letterSpacing: 2, marginTop: 8 },
  logoSub: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, flex: 1 },
  cardHeader: { backgroundColor: colors.primary, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingVertical: 20 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  cardSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  form: { padding: 20 },
  nameRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.textPrimary },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 50 },
  inputFocused: { borderColor: colors.primary, backgroundColor: "#fff" },
  inputSuccess: { borderColor: "#27AE60", backgroundColor: "#f0fdf4" },
  inputError: { borderColor: "#E74C3C", backgroundColor: "#fff5f5" },
  inputIcon: { fontSize: 16, marginRight: 8 },
  inputInner: { flex: 1, fontSize: 15, color: colors.textPrimary },
  eyeIcon: { fontSize: 18, paddingHorizontal: 4 },
  strengthWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  strengthBars: { flexDirection: "row", gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: "700", width: 70, textAlign: "right" },
  errorText: { color: "#E74C3C", fontSize: 12, marginTop: 4 },
  roleInfo: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.primaryBg, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.primary + "30", marginTop: 16 },
  roleInfoIcon: { fontSize: 28 },
  roleInfoTitle: { fontSize: 14, fontWeight: "700", color: colors.primary },
  roleInfoSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  registerBtn: { backgroundColor: colors.primary, borderRadius: radius.md, height: 52, justifyContent: "center", alignItems: "center", marginTop: 20, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  registerBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  loginLink: { marginTop: 16, alignItems: "center" },
  loginLinkText: { fontSize: 14, color: colors.textSecondary },
  loginLinkBold: { color: colors.primary, fontWeight: "600" },
});
