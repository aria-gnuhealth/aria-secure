import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Alert, ActivityIndicator
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { colors, radius } from "../../constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function OTPScreen() {
  const router = useRouter();
  const { email, password } = useLocalSearchParams();
  const { loginWithOTP } = useAuth();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef([]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnims = useRef([...Array(6)].map(() => new Animated.Value(1))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const animateInput = (index) => {
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnims[index], { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleChange = (val, index) => {
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    animateInput(index);
    if (val && index < 5) {
      inputs.current[index + 1]?.focus();
    }
    if (newOtp.every(d => d !== "")) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code) => {
    setLoading(true);
    console.log("OTP verify:", { email, code });
    try {
      const res = await api.post("/auth/verify-otp", { email, code });
      console.log("OTP res:", JSON.stringify(res.data));
      if (res.data?.verified) {
        console.log("loginWithOTP:", { email, passwordLen: password?.length, passwordType: typeof password });
        try {
          const result = await loginWithOTP(email, password);
          console.log("login result:", JSON.stringify(result));
        } catch (loginErr) {
          console.log("loginWithOTP ERROR:", loginErr.message);
          Alert.alert("Erreur login", loginErr.message);
        }
      }
    } catch (e) {
      shake();
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      Alert.alert("Code incorrect", e.response?.data?.detail || "Code invalide ou expiré");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setResending(true);
    try {
      await api.post("/auth/send-otp", { email });
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      Alert.alert("✅ Code renvoyé", "Vérifiez votre boîte mail");
    } catch (e) {
      Alert.alert("Erreur", "Impossible de renvoyer le code");
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = email ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + "*".repeat(b.length) + c) : "";

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#0A2A3F" barStyle="light-content" />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Icône */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔐</Text>
        </View>

        <Text style={styles.title}>Vérification</Text>
        <Text style={styles.subtitle}>
          {"Un code à 6 chiffres a été envoyé à\n"}
          <Text style={styles.emailText}>{maskedEmail}</Text>
        </Text>

        {/* Cases OTP */}
        <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
          {otp.map((digit, i) => (
            <Animated.View key={i} style={[styles.otpBox, digit && styles.otpBoxFilled, { transform: [{ scale: scaleAnims[i] }] }]}>
              <TextInput
                ref={r => inputs.current[i] = r}
                style={styles.otpInput}
                value={digit}
                onChangeText={v => handleChange(v.replace(/[^0-9]/g, "").slice(-1), i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            </Animated.View>
          ))}
        </Animated.View>

        {/* Chargement */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Vérification en cours...</Text>
          </View>
        )}

        {/* Bouton vérifier */}
        {!loading && (
          <TouchableOpacity
            style={[styles.verifyBtn, otp.join("").length < 6 && { opacity: 0.5 }]}
            onPress={() => handleVerify(otp.join(""))}
            disabled={otp.join("").length < 6}
            activeOpacity={0.85}
          >
            <Text style={styles.verifyBtnText}>Confirmer →</Text>
          </TouchableOpacity>
        )}

        {/* Renvoyer */}
        <View style={styles.resendWrap}>
          {countdown > 0 ? (
            <Text style={styles.resendText}>Renvoyer dans <Text style={styles.countdown}>{countdown}s</Text></Text>
          ) : (
            <TouchableOpacity onPress={resendOtp} disabled={resending}>
              {resending
                ? <ActivityIndicator color={colors.primary} size="small" />
                : <Text style={styles.resendLink}>Renvoyer le code</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A2A3F", justifyContent: "center", alignItems: "center", padding: 24 },
  content: { width: "100%", alignItems: "center" },
  iconWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 24 },
  icon: { fontSize: 44 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 12 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 22, marginBottom: 36 },
  emailText: { color: "#FCD34D", fontWeight: "700" },
  otpRow: { flexDirection: "row", gap: 12, marginBottom: 32 },
  otpBox: { width: 48, height: 58, borderRadius: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  otpBoxFilled: { borderColor: "#FCD34D", backgroundColor: "rgba(252,211,77,0.15)" },
  otpInput: { fontSize: 24, fontWeight: "800", color: "#fff", textAlign: "center", width: "100%", height: "100%" },
  loadingWrap: { alignItems: "center", marginBottom: 20, gap: 12 },
  loadingText: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  verifyBtn: { backgroundColor: "#FCD34D", borderRadius: radius.md, height: 52, paddingHorizontal: 48, justifyContent: "center", alignItems: "center", marginBottom: 24, width: "100%" },
  verifyBtnText: { color: "#0A2A3F", fontSize: 16, fontWeight: "800" },
  resendWrap: { marginBottom: 24, alignItems: "center" },
  resendText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  countdown: { color: "#FCD34D", fontWeight: "700" },
  resendLink: { color: "#FCD34D", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  backBtn: { marginTop: 8 },
  backText: { color: "rgba(255,255,255,0.6)", fontSize: 15 },
});
