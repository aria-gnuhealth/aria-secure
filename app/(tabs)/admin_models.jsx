import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, TextInput, ActivityIndicator, Modal,
  StatusBar, ScrollView, KeyboardAvoidingView, Platform
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { colors, radius, shadows } from "../../constants/theme";
import { useSettings } from "../../contexts/SettingsContext";

const MODEL_COLOR = "#0F4C81";

const getIcon = arch => {
  if (!arch) return "🤖";
  if (arch.includes("Dense")) return "🫁";
  if (arch.includes("Efficient")) return "🦴";
  return "🤖";
};

export default function AdminModelsScreen() {
  const { user } = useAuth();
  const { theme, darkMode } = useSettings();
  const bg = darkMode ? theme.bg : colors.background;
  const surface = darkMode ? theme.surface : colors.surface;
  const textPrimary = darkMode ? theme.text : colors.textPrimary;
  const textMuted = darkMode ? theme.textMuted : colors.textMuted;
  const border = darkMode ? theme.border : colors.border;

  const [models, setModels] = useState([]);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", version: "1.0.0", architecture: "",
    description: "", input_shape: "224x224x3", output_classes: [], accuracy: 0
  });
  const [saving, setSaving] = useState(false);

  const fetchModels = useCallback(async () => {
    try {
      const res = await api.get("/ai-models", { params: { limit: 100 } });
      setModels(res.data?.items || res.data || []);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de charger les modèles");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchModels(); }, []);

  const filtered = models.filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.architecture?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: models.length,
    actifs: models.filter(m => m.is_active).length,
    inactifs: models.filter(m => !m.is_active).length,
  };

  const toggleActive = async (model) => {
    try {
      if (!model.is_active) {
        await api.post(`/ai-models/${model.id}/activate`);
      } else {
        await api.put(`/ai-models/${model.id}`, { ...model, is_active: false });
      }
      setModels(prev => prev.map(m => m.id === model.id ? { ...m, is_active: !m.is_active } : m));
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de modifier le statut");
    }
  };

  const deleteModel = (model) => {
    Alert.alert("🗑️ Supprimer", `Supprimer ${model.name} v${model.version} ?\n\nCette action est irréversible.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/ai-models/${model.id}`);
            setModels(prev => prev.filter(m => m.id !== model.id));
          } catch (e) { Alert.alert("Erreur", "Impossible de supprimer"); }
        }
      }
    ]);
  };

  const saveModel = async () => {
    if (!form.name || !form.architecture) {
      Alert.alert("Erreur", "Nom et architecture requis");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/ai-models", {
        ...form,
        classes: form.output_classes || [],
        precision: parseFloat(form.accuracy) || 0
      });
      setModels(prev => [res.data, ...prev]);
      setShowForm(false);
      setForm({ name: "", version: "1.0.0", architecture: "", description: "", input_shape: "224x224x3", output_classes: [], accuracy: 0 });
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de créer");
    } finally { setSaving(false); }
  };

  const renderModel = ({ item: m }) => (
    <View style={[styles.card, { backgroundColor: surface }]}>
      <View style={[styles.cardAccent, { backgroundColor: m.is_active ? "#10b981" : "#ef4444" }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.iconWrap}>
            <Text style={styles.cardIcon}>{getIcon(m.architecture)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardName, { color: textPrimary }]}>{m.name}</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v{m.version}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: m.is_active ? "#d1fae5" : "#fee2e2" }]}>
                <Text style={[styles.statusText, { color: m.is_active ? "#065f46" : "#991b1b" }]}>
                  {m.is_active ? "✅ Actif" : "⏸ Inactif"}
                </Text>
              </View>
            </View>
            <Text style={[styles.cardArch, { color: textMuted }]}>
              {m.architecture}  •  {m.input_shape || "224x224x3"}
              {m.accuracy ? `  •  ${(m.accuracy * 100).toFixed(1)}%` : ""}
            </Text>
          </View>
        </View>

        {m.output_classes && m.output_classes.length > 0 && (
          <View style={styles.classesList}>
            {m.output_classes.slice(0, 5).map((c, i) => (
              <View key={i} style={styles.classChip}>
                <Text style={styles.classText}>{c}</Text>
              </View>
            ))}
            {m.output_classes.length > 5 && (
              <View style={[styles.classChip, { backgroundColor: colors.border }]}>
                <Text style={styles.classText}>+{m.output_classes.length - 5}</Text>
              </View>
            )}
          </View>
        )}

        {m.description && (
          <Text style={[styles.desc, { color: textMuted }]} numberOfLines={2}>{m.description}</Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={[styles.cardDate, { color: textMuted }]}>
            📅 {new Date(m.created_at).toLocaleDateString("fr-FR")}
            {m.deployed_at ? `  •  🚀 ${new Date(m.deployed_at).toLocaleDateString("fr-FR")}` : ""}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, m.is_active ? styles.pauseBtn : styles.playBtn]}
              onPress={() => toggleActive(m)}
            >
              <Text style={styles.actionBtnText}>{m.is_active ? "⏸ Pause" : "▶ Activer"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => deleteModel(m)}>
              <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  if (user?.role !== "admin") return (
    <View style={styles.center}>
      <Text style={{ fontSize: 48 }}>🔒</Text>
      <Text style={styles.noAccess}>Accès réservé aux administrateurs</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar backgroundColor={MODEL_COLOR} barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🤖 Modèles IA</Text>
          <Text style={styles.headerSub}>{stats.total} modèle{stats.total > 1 ? "s" : ""} enregistré{stats.total > 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.newBtnText}>+ Nouveau</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: "Total", value: stats.total, icon: "🗂️" },
          { label: "Actifs", value: stats.actifs, icon: "✅", color: "#6ee7b7" },
          { label: "Inactifs", value: stats.inactifs, icon: "⏸", color: "#fca5a5" },
        ].map((s, i) => (
          <View key={i} style={styles.statBox}>
            <Text style={styles.statIcon}>{s.icon}</Text>
            <Text style={[styles.statValue, { color: s.color || "#fff" }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.searchWrapper, { backgroundColor: surface, borderColor: border }]}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: textPrimary }]}
          placeholder="Rechercher par nom, architecture..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={MODEL_COLOR} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={m => m.id}
          renderItem={renderModel}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchModels(); }}
              colors={[MODEL_COLOR]}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🤖</Text>
              <Text style={[styles.empty, { color: textMuted }]}>Aucun modèle trouvé</Text>
            </View>
          }
        />
      )}

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
          <View style={styles.modalBg}>
            <View style={[styles.modal, { backgroundColor: surface }]}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: textPrimary }]}>➕ Nouveau Modèle IA</Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {[
                  { label: "Nom *", key: "name", placeholder: "ex: CheXpert" },
                  { label: "Version", key: "version", placeholder: "ex: 1.0.0" },
                  { label: "Architecture *", key: "architecture", placeholder: "ex: DenseNet121" },
                  { label: "Description", key: "description", placeholder: "Description courte" },
                  { label: "Input Shape", key: "input_shape", placeholder: "224x224x3" },
                  { label: "Précision (0-1)", key: "accuracy", placeholder: "ex: 0.87", keyboard: "numeric" },
                ].map(f => (
                  <View key={f.key} style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, { color: textPrimary }]}>{f.label}</Text>
                    <TextInput
                      style={[styles.fieldInput, { backgroundColor: bg, borderColor: border, color: textPrimary }]}
                      placeholder={f.placeholder}
                      placeholderTextColor={colors.textMuted}
                      value={String(form[f.key])}
                      onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                      keyboardType={f.keyboard || "default"}
                    />
                  </View>
                ))}
              </ScrollView>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={saveModel} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Créer →</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  noAccess: { fontSize: 16, color: colors.textMuted, textAlign: "center", marginTop: 12 },
  empty: { fontSize: 14 },
  header: {
    backgroundColor: MODEL_COLOR,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  newBtn: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: radius.full,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
  },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  statsRow: {
    flexDirection: "row", backgroundColor: MODEL_COLOR,
    paddingHorizontal: 16, paddingBottom: 16, gap: 8,
  },
  statBox: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md, padding: 12, alignItems: "center",
  },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  searchWrapper: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginVertical: 12,
    borderRadius: radius.lg, paddingHorizontal: 14, height: 46, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  card: { borderRadius: radius.lg, marginBottom: 12, flexDirection: "row", overflow: "hidden", ...shadows.small },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" },
  cardIcon: { fontSize: 24 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  cardName: { fontSize: 16, fontWeight: "800" },
  versionBadge: { backgroundColor: "#E2E8F0", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  versionText: { fontSize: 11, color: "#475569", fontWeight: "700" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "700" },
  cardArch: { fontSize: 12, marginTop: 4 },
  classesList: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 8 },
  classChip: { backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  classText: { fontSize: 10, color: MODEL_COLOR, fontWeight: "600" },
  desc: { fontSize: 12, fontStyle: "italic", marginBottom: 8 },
  cardFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9",
  },
  cardDate: { fontSize: 11, flex: 1 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  pauseBtn: { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" },
  playBtn: { backgroundColor: "#D1FAE5", borderColor: "#10B981" },
  deleteBtn: { backgroundColor: "#FEE2E2", borderColor: "#DC2626" },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: "#92400E" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
  modalHandle: { width: 40, height: 4, backgroundColor: "#CBD5E1", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  fieldInput: { borderWidth: 1.5, borderRadius: radius.md, padding: 12, fontSize: 14 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, height: 50, justifyContent: "center", alignItems: "center" },
  cancelText: { color: colors.textSecondary, fontWeight: "600" },
  saveBtn: { flex: 2, backgroundColor: MODEL_COLOR, borderRadius: radius.md, height: 50, justifyContent: "center", alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
