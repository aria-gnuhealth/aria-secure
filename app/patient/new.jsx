import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, StatusBar, Modal, FlatList
} from "react-native";
import { useRouter } from "expo-router";
import api from "../../services/api";
import { colors, shadows, radius, palette } from "../../constants/theme";
import { useSettings } from "../../contexts/SettingsContext";

const LOCATIONS = [
  "Yaoundé", "Douala", "Bafoussam", "Bamenda", "Garoua", "Maroua",
  "Ngaoundéré", "Bertoua", "Ebolowa", "Kribi", "Limbe", "Buea",
  "Kumba", "Nkongsamba", "Edéa", "Loum", "Mbouda", "Dschang",
  "Foumban", "Tibati", "Meiganga", "Guider", "Mora", "Kousseri",
  "Batouri", "Abong-Mbang", "Sangmélima", "Ambam", "Bafang", "Baham",
  "Adamaoua", "Centre", "Est", "Extrême-Nord", "Littoral",
  "Nord", "Nord-Ouest", "Ouest", "Sud", "Sud-Ouest"
].sort();

export default function NewPatient() {
  const router = useRouter();
  const { theme } = useSettings();
  const [loading, setLoading] = useState(false);
  const [mrnList, setMrnList] = useState([]);
  const [showMrnPicker, setShowMrnPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [addressSearch, setAddressSearch] = useState("");
  const [dateTemp, setDateTemp] = useState({ day: "", month: "", year: "" });
  const [form, setForm] = useState({
    medical_record_number: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "M",
    phone: "+237",
    address: ""
  });

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const bg = theme?.bg || colors.background;
  const surface = theme?.surface || colors.surface;
  const textColor = theme?.text || colors.textPrimary;
  const mutedColor = theme?.textMuted || colors.textMuted;
  const borderColor = theme?.border || colors.border;
  const inputBg = theme?.surfaceSecondary || colors.gray100;

  useEffect(() => { generateMrnList(); }, []);

  const generateMrnList = async () => {
    try {
      const res = await api.get("/patients/used-mrns");
      const existing = res.data.used_mrns || [];
      const list = [];
      for (let i = 1; i <= 999; i++) {
        const mrn = String(i).padStart(3, "0");
        if (!existing.includes(mrn)) list.push(mrn);
      }
      setMrnList(list.slice(0, 50));
      if (list.length > 0) update("medical_record_number", list[0]);
    } catch (e) {
      const list = [];
      for (let i = 1; i <= 50; i++) list.push(String(i).padStart(3, "0"));
      setMrnList(list);
      update("medical_record_number", list[0]);
    }
  };

  const confirmDate = () => {
    const { day, month, year } = dateTemp;
    if (!day || !month || !year || year.length !== 4) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }
    const d = parseInt(day), m = parseInt(month), y = parseInt(year);
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > new Date().getFullYear()) {
      Alert.alert("Erreur", "Date invalide");
      return;
    }
    update("date_of_birth", `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    setShowDatePicker(false);
  };

  const filteredLocations = LOCATIONS.filter(l => l.toLowerCase().includes(addressSearch.toLowerCase()));

  const handleCreate = async () => {
    if (!form.medical_record_number || !form.first_name || !form.last_name) {
      Alert.alert("Erreur", "Numéro de dossier, prénom et nom sont obligatoires");
      return;
    }
    if (!form.phone || form.phone === "+237" || form.phone.length < 12) {
      Alert.alert("Erreur", "Le numéro de téléphone est obligatoire (+237XXXXXXXXX)");
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.date_of_birth) delete payload.date_of_birth;
      if (!payload.address) delete payload.address;
      await api.post("/patients", payload);
      Alert.alert("Patient créé", "Dossier médical créé avec succès !", [
        { text: "OK", onPress: () => router.replace("/(tabs)/patients") }
      ]);
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
      <StatusBar backgroundColor={palette.navy} barStyle="light-content" />
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{"<"} Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau patient</Text>
          <Text style={styles.headerSub}>Créer un dossier médical</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.section, { backgroundColor: surface }]}>
            <Text style={[styles.sectionTitle, { color: mutedColor }]}>INFORMATIONS OBLIGATOIRES</Text>

            <Text style={[styles.label, { color: textColor }]}>Numéro de dossier</Text>
            <View style={[styles.input, styles.autoMrnField, { backgroundColor: "transparent", borderColor: borderColor + "60" }]}>
              <Text style={[styles.autoMrnText, { color: mutedColor }]}>
                {form.medical_record_number ? "N° " + form.medical_record_number + " (attribué automatiquement)" : "Génération en cours..."}
              </Text>
            </View>

            <Text style={[styles.label, { color: textColor }]}>Prénom *</Text>
            <TextInput style={[styles.input, { backgroundColor: inputBg, borderColor, color: textColor }]} placeholder="Prénom du patient" placeholderTextColor={mutedColor} value={form.first_name} onChangeText={v => update("first_name", v)} />

            <Text style={[styles.label, { color: textColor }]}>Nom *</Text>
            <TextInput style={[styles.input, { backgroundColor: inputBg, borderColor, color: textColor }]} placeholder="Nom du patient" placeholderTextColor={mutedColor} value={form.last_name} onChangeText={v => update("last_name", v)} />

            <Text style={[styles.label, { color: textColor }]}>{"Téléphone * (obligatoire)"}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor, color: textColor }]}
              placeholder="+237699000000"
              placeholderTextColor={mutedColor}
              value={form.phone}
              onChangeText={v => { if (!v.startsWith("+237")) { update("phone", "+237" + v.replace(/^\+237/, "")); } else { update("phone", v); } }}
              keyboardType="phone-pad"
            />
          </View>

          <View style={[styles.section, { backgroundColor: surface }]}>
            <Text style={[styles.sectionTitle, { color: mutedColor }]}>INFORMATIONS COMPLÉMENTAIRES</Text>

            <Text style={[styles.label, { color: textColor }]}>Date de naissance</Text>
            <TouchableOpacity style={[styles.input, styles.pickerBtn, { backgroundColor: inputBg, borderColor }]} onPress={() => setShowDatePicker(true)}>
              <Text style={[styles.pickerText, { color: form.date_of_birth ? textColor : mutedColor }]}>
                {form.date_of_birth ? new Date(form.date_of_birth).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Sélectionner une date"}
              </Text>
              <Text style={{ color: mutedColor }}>{"📅"}</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { color: textColor }]}>Genre</Text>
            <View style={styles.genderRow}>
              {[{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }].map(g => (
                <TouchableOpacity key={g.value} style={[styles.genderBtn, { borderColor, backgroundColor: inputBg }, form.gender === g.value && { backgroundColor: colors.primaryBg, borderColor: colors.primary }]} onPress={() => update("gender", g.value)}>
                  <Text style={[{ color: colors.textSecondary, fontSize: 14 }, form.gender === g.value && { color: colors.primary, fontWeight: "600" }]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: textColor }]}>Ville / Région</Text>
            <TouchableOpacity style={[styles.input, styles.pickerBtn, { backgroundColor: inputBg, borderColor }]} onPress={() => { setAddressSearch(""); setShowAddressPicker(true); }}>
              <Text style={[styles.pickerText, { color: form.address ? textColor : mutedColor }]}>{form.address || "Sélectionner une ville ou région"}</Text>
              <Text style={{ color: mutedColor }}>{"▾"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.createBtn, loading && { opacity: 0.7 }]} onPress={handleCreate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>{"Créer le dossier →"}</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: surface }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Date de naissance</Text>
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dateLabel, { color: mutedColor }]}>Jour</Text>
                <TextInput style={[styles.dateInput, { backgroundColor: inputBg, borderColor, color: textColor }]} placeholder="JJ" placeholderTextColor={mutedColor} value={dateTemp.day} onChangeText={v => setDateTemp(p => ({ ...p, day: v }))} keyboardType="numeric" maxLength={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dateLabel, { color: mutedColor }]}>Mois</Text>
                <TextInput style={[styles.dateInput, { backgroundColor: inputBg, borderColor, color: textColor }]} placeholder="MM" placeholderTextColor={mutedColor} value={dateTemp.month} onChangeText={v => setDateTemp(p => ({ ...p, month: v }))} keyboardType="numeric" maxLength={2} />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={[styles.dateLabel, { color: mutedColor }]}>Année</Text>
                <TextInput style={[styles.dateInput, { backgroundColor: inputBg, borderColor, color: textColor }]} placeholder="AAAA" placeholderTextColor={mutedColor} value={dateTemp.year} onChangeText={v => setDateTemp(p => ({ ...p, year: v }))} keyboardType="numeric" maxLength={4} />
              </View>
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmDate}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Confirmer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowDatePicker(false)}>
              <Text style={{ color: colors.danger, fontWeight: "700" }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddressPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: surface }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Ville / Région</Text>
            <TextInput style={[styles.searchInput, { backgroundColor: inputBg, borderColor, color: textColor }]} placeholder="Rechercher..." placeholderTextColor={mutedColor} value={addressSearch} onChangeText={setAddressSearch} />
            <FlatList data={filteredLocations} keyExtractor={item => item} style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.modalItem, item === form.address && { backgroundColor: colors.primaryBg }]} onPress={() => { update("address", item); setShowAddressPicker(false); }}>
                  <Text style={[styles.modalItemText, { color: textColor }, item === form.address && { color: colors.primary, fontWeight: "700" }]}>{item}</Text>
                  {item === form.address && <Text style={{ color: colors.primary }}>{"✓"}</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowAddressPicker(false)}>
              <Text style={{ color: colors.danger, fontWeight: "700" }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { backgroundColor: palette.navy, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  backBtn: { marginBottom: 8 },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 16 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  content: { padding: 16 },
  section: { borderRadius: radius.xl, padding: 16, marginBottom: 16, ...shadows.small },
  sectionTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1.5, borderRadius: radius.md, padding: 12, fontSize: 15 },
  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  autoMrnField: { flexDirection: "row", alignItems: "center", borderStyle: "dashed" },
  autoMrnText: { fontSize: 13, fontStyle: "italic", flex: 1 },
  pickerText: { fontSize: 15, flex: 1 },
  genderRow: { flexDirection: "row", gap: 10 },
  genderBtn: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, padding: 12, alignItems: "center" },
  createBtn: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: 16, alignItems: "center", ...shadows.medium },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 16, textAlign: "center" },
  modalItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  modalItemText: { fontSize: 15 },
  modalClose: { alignItems: "center", paddingVertical: 16, marginTop: 8 },
  searchInput: { borderWidth: 1.5, borderRadius: radius.md, padding: 10, fontSize: 14, marginBottom: 12 },
  dateRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  dateLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  dateInput: { borderWidth: 1.5, borderRadius: radius.md, padding: 10, fontSize: 15, textAlign: "center" },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 14, alignItems: "center", marginBottom: 8 },
});
