import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, StatusBar,
  KeyboardAvoidingView, Platform, Image, Modal,
  Dimensions, TouchableWithoutFeedback, ScrollView
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { useSettings } from "../../contexts/SettingsContext";
import { colors, shadows, radius, palette } from "../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme } = useSettings();
  const [discussion, setDiscussion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [findings, setFindings] = useState([]);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validateComment, setValidateComment] = useState("");
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const flatListRef = useRef(null);
  const pollingRef = useRef(null);

  // WebSocket temps réel
  const handleWsMessage = useCallback((data) => {
    console.log("WS reçu:", JSON.stringify(data));
    if (data.type === "new_message") {
      console.log("discussion_id reçu:", data.discussion_id, "id actuel:", id);
      if (data.discussion_id === id || data.discussion_id === String(id)) {
        if (data.id && data.content !== undefined) {
          setMessages(prev => {
            const exists = prev.find(m => m.id === data.id);
            if (exists) return prev;
            return [...prev, data];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } else {
          fetchMessages();
        }
      }
    }
  }, [id]);
  useWebSocket(handleWsMessage);

  useEffect(() => {
    fetchAll();
    startPolling();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [id]);

  const fetchAll = async () => {
    await Promise.all([fetchDiscussion(), fetchMessages(), fetchAnalysis()]);
    setLoading(false);
  };

  const fetchDiscussion = async () => {
    try {
      const res = await api.get(`/chat/discussions/${id}`);
      setDiscussion(res.data);
    } catch (e) {}
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/chat/discussions/${id}/messages`);
      const msgs = res.data || [];
      setMessages(msgs);
      // Marquer comme lus
      msgs.forEach(async (m) => {
        if (m.sender_id !== user?.id && !m.read_at) {
          try { await api.put(`/chat/messages/${m.id}/read`); } catch (e) {}
        }
      });
    } catch (e) {}
  };

  const fetchAnalysis = async () => {
    try {
      const discRes = await api.get(`/chat/discussions/${id}`);
      const analysisId = discRes.data?.analysis_id;
      console.log("Discussion data:", JSON.stringify(discRes.data));
      console.log("Analysis ID:", analysisId);
      if (!analysisId) {
        console.log("Pas d analyse liée à cette discussion");
        return;
      }
      const res = await api.get(`/analyze/${analysisId}/result`);
      console.log("Analysis result:", JSON.stringify(res.data));
      // Normaliser l'objet analysis avec id
      const analysisData = { ...res.data, id: res.data.analysis_id || analysisId };
      setAnalysis(analysisData);
      setFindings(res.data?.findings || []);
      setValidated(!!res.data?.validated_at);
      // Charger la heatmap en priorité
      if (res.data?.heatmap_url) {
        setHeatmapUrl(res.data.heatmap_url);
      }
      if (res.data?.image_id) {
        try {
          const urlRes = await api.get(`/images/${res.data.image_id}/url`);
          setImageUrl(urlRes.data.url);
        } catch (e) {}
      }
    } catch (e) {}
  };

  const rejectAnalysis = async () => {
    if (!rejectMotif.trim()) {
      Alert.alert("Erreur", "Veuillez saisir un motif de rejet");
      return;
    }
    try {
      await api.post(`/radiologist/reject/${analysis.id}?reason=${encodeURIComponent(rejectMotif)}`);
      Alert.alert("❌ Rejeté", "L'analyse a été rejetée. Le médecin sera notifié.");
      setShowRejectModal(false);
      setRejectMotif("");
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || e.message);
    }
  };

  const validateAnalysis = async () => {
    console.log("validateAnalysis called, analysis:", JSON.stringify(analysis?.id), "showModal:", showValidateModal);
    if (!analysis?.id) {
      Alert.alert("Erreur", "Aucune analyse liée à cette consultation");
      return;
    }
    setValidating(true);
    try {
      await api.post(`/radiologist/validate/${analysis.id}`, null, {
        params: { comment: validateComment }
      });
      setValidated(true);
      setShowValidateModal(false);
      // Envoyer message automatique dans le chat
      await api.post(`/chat/discussions/${id}/messages`, {
        content: `✅ Analyse validée par le radiologue${validateComment ? `. Commentaire : ${validateComment}` : "."}`,
        message_type: "text"
      });
      fetchMessages();
      Alert.alert("✅ Analyse validée", "L'utilisateur a été notifié.");
    } catch (e) {
      Alert.alert("Erreur", e.response?.data?.detail || "Impossible de valider");
    } finally {
      setValidating(false);
    }
  };

  const startPolling = () => {
    // WebSocket gere les mises a jour en temps reel
      };

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    const content = message.trim();
    setMessage("");
    try {
      const res = await api.post(`/chat/discussions/${id}/messages`, {
        content, message_type: "text"
      });
      setMessages(prev => {
        if (prev.find(m => m.id === res.data.id)) return prev;
        return [...prev, res.data];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert("Erreur", "Impossible d'envoyer le message");
      setMessage(content);
    } finally {
      setSending(false);
    }
  };

  const closeDiscussion = () => {
    Alert.alert("Fermer la consultation", "Marquer comme terminée ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Fermer", style: "destructive", onPress: async () => {
          try {
            await api.put(`/chat/discussions/${id}/status`, { status: "closed" });
            router.back();
          } catch (e) {
            Alert.alert("Erreur", "Impossible de fermer");
          }
        }
      }
    ]);
  };

  const formatTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return "Hier";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  };

  // Ticks de lecture style WhatsApp
  const ReadTicks = ({ isMine, isRead }) => {
    if (!isMine) return null;
    return (
      <Text style={[styles.ticks, isRead && styles.ticksRead]}>
        {isRead ? "✓✓" : "✓"}
      </Text>
    );
  };

  // Urgence config
  const getUrgencyConfig = (level) => ({
    "CRITIQUE": { color: colors.danger,  bg: colors.dangerBg,  label: "🔴 CRITIQUE" },
    "ÉLEVÉ":    { color: colors.warning, bg: colors.warningBg, label: "🟡 ÉLEVÉ" },
    "NORMAL":   { color: colors.success, bg: colors.successBg, label: "🟢 NORMAL" },
  })[level] || { color: colors.info, bg: colors.infoBg, label: level || "NORMAL" };

  const deleteMessage = (msgId) => {
    Alert.alert(
      "🗑️ Supprimer le message",
      "Voulez-vous supprimer ce message ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/chat/messages/${msgId}`);
              setMessages(prev => prev.filter(m => m.id !== msgId));
            } catch (e) {
              Alert.alert("Erreur", "Impossible de supprimer ce message");
            }
          }
        }
      ]
    );
  };

  const renderMessage = ({ item, index }) => {
    const isMine = item.sender_id === user?.id;
    const prevMsg = messages[index - 1];
    const showDate = !prevMsg || formatDate(item.created_at) !== formatDate(prevMsg.created_at);
    const isRead = !!item.read_at;
    const initials = item.sender_name
      ? item.sender_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
      : "??";

    return (
      <View>
        {/* Séparateur de date */}
        {showDate && (
          <View style={styles.dateSep}>
            <View style={styles.dateSepLine} />
            <Text style={styles.dateSepText}>{formatDate(item.created_at)}</Text>
            <View style={styles.dateSepLine} />
          </View>
        )}

        <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
          {/* Avatar expéditeur */}
          {!isMine && (
            <View style={styles.msgAvatar}>
              <Text style={styles.msgAvatarText}>{initials}</Text>
            </View>
          )}

          {/* Bulle */}
          <TouchableOpacity
            style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}
            onLongPress={() => isMine && deleteMessage(item.id)}
            activeOpacity={1}
            delayLongPress={500}
          >
            {/* Nom expéditeur (si pas moi) */}
            {!isMine && item.sender_name && (
              <Text style={styles.senderName}>{item.sender_name}</Text>
            )}

            <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
              {item.content}
            </Text>

            {/* Footer bulle */}
            <View style={styles.bubbleFooter}>
              <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
                {formatTime(item.created_at)}
              </Text>
              <ReadTicks isMine={isMine} isRead={isRead} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const urgConf = getUrgencyConfig(analysis?.urgency_level);

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 25}
    >
      <StatusBar backgroundColor={palette.navy} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerMiddle}>
          <View style={styles.headerAvatarSmall}>
            <Text style={styles.headerAvatarText}>💬</Text>
          </View>
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>Consultation</Text>
            <View style={styles.headerStatusRow}>
              <View style={[styles.headerDot, {
                backgroundColor: discussion?.status === "open" ? colors.success : colors.textMuted
              }]} />
              <Text style={styles.headerSub}>
                {discussion?.status === "open" ? "En cours" : "Terminée"}
              </Text>
            </View>
          </View>
        </View>
        {discussion?.status !== "closed" && (
          <TouchableOpacity style={styles.closeBtn} onPress={closeDiscussion}>
            <Text style={styles.closeBtnText}>Fermer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Carte analyse avec annotations */}
      {analysis && (
        <View style={styles.analysisCard}>
          <View style={styles.analysisTop}>
            <Text style={styles.analysisTitle}>🔬 Radiographie analysée</Text>
            <View style={[styles.urgBadge, { backgroundColor: urgConf.bg }]}>
              <Text style={[styles.urgText, { color: urgConf.color }]}>{urgConf.label}</Text>
            </View>
          </View>


          {(heatmapUrl || imageUrl) && (
            <TouchableOpacity onPress={() => setShowImageModal(true)} activeOpacity={0.9} style={styles.imageWrap}>
              <Image source={{ uri: heatmapUrl || imageUrl }} style={styles.analysisImg} resizeMode="contain" />
              <View style={[styles.zoomHint, heatmapUrl ? { backgroundColor: "rgba(31,107,158,0.85)" } : {}]}>
                <Text style={styles.zoomHintText}>{heatmapUrl ? "🔥 Heatmap Grad-CAM · 🔍 Agrandir" : "🔍 Agrandir"}</Text>
              </View>
            </TouchableOpacity>
          )}
          {/* Stats analyse */}
          <View style={styles.analysisStats}>
            <View style={styles.analysisStat}>
              <Text style={styles.analysisStatValue}>
                {((analysis.confidence_score || 0) * 100).toFixed(0)}%
              </Text>
              <Text style={styles.analysisStatLabel}>Confiance</Text>
            </View>
            <View style={styles.analysisStatDivider} />
            <View style={styles.analysisStat}>
              <Text style={styles.analysisStatValue}>{findings.length}</Text>
              <Text style={styles.analysisStatLabel}>Anomalies</Text>
            </View>
            <View style={styles.analysisStatDivider} />
            <View style={styles.analysisStat}>
              <Text style={styles.analysisStatValue}>{analysis.model?.name || "IA"}</Text>
              <Text style={styles.analysisStatLabel}>Modèle</Text>
            </View>
          </View>

          {/* Findings liste */}
          {findings.length > 0 && (
            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={styles.findingsRow}>
              {findings.map((f, i) => (
                <View key={i} style={[styles.findingChip, {
                  backgroundColor: f.severity === "high" ? colors.dangerBg : f.severity === "medium" ? colors.warningBg : colors.successBg
                }]}>
                  <View style={[styles.findingDot, {
                    backgroundColor: f.severity === "high" ? colors.danger : f.severity === "medium" ? colors.warning : colors.success
                  }]} />
                  <Text style={[styles.findingText, {
                    color: f.severity === "high" ? colors.danger : f.severity === "medium" ? colors.warning : colors.success
                  }]}>{f.label || `Anomalie ${i + 1}`}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Bouton validation radiologue */}
      {analysis && user?.role === "radiologist" && (
        <View style={styles.validateWrap}>
          {validated ? (
            <View style={styles.validatedBadge}>
              <Text style={styles.validatedIcon}>✅</Text>
              <Text style={styles.validatedText}>Analyse validée par vous</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={styles.validateBtn}
                onPress={() => setShowValidateModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.validateBtnIcon}>✅</Text>
                <Text style={styles.validateBtnText}>Valider cette analyse</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.validateBtn, { backgroundColor: "#E74C3C" }]}
                onPress={() => setShowRejectModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.validateBtnIcon}>❌</Text>
                <Text style={styles.validateBtnText}>Rejeter cette analyse</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Badge validation côté user */}
      {analysis && user?.role === "doctor" && validated && (
        <View style={styles.validateWrap}>
          <View style={[styles.validatedBadge, { backgroundColor: colors.successBg }]}>
            <Text style={styles.validatedIcon}>✅</Text>
            <Text style={[styles.validatedText, { color: colors.success }]}>
              Analyse vérifiée par un radiologue
            </Text>
          </View>
        </View>
      )}

      {/* Modal validation */}
      <Modal
        visible={showValidateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowValidateModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowValidateModal(false)}>
          <View style={styles.modalBg}>
            <TouchableWithoutFeedback>
              <View style={styles.validateModal}>
                <Text style={styles.validateModalTitle}>✅ Valider l'analyse</Text>
                <Text style={styles.validateModalSub}>
                  Confirmez-vous que l'analyse IA est correcte ?
                </Text>
                <TextInput
                  style={styles.validateInput}
                  placeholder="Commentaire clinique (optionnel)..."
                  placeholderTextColor={colors.textMuted}
                  value={validateComment}
                  onChangeText={setValidateComment}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.validateModalBtns}>
                  <TouchableOpacity
                    style={styles.validateModalCancel}
                    onPress={() => setShowValidateModal(false)}
                  >
                    <Text style={styles.validateModalCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.validateModalConfirm, validating && { opacity: 0.7 }]}
                    onPress={validateAnalysis}
                    disabled={validating}
                  >
                    {validating
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.validateModalConfirmText}>Confirmer</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal rejet */}
      <Modal visible={showRejectModal} transparent animationType="slide" onRequestClose={() => setShowRejectModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowRejectModal(false)}>
          <View style={styles.modalBg}>
            <TouchableWithoutFeedback>
              <View style={styles.validateModal}>
                <Text style={[styles.validateModalTitle, { color: "#E74C3C" }]}>❌ Rejeter l'analyse</Text>
                <Text style={styles.validateModalSub}>Expliquez le motif du rejet au médecin.</Text>
                <TextInput
                  style={styles.validateInput}
                  placeholder="Motif du rejet..."
                  placeholderTextColor={colors.textMuted}
                  value={rejectMotif}
                  onChangeText={setRejectMotif}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.validateModalBtns}>
                  <TouchableOpacity style={styles.validateModalCancel} onPress={() => setShowRejectModal(false)}>
                    <Text style={styles.validateModalCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.validateModalConfirm, { backgroundColor: "#E74C3C" }]} onPress={rejectAnalysis}>
                    <Text style={styles.validateModalConfirmText}>Rejeter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.msgList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={() => (
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatIcon}>💬</Text>
            <Text style={styles.emptyChatTitle}>Démarrez la conversation</Text>
            <Text style={styles.emptyChatSub}>
              {user?.role === "doctor"
                ? "Décrivez votre cas au radiologue"
                : "Attendez le message du médecin"
              }
            </Text>
          </View>
        )}
      />

      {/* Zone saisie */}
      {discussion?.status === "closed" ? (
        <View style={styles.closedBar}>
          <Text style={styles.closedBarText}>✅ Consultation terminée</Text>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Votre message..."
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!message.trim() || sending) && styles.sendBtnOff]}
            onPress={sendMessage}
            disabled={!message.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendBtnIcon}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Modal image plein écran avec annotations */}
      <Modal visible={showImageModal} transparent animationType="fade" onRequestClose={() => setShowImageModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowImageModal(false)}>
          <View style={styles.modalBg}>
            <TouchableWithoutFeedback>
              <View style={styles.modalBox}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowImageModal(false)}>
                  <Text style={styles.modalCloseIcon}>✕</Text>
                </TouchableOpacity>

                <View style={styles.modalImgWrap}>
                  {(heatmapUrl || imageUrl) && (
                    <Image
                      source={{ uri: heatmapUrl || imageUrl }}
                      style={styles.modalImg}
                      resizeMode="contain"
                    />
                  )}
                </View>

                {/* Info footer modal */}
                <View style={styles.modalFooter}>
                  <View style={[styles.modalUrgBadge, { backgroundColor: urgConf.bg }]}>
                    <Text style={[styles.modalUrgText, { color: urgConf.color }]}>{urgConf.label}</Text>
                  </View>
                  <Text style={styles.modalScore}>
                    Score IA : {((analysis?.confidence_score || 0) * 100).toFixed(1)}%
                  </Text>
                </View>

                {/* Légende annotations */}
                {findings.length > 0 && (
                  <View style={styles.modalLegend}>
                    <Text style={styles.modalLegendTitle}>Anomalies détectées :</Text>
                    {findings.map((f, i) => (
                      <View key={i} style={styles.modalLegendItem}>
                        <View style={[styles.modalLegendDot, {
                          backgroundColor: f.severity === "high" ? colors.danger : f.severity === "medium" ? colors.warning : colors.success
                        }]} />
                        <Text style={styles.modalLegendText}>
                          {f.label || `Zone ${i + 1}`}
                          {f.confidence ? ` — ${(f.confidence * 100).toFixed(0)}%` : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EEF2F7" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    backgroundColor: palette.navy,
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 30, color: "#fff", fontWeight: "300" },
  headerMiddle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatarSmall: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  headerAvatarText: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  headerDot: { width: 7, height: 7, borderRadius: 3.5 },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.65)" },
  closeBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7,
  },
  closeBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // Carte analyse
  analysisCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 12, marginTop: 10,
    borderRadius: radius.xl, overflow: "hidden",
    ...shadows.small,
  },
  analysisTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 12,
  },
  analysisTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  urgBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  urgText: { fontSize: 11, fontWeight: "700" },

  imageWrap: { position: "relative" },
  analysisImg: { width: "100%", height: 160, backgroundColor: "#000" },
  annotationsOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  annotationPin: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 4 },
  annotationDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#fff" },
  annotationLabel: {
    backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3, maxWidth: 90,
  },
  annotationText: { color: "#fff", fontSize: 9, fontWeight: "600" },
  zoomHint: {
    position: "absolute", bottom: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  zoomHintText: { color: "#fff", fontSize: 10 },

  // Stats analyse
  analysisStats: {
    flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  analysisStat: { flex: 1, alignItems: "center" },
  analysisStatValue: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  analysisStatLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  analysisStatDivider: { width: 1, backgroundColor: colors.border },

  // Findings chips
  findingsRow: { paddingHorizontal: 12, paddingBottom: 10 },
  findingChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
    marginRight: 8,
  },
  findingDot: { width: 8, height: 8, borderRadius: 4 },
  findingText: { fontSize: 11, fontWeight: "600" },

  // Messages
  msgList: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 8 },

  dateSep: {
    flexDirection: "row", alignItems: "center",
    marginVertical: 16, gap: 8,
  },
  dateSepLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dateSepText: {
    fontSize: 11, color: colors.textMuted,
    backgroundColor: "#EEF2F7",
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radius.full, fontWeight: "600",
  },

  msgRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-end" },
  msgRowMine: { flexDirection: "row-reverse" },

  msgAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primaryBg,
    justifyContent: "center", alignItems: "center",
    marginRight: 6,
  },
  msgAvatarText: { fontSize: 11, fontWeight: "700", color: colors.primary },

  bubble: {
    maxWidth: "78%", borderRadius: 18, padding: 10,
    ...shadows.xs,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4, marginLeft: 0,
  },
  bubbleMine: {
    backgroundColor: colors.primary, // bulles propres
    borderBottomRightRadius: 4, marginRight: 6,
  },
  senderName: { fontSize: 11, fontWeight: "700", color: colors.primary, marginBottom: 3 },
  msgText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  msgTextMine: { color: "#fff" },
  bubbleFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 4 },
  msgTime: { fontSize: 10, color: colors.textMuted },
  msgTimeMine: { color: "rgba(255,255,255,0.65)" },
  ticks: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "700" },
  ticksRead: { color: "#90D4F5" },

  // Empty
  emptyChat: { alignItems: "center", paddingTop: 60 },
  emptyChatIcon: { fontSize: 48, marginBottom: 12 },
  emptyChatTitle: { fontSize: 16, fontWeight: "700", color: colors.textSecondary },
  emptyChatSub: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: "center" },

  // Input
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    backgroundColor: colors.surface,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border, gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: radius.xxl, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: colors.textPrimary, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
    ...shadows.small,
  },
  sendBtnOff: { backgroundColor: colors.gray200 },
  sendBtnIcon: { color: "#fff", fontSize: 18 },

  closedBar: {
    backgroundColor: colors.successBg, paddingVertical: 14,
    alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border,
  },
  closedBarText: { fontSize: 14, color: colors.success, fontWeight: "700" },

  // Validation
  validateWrap: { marginHorizontal: 12, marginBottom: 8 },
  validateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: colors.success,
    borderRadius: radius.xl, paddingVertical: 14,
    ...shadows.small,
  },
  validateBtnIcon: { fontSize: 18 },
  validateBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  validatedBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: colors.successBg,
    borderRadius: radius.xl, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.success,
  },
  validatedIcon: { fontSize: 16 },
  validatedText: { fontSize: 14, fontWeight: "600", color: colors.success },
  validateModal: {
    backgroundColor: colors.surface,
    margin: 20, borderRadius: radius.xxl, padding: 24,
    ...shadows.large,
  },
  validateModalTitle: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginBottom: 6 },
  validateModalSub: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  validateInput: {
    backgroundColor: colors.gray100, borderRadius: radius.xl,
    padding: 14, fontSize: 14, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
    minHeight: 80, textAlignVertical: "top", marginBottom: 16,
  },
  validateModalBtns: { flexDirection: "row", gap: 10 },
  validateModalCancel: {
    flex: 1, borderRadius: radius.xl, paddingVertical: 14,
    alignItems: "center", borderWidth: 1.5, borderColor: colors.border,
  },
  validateModalCancelText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
  validateModalConfirm: {
    flex: 1, borderRadius: radius.xl, paddingVertical: 14,
    alignItems: "center", backgroundColor: colors.success,
  },
  validateModalConfirmText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "95%", maxHeight: "92%", backgroundColor: "#0A0A0A", borderRadius: 20, overflow: "hidden" },
  modalCloseBtn: {
    position: "absolute", top: 12, right: 12, zIndex: 20,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  modalCloseIcon: { color: "#fff", fontSize: 15, fontWeight: "700" },

  modalImgWrap: {
    position: "relative",
    width: "100%",
    height: SCREEN_WIDTH * 0.9,
  },
  modalImg: { width: "100%", height: "100%" },

  // Annotations modal
  modalAnnotation: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 5 },
  modalAnnotDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, borderColor: "#fff" },
  modalAnnotLabel: {
    backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  modalAnnotText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  modalAnnotConf: { color: "rgba(255,255,255,0.7)", fontSize: 10 },

  modalFooter: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 12,
    backgroundColor: "#111",
  },
  modalUrgBadge: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  modalUrgText: { fontSize: 12, fontWeight: "700" },
  modalScore: { fontSize: 13, color: colors.primary, fontWeight: "700" },

  modalLegend: { padding: 12, backgroundColor: "#0D0D0D" },
  modalLegendTitle: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 8, fontWeight: "600" },
  modalLegendItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  modalLegendDot: { width: 10, height: 10, borderRadius: 5 },
  modalLegendText: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
});
