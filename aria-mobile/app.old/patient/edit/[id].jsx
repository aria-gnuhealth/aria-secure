import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../../services/api";

export default function EditPatient() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    medical_record_number: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "M",
    phone: "",
    address: ""
  });

  useEffect(() => {
    fetchPatient();
  }, []);

  const fetchPatient = async () => {
    try {
      const res = await api.get(`/patients/${id}`);
      const patient = res.data;
      setForm({
        medical_record_number: patient.medical_record_number || "",
        first_name: patient.first_name || "",
        last_name: patient.last_name || "",
        date_of_birth: patient.date_of_birth ? patient.date_of_birth.split('T')[0] : "",
        gender: patient.gender || "M",
        phone: patient.phone || "",
        address: patient.address || ""
      });
    } catch (e) {
      Alert.alert("Erreur", "Impossible de charger le patient");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const update = (key, val) => setForm({ ...form, [key]: val });

  const handleSave = async () => {
    if (!form.medical_record_number || !form.first_name || !form.last_name) {
      Alert.alert("Erreur", "Numéro de dossier, prénom et nom sont obligatoires");
      return;
    }
    if (form.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth)) {
      Alert.alert("Erreur", "Date de naissance au format AAAA-MM-JJ");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.date_of_birth) delete payload.date_of_birth;
      if (!payload.phone) delete payload.phone;
      if (!payload.address) delete payload.address;

      await api.put(`/patients/${id}`, payload);
      Alert.alert("✅ Succès", "Patient modifié !", [
        { text: "OK", onPress: () => router.push(`/patient/${id}`) }
      ]);
    } catch (e) {
      const msg = e.response?.data?.detail || "Erreur lors de la modification";
      Alert.alert("Erreur", msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier patient</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations obligatoires</Text>

          <Text style={styles.label}>Numéro de dossier *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 002"
            value={form.medical_record_number}
            onChangeText={v => update("medical_record_number", v)}
          />

          <Text style={styles.label}>Prénom *</Text>
          <TextInput
            style={styles.input}
            value={form.first_name}
            onChangeText={v => update("first_name", v)}
          />

          <Text style={styles.label}>Nom *</Text>
          <TextInput
            style={styles.input}
            value={form.last_name}
            onChangeText={v => update("last_name", v)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations complémentaires</Text>

          <Text style={styles.label}>Date de naissance</Text>
          <TextInput
            style={styles.input}
            placeholder="AAAA-MM-JJ"
            value={form.date_of_birth}
            onChangeText={v => update("date_of_birth", v)}
          />

          <Text style={styles.label}>Genre</Text>
          <View style={styles.genderRow}>
            {["M", "F"].map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]}
                onPress={() => update("gender", g)}
              >
                <Text style={[styles.genderTxt, form.gender === g && styles.genderTxtActive]}>
                  {g === "M" ? "👨 Masculin" : "👩 Féminin"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={v => update("phone", v)}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Adresse</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            value={form.address}
            onChangeText={v => update("address", v)}
            multiline
          />
        </View>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#fff", paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0"
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 16, color: "#1a73e8" },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  section: {
    backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: "#e8e8e8"
  },
  sectionTitle: {
    fontSize: 12, fontWeight: "700", color: "#999",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12
  },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: "#f8f9fa", borderWidth: 1, borderColor: "#e0e0e0",
    borderRadius: 10, padding: 12, fontSize: 15, color: "#333"
  },
  genderRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  genderBtn: {
    flex: 1, borderWidth: 1, borderColor: "#e0e0e0",
    borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#f8f9fa"
  },
  genderBtnActive: { backgroundColor: "#e8f0fe", borderColor: "#1a73e8" },
  genderTxt: { fontSize: 14, color: "#555" },
  genderTxtActive: { color: "#1a73e8", fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#1a73e8", marginHorizontal: 16, marginTop: 24,
    borderRadius: 14, padding: 16, alignItems: "center"
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
