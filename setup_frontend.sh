#!/bin/bash

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    REBUILD ARIA MOBILE FRONTEND      ${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. Installer les dépendances si manquantes
echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
npm install axios @react-native-async-storage/async-storage expo-router expo-secure-store expo-image-picker expo-file-system expo-sharing expo-web-browser react-native-safe-area-context react-native-screens --legacy-peer-deps 2>/dev/null

# 2. Créer les dossiers
echo -e "${YELLOW}📁 Création des dossiers...${NC}"
mkdir -p app/\(auth\) app/\(tabs\) app/patient app/analyse app/patient/edit
mkdir -p services components constants

# 3. Fichier constants/config.js
echo -e "${YELLOW}📝 Création constants/config.js...${NC}"
cat > constants/config.js << 'EOF'
export const API_URL = "http://192.168.1.200:8000/api/v1";
// ⚠️ Remplace l'IP par celle de ton PC (hostname -I)
EOF

# 4. Fichier services/api.js
echo -e "${YELLOW}📝 Création services/api.js...${NC}"
cat > services/api.js << 'EOF'
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/config";

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Ajoute le token à chaque requête
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gère les erreurs 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      // On ne fait pas de redirection ici, le layout s'en occupe
    }
    return Promise.reject(error);
  }
);

export default api;
EOF

# 5. Fichier app/_layout.jsx
echo -e "${YELLOW}📝 Création app/_layout.jsx...${NC}"
cat > app/_layout.jsx << 'EOF'
import { useState, useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import { Activit(venv)─(autor㉿royal)-[~/Bureau/aria/aria-mobile]
└─$ ip addr show | grep "inet " | grep -v "127.0.0.1"
    inet 192.168.1.100/24 brd 192.168.1.255 scope global dynamic noprefixroute wlan0
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
    inet 172.18.0.1/16 brd 172.18.255.255 scope global br-f5d4579b6047
                         yIndicator, View } from "react-native";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        try {
          await api.get("/auth/verify");
          setIsAuthenticated(true);
        } catch (error) {
          await AsyncStorage.removeItem("token");
          await AsyncStorage.removeItem("user");
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.log("Erreur de vérification:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      const inAuthGroup = segments[0] === "(auth)";
      if (!isAuthenticated && !inAuthGroup) {
        router.replace("/(auth)/login");
      } else if (isAuthenticated && inAuthGroup) {
        router.replace("/(tabs)/patients");
      }
    }
  }, [isLoading, isAuthenticated, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="analyse" options={{ headerShown: false }} />
      <Stack.Screen name="patient" options={{ headerShown: false }} />
    </Stack>
  );
}
EOF

# 6. Fichier app/index.jsx
echo -e "${YELLOW}📝 Création app/index.jsx...${NC}"
cat > app/index.jsx << 'EOF'
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
EOF

# 7. Fichier app/(auth)/login.jsx
echo -e "${YELLOW}📝 Création app/(auth)/login.jsx...${NC}"
cat > app/\(auth\)/login.jsx << 'EOF'
import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import api from "../../services/api";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Erreur", "Remplis tous les champs");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const response = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await AsyncStorage.setItem("token", response.data.access_token);
      await AsyncStorage.setItem("user", JSON.stringify({
        id: response.data.user_id,
        email: response.data.email,
        firstName: response.data.first_name,
        lastName: response.data.last_name,
        role: response.data.role,
      }));

      router.replace("/");

    } catch (error) {
      const msg = error.response?.data?.detail || "Erreur de connexion";
      Alert.alert("Connexion échouée", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>ARIA</Text>
      <Text style={styles.subtitle}>Analyse de radiographies par IA</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Se connecter</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")}>
        <Text style={styles.forgotLink}>Mot de passe oublié ?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        <Text style={styles.link}>Pas encore de compte ? S'inscrire</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f8f9fa"
  },
  title: {
    fontSize: 42, fontWeight: "bold", color: "#1a73e8", textAlign: "center", marginBottom: 8
  },
  subtitle: {
    fontSize: 14, color: "#666", textAlign: "center", marginBottom: 40
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
  forgotLink: {
    color: "#666", textAlign: "center", fontSize: 14, marginBottom: 16
  },
  link: { color: "#1a73e8", textAlign: "center", fontSize: 14 }
});
EOF

