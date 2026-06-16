import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../services/api";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setError("Token manquant");
      setLoading(false);
    }
  }, [token]);

  const verifyEmail = async () => {
    try {
      await api.get(`/auth/verify-email/${token}`);
      setSuccess(true);
    } catch (error) {
      setError(error.response?.data?.detail || "Erreur de vérification");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Vérification en cours...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {success ? (
        <>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.title}>Email vérifié !</Text>
          <Text style={styles.subtitle}>
            Votre compte est maintenant actif. Vous pouvez vous connecter.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.buttonText}>Se connecter</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.icon}>❌</Text>
          <Text style={styles.title}>Vérification échouée</Text>
          <Text style={styles.subtitle}>{error || "Lien invalide ou expiré"}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.buttonText}>Retour à la connexion</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f8f9fa" },
  loadingText: { marginTop: 16, fontSize: 16, color: "#666" },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", textAlign: "center", marginBottom: 24 },
  button: { backgroundColor: "#1a73e8", borderRadius: 10, paddingHorizontal: 32, paddingVertical: 14 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
