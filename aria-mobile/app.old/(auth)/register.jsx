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
    first_name: "", last_name: "", email: "", password: "", role: "user"
  });
  const [loading, setLoading] = useState(false);

  const roles = ["user", "radiologist", "nurse", "admin", "auditor"];

  const handleRegister = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      Alert.alert("Erreur", "Remplis tous les champs");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", form);
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

        <Text style={styles.label}>Rôle</Text>
        <View style={styles.rolesContainer}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.roleBtn, form.role === role && styles.roleBtnActive]}
              onPress={() => setForm({ ...form, role })}
            >
              <Text style={[styles.roleTxt, form.role === role && styles.roleTxtActive]}>
                {role}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
    flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: "#f8f9fa"
  },
  title: {
    fontSize: 28, fontWeight: "bold", color: "#1a73e8", textAlign: "center", marginBottom: 8
  },
  subtitle: {
    fontSize: 13, color: "#666", textAlign: "center", marginBottom: 32
  },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd",
    borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 16, color: "#333"
  },
  label: {
    fontSize: 14, color: "#555", marginBottom: 10, fontWeight: "500"
  },
  rolesContainer: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24
  },
  roleBtn: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff"
  },
  roleBtnActive: {
    backgroundColor: "#1a73e8", borderColor: "#1a73e8"
  },
  roleTxt: { fontSize: 13, color: "#555" },
  roleTxtActive: { color: "#fff", fontWeight: "600" },
  button: {
    backgroundColor: "#1a73e8", borderRadius: 10, padding: 16,
    alignItems: "center", marginBottom: 16
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#1a73e8", textAlign: "center", fontSize: 14 }
});