# 8. Fichier app/(auth)/register.jsx
echo -e "${YELLOW}📝 Création app/(auth)/register.jsx...${NC}"
cat > app/\(auth\)/register.jsx << 'EOF'
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
    role: "doctor"
  });
  const [loading, setLoading] = useState(false);

  const roles = ["doctor", "radiologist", "nurse", "admin", "auditor"];

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
        "Un email de vérification a été envoyé.",
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
EOF

# 9. Fichier app/(auth)/forgot-password.jsx
echo -e "${YELLOW}📝 Création app/(auth)/forgot-password.jsx...${NC}"
cat > app/\(auth\)/forgot-password.jsx << 'EOF'
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
EOF

# 10. Fichier app/(auth)/reset-password.jsx
echo -e "${YELLOW}📝 Création app/(auth)/reset-password.jsx...${NC}"
cat > app/\(auth\)/reset-password.jsx << 'EOF'
import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../services/api";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      Alert.alert("Erreur", "Remplissez tous les champs");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      Alert.alert(
        "✅ Mot de passe modifié",
        "Vous pouvez maintenant vous connecter.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    } catch (error) {
      const msg = error.response?.data?.detail || "Erreur lors de la réinitialisation";
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
      <Text style={styles.title}>Nouveau mot de passe</Text>
      <Text style={styles.subtitle}>
        Saisissez votre nouveau mot de passe (au moins 6 caractères).
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Nouveau mot de passe"
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirmer le mot de passe"
        placeholderTextColor="#999"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleReset}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Réinitialiser</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
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
EOF

