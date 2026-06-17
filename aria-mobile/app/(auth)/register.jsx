import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import api from "../../services/api";

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      Alert.alert("Erreur", "Remplis tous les champs");
      return;
    }

    setLoading(true);
    try {
      // Rôle fixé à "doctor" par défaut
      const payload = { ...form, role: "doctor" };
      await api.post("/auth/register", payload);
      Alert.alert(
        "Compte créé !",
        "Un email de vérification a été envoyé. Vérifie ta boîte mail avant de te connecter.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    } catch (error) {
      const msg = error.response?.data?.detail || "Erreur lors de l'inscription";
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>ARIA — Accès médical sécurisé</Text>

        <TextInput
          style={styles.input}
          placeholder="Prénom"
          placeholderTextColor="#999"
          value={form.first_name}
          onChangeText={(v) => setForm({ ...form, first_name: v })}
        />
        <TextInput
          style={styles.input}
          placeholder="Nom"
          placeholderTextColor="#999"
          value={form.last_name}
          onChangeText={(v) => setForm({ ...form, last_name: v })}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={form.email}
          onChangeText={(v) => setForm({ ...form, email: v })}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#999"
          value={form.password}
          onChangeText={(v) => setForm({ ...form, password: v })}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>S'inscrire</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Déjà un compte ? Se connecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a73e8",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    color: "#333",
  },
  button: {
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#1a73e8", textAlign: "center", fontSize: 14 },
});
