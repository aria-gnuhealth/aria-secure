import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import api from "../../services/api";

export default function NewPatient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    medical_record_number: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "M",
    phone: "",
    address: "",
  });

  const update = (key, val) => setForm({ ...form, [key]: val });

  const handleCreate = async () => {
    if (!form.medical_record_number || !form.first_name || !form.last_name) {
      Alert.alert("Erreur", "Numéro de dossier, prénom et nom sont obligatoires");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.date_of_birth) delete payload.date_of_birth;
      if (!payload.phone) delete payload.phone;
      if (!payload.address) delete payload.address;

      await api.post("/patients", payload);
      Alert.alert("✅ Succès", "Dossier patient créé !", [
        { text: "OK", onPress: () => router.replace("/(tabs)/patients") }
      ]);
    } catch (error) {
      const msg = error.response?.data?.detail || "Erreur lors de la création";
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>‹ Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau patient</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Numéro de dossier *</Text>
          <TextInput style={styles.input} placeholder="Ex: 001" value={form.medical_record_number} onChangeText={v => update("medical_record_number", v)} />

          <Text style={styles.label}>Prénom *</Text>
          <TextInput style={styles.input} placeholder="Prénom" value={form.first_name} onChangeText={v => update("first_name", v)} />

          <Text style={styles.label}>Nom *</Text>
          <TextInput style={styles.input} placeholder="Nom" value={form.last_name} onChangeText={v => update("last_name", v)} />

          <Text style={styles.label}>Date de naissance (AAAA-MM-JJ)</Text>
          <TextInput style={styles.input} placeholder="1990-05-21" value={form.date_of_birth} onChangeText={v => update("date_of_birth", v)} />

          <Text style={styles.label}>Genre</Text>
          <View style={styles.genderRow}>
            {["M", "F"].map(g => (
              <TouchableOpacity key={g} style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]} onPress={() => update("gender", g)}>
                <Text style={[styles.genderTxt, form.gender === g && styles.genderTxtActive]}>{g === "M" ? "👨 Masculin" : "👩 Féminin"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Téléphone</Text>
          <TextInput style={styles.input} placeholder="699000000" value={form.phone} onChangeText={v => update("phone", v)} keyboardType="phone-pad" />

          <Text style={styles.label}>Adresse</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} placeholder="Adresse" value={form.address} onChangeText={v => update("address", v)} multiline />
        </View>

        <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Créer le dossier</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: { backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0" },
  backText: { fontSize: 16, color: "#1a73e8", marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  section: { backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: "#e8e8e8" },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: "#f8f9fa", borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, padding: 12, fontSize: 15, color: "#333" },
  genderRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  genderBtn: { flex: 1, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#f8f9fa" },
  genderBtnActive: { backgroundColor: "#e8f0fe", borderColor: "#1a73e8" },
  genderTxt: { fontSize: 14, color: "#555" },
  genderTxtActive: { color: "#1a73e8", fontWeight: "600" },
  createBtn: { backgroundColor: "#1a73e8", marginHorizontal: 16, marginTop: 24, borderRadius: 14, padding: 16, alignItems: "center" },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
