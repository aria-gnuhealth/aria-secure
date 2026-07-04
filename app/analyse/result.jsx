import { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import api from "../../services/api";

export default function AnalyseResult() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [analyse, setAnalyse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log("🔍 Paramètre id reçu :", id);

  useEffect(() => {
    if (id) {
      fetchAnalyse(id);
    } else {
      setError("ID d'analyse manquant");
      setLoading(false);
    }
  }, [id]);

  const fetchAnalyse = async (analysisId) => {
    try {
      console.log("📡 Appel API : /analyze/" + analysisId + "/result");
      const res = await api.get(`/analyze/${analysisId}/result`);
      console.log("📦 Réponse brute :", JSON.stringify(res.data, null, 2));
      setAnalyse(res.data);
    } catch (e) {
      console.log("❌ Erreur fetch:", e);
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: "red", fontSize: 16 }}>❌ {error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: "#1a73e8", fontSize: 16 }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!analyse) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 18, color: "#555" }}>Aucun résultat</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: "#1a73e8", fontSize: 16 }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Affichage des données brutes (pour debug)
  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.container}>
      <Text style={styles.title}>📦 Données reçues</Text>
      <Text style={styles.json}>{JSON.stringify(analyse, null, 2)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 16, color: "#1a1a1a" },
  json: { fontSize: 11, color: "#333", fontFamily: "monospace" },
});