# 11. Fichier app/(tabs)/_layout.jsx
echo -e "${YELLOW}📝 Création app/(tabs)/_layout.jsx...${NC}"
cat > app/\(tabs\)/_layout.jsx << 'EOF'
import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1a73e8",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 0.5,
          borderTopColor: "#e0e0e0",
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="patients"
        options={{
          title: "Patients",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
EOF

# 12. Fichier app/(tabs)/patients.jsx
echo -e "${YELLOW}📝 Création app/(tabs)/patients.jsx...${NC}"
cat > app/\(tabs\)/patients.jsx << 'EOF'
import { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput, RefreshControl
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../services/api";

export default function PatientsScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadUser();
    fetchPatients();
  }, []);

  const loadUser = async () => {
    const u = await AsyncStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
  };

  const fetchPatients = async () => {
    try {
      const res = await api.get("/patients?page=1&per_page=20");
      setPatients(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const searchPatients = async (q) => {
    setSearch(q);
    if (q.length < 2) {
      fetchPatients();
      return;
    }
    try {
      const res = await api.get(`/patients/search?q=${q}`);
      setPatients(res.data || []);
    } catch (e) {
      console.log(e);
    }
  };

  const getInitials = (first, last) =>
    `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const renderPatient = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/patient/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: "#e8f0fe" }]}>
        <Text style={styles.avatarText}>
          {getInitials(item.first_name, item.last_name)}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.first_name} {item.last_name}</Text>
        <Text style={styles.cardSub}>Dossier #{item.medical_record_number || "—"}</Text>
        <Text style={styles.cardSub}>
          {item.date_of_birth ? `Né(e) le ${new Date(item.date_of_birth).toLocaleDateString("fr-FR")}` : "Date non renseignée"}
        </Text>
      </View>
      <View style={styles.cardArrow}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Chargement des patients...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
        <Text style={styles.headerSub}>{total} patient{total > 1 ? "s" : ""} au total</Text>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un patient..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={searchPatients}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => searchPatients("")}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        renderItem={renderPatient}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchPatients();
          }} colors={["#1a73e8"]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyText}>Aucun patient trouvé</Text>
            <Text style={styles.emptySub}>Tirez vers le bas pour actualiser</Text>
          </View>
        }
        contentContainerStyle={patients.length === 0 && styles.emptyContainer}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/patient/new")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f9fa" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0"
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#1a1a1a" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderColor: "#e0e0e0"
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: "#333" },
  clearSearch: { fontSize: 16, color: "#999", padding: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#e8e8e8"
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: "center", alignItems: "center", marginRight: 14
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#1a73e8" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", marginBottom: 3 },
  cardSub: { fontSize: 12, color: "#888", marginTop: 1 },
  cardArrow: { paddingLeft: 8 },
  arrowText: { fontSize: 22, color: "#ccc", fontWeight: "300" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyContainer: { flexGrow: 1 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#555" },
  emptySub: { fontSize: 13, color: "#999", marginTop: 4 },
  fab: {
    position: "absolute",
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6
  },
  fabText: { fontSize: 28, color: "#fff", lineHeight: 32 },
});
EOF

echo -e "${GREEN}✅ Structure de base créée !${NC}"
echo -e "${YELLOW}📝 Il manque encore quelques écrans. On continue...${NC}"


# 13. Fichier app/(tabs)/dashboard.jsx
echo -e "${YELLOW}📝 Création app/(tabs)/dashboard.jsx...${NC}"
cat > app/\(tabs\)/dashboard.jsx << 'EOF'
import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl
} from "react-native";
import api from "../../services/api";

export default function DashboardScreen() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get("/patients/stats/summary");
      setStats(res.data);
    } catch (error) {
      console.log("Erreur stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tableau de bord</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: "#e3f2fd" }]}>
          <Text style={[styles.statNumber, { color: "#1565c0" }]}>
            {stats?.total_patients || 0}
          </Text>
          <Text style={styles.statLabel}>Patients</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: "#e8f5e9" }]}>
          <Text style={[styles.statNumber, { color: "#2e7d32" }]}>
            {stats?.total_analyses || 0}
          </Text>
          <Text style={styles.statLabel}>Analyses</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: "#fff3e0" }]}>
          <Text style={[styles.statNumber, { color: "#e65100" }]}>
            {stats?.critical_analyses || 0}
          </Text>
          <Text style={styles.statLabel}>Critiques</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: "#fce4ec" }]}>
          <Text style={[styles.statNumber, { color: "#c62828" }]}>
            {stats?.pending_analyses || 0}
          </Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#1a1a1a" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: "47%",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 14,
    color: "#555",
    marginTop: 4,
  },
});
EOF

# 14. Fichier app/(tabs)/profil.jsx
echo -e "${YELLOW}📝 Création app/(tabs)/profil.jsx...${NC}"
cat > app/\(tabs\)/profil.jsx << 'EOF'
import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import api from "../../services/api";

export default function ProfilScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const u = await AsyncStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
  };

  const handleLogout = async () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post("/auth/logout");
          } catch (e) {}
          await AsyncStorage.removeItem("token");
          await AsyncStorage.removeItem("user");
          router.replace("/");
        }
      }
    ]);
  };

  const getRoleLabel = (role) => {
    const labels = {
      doctor: "Médecin",
      radiologist: "Radiologue",
      nurse: "Infirmier(e)",
      admin: "Administrateur",
      auditor: "Auditeur"
    };
    return labels[role] || role;
  };

  const getInitials = (first, last) =>
    `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon profil</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: "#e8f0fe" }]}>
          <Text style={[styles.avatarText, { color: "#1a73e8" }]}>
            {getInitials(user?.firstName, user?.lastName)}
          </Text>
        </View>
        <Text style={styles.fullName}>
          {user?.firstName} {user?.lastName}
        </Text>
        <View style={[styles.roleBadge, { backgroundColor: "#e8f0fe" }]}>
          <Text style={[styles.roleText, { color: "#1a73e8" }]}>
            {getRoleLabel(user?.role)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>✉️</Text>
          <View>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>🏥</Text>
          <View>
            <Text style={styles.infoLabel}>Rôle</Text>
            <Text style={styles.infoValue}>{getRoleLabel(user?.role)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Application</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>🤖</Text>
          <View>
            <Text style={styles.infoLabel}>ARIA</Text>
            <Text style={styles.infoValue}>Automated Radiography Intelligent Analysis</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📱</Text>
          <View>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0"
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#1a1a1a" },
  profileCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    borderWidth: 0.5,
    borderColor: "#e8e8e8"
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: "center", alignItems: "center", marginBottom: 12
  },
  avatarText: { fontSize: 28, fontWeight: "700" },
  fullName: { fontSize: 20, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  roleBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  roleText: { fontSize: 13, fontWeight: "600" },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "#e8e8e8"
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
    gap: 12
  },
  infoIcon: { fontSize: 18, marginTop: 2 },
  infoLabel: { fontSize: 12, color: "#999", marginBottom: 2 },
  infoValue: { fontSize: 14, color: "#1a1a1a", fontWeight: "500" },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ff3b30"
  },
  logoutText: { color: "#ff3b30", fontSize: 16, fontWeight: "600" }
});
EOF

echo -e "${GREEN}✅ Tous les fichiers de base sont créés !${NC}"
echo -e "${YELLOW}⚠️ Il manque encore : patient/[id].jsx, patient/new.jsx, patient/edit/[id].jsx, patient/trash.jsx, analyse/[id].jsx${NC}"

