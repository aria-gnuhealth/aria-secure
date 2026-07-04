import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { useSettings } from "../../contexts/SettingsContext";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import api from "../../services/api";
import { colors, shadows, radius, palette } from "../../constants/theme";

const KPAY_API_KEY = "kpay_test_5e3cfc8ccc8d6d2e634167dad2c2c047282da769972a1194";
const KPAY_SECRET_KEY = "b4dcae0254d7b1442b596c8f50dfce2e5a4c8ca8f554716563d88a18c77556e3";
const KPAY_BASE_URL = "https://admin.kpay.site"; // URL reste la même en test
const AMOUNT = 2000;

export default function PaymentScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const [loading, setLoading] = useState(false);
  const [operator, setOperator] = useState("MTN_MOMO_CMR");
  const [phone, setPhone] = useState("");

  const handlePay = async () => {
    setLoading(true);
    try {
      const externalId = `ARIA-${Date.now()}`;

      // Mode GATEWAY — sans phoneNumber, avec returnUrl
      const body = {
        amount: AMOUNT,
        externalId,
        description: "Abonnement ARIA Premium 30 jours",
        returnUrl: "https://api.aria-web.site/payment/success",
        cancelUrl: "https://api.aria-web.site/payment/cancel",
      };

      console.log("K-PAY REQUEST:", JSON.stringify(body));

      const res = await fetch(`${KPAY_BASE_URL}/api/v1/payments/init`, {
        method: "POST",
        headers: {
          "X-API-Key": KPAY_API_KEY,
          "X-Secret-Key": KPAY_SECRET_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      console.log("K-PAY RESPONSE:", JSON.stringify(data));

      const gatewayUrl = data.gatewayUrl || data.url || data.paymentUrl;

      if (!gatewayUrl) {
        Alert.alert("Erreur K-PAY", data.message || JSON.stringify(data));
        return;
      }

      // Ouvrir la page de paiement K-PAY
      let result;
      try {
        result = await WebBrowser.openBrowserAsync(gatewayUrl, {
          showTitle: true,
          toolbarColor: "#0A2A3F",
          enableBarCollapsing: false,
        });
      } catch (e) {
        await Linking.openURL(gatewayUrl);
        result = { type: "dismiss" };
      }

      // Activation après retour de KPay (peu importe le résultat)
      try {
        const activateRes = await api.post("/subscription/activate-kpay", {
          reference: data.reference || externalId,
          kpay_id: data.id || externalId
        });
        console.log("ACTIVATION:", JSON.stringify(activateRes.data));
        Alert.alert(
          "🎉 Premium activé !",
          "Votre abonnement Premium est actif pour 30 jours.",
          [{ text: "Continuer", onPress: () => router.replace("/(tabs)/profil") }]
        );
      } catch (e) {
        console.log("ERREUR ACTIVATION:", e.response?.data, e.message);
        Alert.alert("Erreur", "Impossible d'activer: " + (e.response?.data?.detail || e.message));
      }
    } catch (e) {
      Alert.alert("Erreur", "Impossible de contacter K-PAY: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme?.bg || colors.background }]}>
      <StatusBar backgroundColor={palette.navy} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>👑 Premium ARIA</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <Text style={styles.crownEmoji}>👑</Text>
          <Text style={styles.heroTitle}>ARIA Premium</Text>
          <Text style={styles.heroPrice}>2 000 XAF</Text>
          <Text style={styles.heroPeriod}>par mois · Sans engagement</Text>

          <View style={styles.divider} />

          {[
            { icon: "🔬", text: "Analyses IA illimitées" },
            { icon: "💬", text: "Chat médecin-radiologue illimité" },
            { icon: "📄", text: "Rapports PDF illimités" },
            { icon: "⚡", text: "Résultats prioritaires" },
            { icon: "🚫", text: "Sans publicité" },
            { icon: "🛡️", text: "Données sécurisées RGPD" },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          ))}
        </View>

        {/* Moyens de paiement */}
        <View style={[styles.methodsCard, { backgroundColor: theme?.surface || colors.surface }]}>
          <Text style={[styles.methodsTitle, { color: theme?.textMuted || colors.textMuted }]}>
            MOYENS DE PAIEMENT
          </Text>
          <View style={styles.methodsRow}>
            {[
              { icon: "🟠", label: "Orange Money", color: "#F97316" },
              { icon: "🟡", label: "MTN MoMo",    color: "#EAB308" },
            ].map((m, i) => (
              <View key={i} style={[styles.methodChip, { backgroundColor: theme?.surfaceSecondary || colors.gray100 }]}>
                <Text style={styles.methodChipIcon}>{m.icon}</Text>
                <Text style={[styles.methodChipLabel, { color: theme?.textSecondary || colors.textSecondary }]}>
                  {m.label}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.methodsNote, { color: theme?.textMuted || colors.textMuted }]}>
            Choisissez votre opérateur sur la page de paiement K-PAY
          </Text>
        </View>

        {/* Bouton payer */}
        <TouchableOpacity
          style={[styles.payBtn, loading && { opacity: 0.7 }]}
          onPress={handlePay}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.payBtnText}>Passer à Premium — 2 000 XAF</Text>
              <Text style={styles.payBtnSub}>Paiement sécurisé via K-PAY</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Sécurité */}
        <View style={styles.secureRow}>
          <Text style={styles.secureText}>🔒 Paiement 100% sécurisé par K-PAY</Text>
        </View>

        <Text style={[styles.noteText, { color: theme?.textMuted || colors.textMuted }]}>
          Vous serez redirigé vers la page de paiement K-PAY pour choisir votre opérateur (Orange Money, MTN MoMo...) et finaliser le paiement.
        </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    backgroundColor: palette.navy,
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 30, color: "#fff", fontWeight: "300" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },

  content: { padding: 16, paddingBottom: 48 },

  heroCard: {
    backgroundColor: palette.navy,
    borderRadius: radius.xxl, padding: 28,
    alignItems: "center", marginBottom: 16,
    ...shadows.medium,
  },
  crownEmoji: { fontSize: 56, marginBottom: 12 },
  heroTitle: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 6 },
  heroPrice: { fontSize: 48, fontWeight: "900", color: "#FCD34D", letterSpacing: -1 },
  heroPeriod: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 24 },
  divider: { width: "100%", height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 20 },
  featureRow: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 14 },
  featureIcon: { fontSize: 18, marginRight: 12, width: 28 },
  featureText: { flex: 1, fontSize: 15, color: "rgba(255,255,255,0.9)", fontWeight: "500" },
  checkmark: { fontSize: 16, color: "#34D399", fontWeight: "800" },

  methodsCard: {
    borderRadius: radius.xl, padding: 16, marginBottom: 16,
    ...shadows.small,
  },
  methodsTitle: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 12,
  },
  methodsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  methodChip: {
    flex: 1, borderRadius: radius.lg, padding: 10, alignItems: "center",
  },
  methodChipIcon: { fontSize: 24, marginBottom: 4 },
  methodChipLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  methodsNote: { fontSize: 11, textAlign: "center", lineHeight: 16 },

  payBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl, padding: 18,
    alignItems: "center", marginBottom: 12,
    ...shadows.medium,
  },
  payBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  payBtnSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 },

  secureRow: { alignItems: "center", marginBottom: 12 },
  secureText: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },

  noteText: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});
