import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../constants/theme";

export default function NotFound() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>Page introuvable</Text>
      <Text style={styles.subtitle}>La page que vous cherchez n'existe pas.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace("/(tabs)/dashboard")}>
        <Text style={styles.btnText}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A2A3F", alignItems: "center", justifyContent: "center", padding: 24 },
  code: { fontSize: 80, fontWeight: "900", color: "#FCD34D", lineHeight: 90 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 8 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 8, marginBottom: 32 },
  btn: { backgroundColor: "#FCD34D", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: "#0A2A3F", fontWeight: "700", fontSize: 16 },
});
