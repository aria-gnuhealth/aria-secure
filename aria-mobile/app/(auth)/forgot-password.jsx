import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import api from "../../services/api";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert("Erreur", "Saisissez votre email");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      Alert.alert(
        "Email envoyé",
        "Un lien de réinitialisation vous a été envoyé par email.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      const msg = error.response?.data?.detail || "Erreur lors de l'envoi";
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Mot de passe oublié</Text>
      <Text style={styles.subtitle}>
        Saisissez votre email, nous vous enverrons un lien pour le réinitialiser.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSend}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Envoyer le lien</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Retour à la connexion</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f8f9fa"
  },
  title: {
    fontSize: 28, fontWeight: "bold", color: "#1a73e8", textAlign: "center", marginBottom: 8
  },
  subtitle: {
    fontSize: 14, color: "#666", textAlign: "center", marginBottom: 32
  },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd",
    borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 16, color: "#333"
  },
  button: {
    backgroundColor: "#1a73e8", borderRadius: 10, padding: 16,
    alignItems: "center", marginBottom: 16
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#1a73e8", textAlign: "center", fontSize: 14 }
});
