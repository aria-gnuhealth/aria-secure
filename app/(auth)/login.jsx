import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, StatusBar, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Animated
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import AriaLogo from "../../components/AriaLogo";
import { colors, radius } from "../../constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(80)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(formAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
        Animated.timing(formOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!email || !password) {
      shake();
      Alert.alert("Erreur", "Email et mot de passe obligatoires");
      return;
    }
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    setLoading(true);
    try {
      // Vérifier les credentials d'abord
      await login(email, password, true);
      // Vérifier si 2FA activé
      const twoFaRes = await api.post("/auth/send-otp-if-enabled", { email }).catch(() => null);
      if (twoFaRes?.data?.otp_sent) {
        // 2FA activé - rediriger vers OTP
        router.push({ pathname: "/(auth)/otp", params: { email, password } });
      } else {
        // 2FA désactivé - connexion directe
        await login(email, password);
      }
    } catch (e) {
      shake();
      Alert.alert("Connexion échouée", e.message || "Vérifiez vos identifiants");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar backgroundColor="#0A2A3F" barStyle="light-content" />
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo animé */}
        <Animated.View style={[styles.header, {
          opacity: logoAnim,
          transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }]
        }]}>
          <AriaLogo size={80} />
          <Text style={styles.logoTitle}>ARIA</Text>
          <Text style={styles.logoSub}>Plateforme de télé-radiologie IA</Text>
        </Animated.View>

        {/* Formulaire animé */}
        <Animated.View style={[styles.card, {
          opacity: formOpacity,
          transform: [{ translateY: formAnim }, { translateX: shakeAnim }]
        }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Connexion</Text>
            <Text style={styles.cardSub}>Accédez à votre espace médical</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputBox, focusedField === "email" && styles.inputFocused]}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.inputInner}
                placeholder="votre@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <Text style={styles.label}>Mot de passe</Text>
            <View style={[styles.inputBox, focusedField === "password" && styles.inputFocused]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.inputInner}
                placeholder="Votre mot de passe"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push("/(auth)/forgot-password")}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.loginBtnText}>Se connecter →</Text>
                }
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.registerBtn} onPress={() => router.push("/(auth)/register")} activeOpacity={0.8}>
              <Text style={styles.registerBtnText}>Créer un compte →</Text>
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

  header: { paddingHorizontal: 24, paddingTop: 70, paddingBottom: 30, alignItems: "center" },
  logoTitle: { fontSize: 34, fontWeight: "900", color: "#fff", letterSpacing: 3, marginTop: 10 },
  logoSub: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6 },

  card: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 12 },
  cardHeader: { backgroundColor: colors.primary, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingVertical: 24 },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  cardSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },

  form: { padding: 24 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, marginBottom: 8, marginTop: 16 },

  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 52 },
  inputFocused: { borderColor: colors.primary, backgroundColor: "#fff" },
  inputIcon: { fontSize: 17, marginRight: 10 },
  inputInner: { flex: 1, fontSize: 15, color: colors.textPrimary },
  eyeIcon: { fontSize: 18, paddingHorizontal: 4 },

  forgotBtn: { alignSelf: "flex-end", marginTop: 10 },
  forgotText: { color: colors.primary, fontSize: 13, fontWeight: "600" },

  loginBtn: { backgroundColor: colors.primary, borderRadius: radius.md, height: 54, justifyContent: "center", alignItems: "center", marginTop: 20, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 13 },

  registerBtn: { borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md, height: 52, justifyContent: "center", alignItems: "center" },
  registerBtnText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
});
