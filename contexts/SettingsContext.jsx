import { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import api from "../services/api";

const SettingsContext = createContext({});

export function SettingsProvider({ children }) {
  const { user, token } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState("fr");
  const [notifications, setNotifications] = useState(true);
  const [fontSize, setFontSize] = useState("medium");
  const [loaded, setLoaded] = useState(false);

  // Charger les préférences depuis le backend quand l'utilisateur se connecte
  useEffect(() => {
    if (user && token) {
      loadFromBackend();
    } else {
      // Charger depuis le cache local si pas connecté
      loadFromLocal();
    }
  }, [user?.id, token]);

  const loadFromBackend = async () => {
    try {
      const res = await api.get("/auth/preferences");
      const prefs = res.data;
      setDarkMode(prefs.dark_mode ?? false);
      setLanguage(prefs.language ?? "fr");
      setNotifications(prefs.notifications ?? true);
      setFontSize(prefs.font_size ?? "medium");
      // Cacher en local aussi
      await AsyncStorage.setItem("aria_settings", JSON.stringify({
        darkMode: prefs.dark_mode,
        language: prefs.language,
        notifications: prefs.notifications,
        fontSize: prefs.font_size,
      }));
    } catch (e) {
      await loadFromLocal();
    } finally {
      setLoaded(true);
    }
  };

  const loadFromLocal = async () => {
    try {
      const saved = await AsyncStorage.getItem("aria_settings");
      if (saved) {
        const s = JSON.parse(saved);
        setDarkMode(s.darkMode ?? false);
        setLanguage(s.language ?? "fr");
        setNotifications(s.notifications ?? true);
        setFontSize(s.fontSize ?? "medium");
      }
    } catch (e) {}
    finally { setLoaded(true); }
  };

  const saveToBackend = async (updates) => {
    const current = {
      dark_mode: darkMode,
      language,
      notifications,
      font_size: fontSize,
      ...updates
    };
    // Sauvegarder en local immédiatement
    await AsyncStorage.setItem("aria_settings", JSON.stringify({
      darkMode: current.dark_mode,
      language: current.language,
      notifications: current.notifications,
      fontSize: current.font_size,
    }));
    // Sauvegarder sur le backend
    try {
      await api.put("/auth/preferences", current);
    } catch (e) {
      console.log("Erreur sauvegarde préférences:", e.message);
    }
  };

  const toggleDarkMode = async () => {
    const val = !darkMode;
    setDarkMode(val);
    await saveToBackend({ dark_mode: val });
  };

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    await saveToBackend({ language: lang });
  };

  const toggleNotifications = async () => {
    const val = !notifications;
    setNotifications(val);
    await saveToBackend({ notifications: val });
  };

  const changeFontSize = async (size) => {
    setFontSize(size);
    await saveToBackend({ font_size: size });
  };

  // Traductions
  const t = useCallback((key) => {
    const translations = {
      fr: {
        patients: "Patients", dashboard: "Tableau de bord", chat: "Chat",
        profile: "Profil", settings: "Paramètres", logout: "Se déconnecter",
        darkMode: "Mode sombre", language: "Langue", notifications: "Notifications",
        fontSize: "Taille de police", security: "Sécurité",
        changePassword: "Modifier le mot de passe", editProfile: "Modifier le profil",
        privacy: "Confidentialité", about: "À propos",
        save: "Enregistrer", cancel: "Annuler",
        small: "Petite", medium: "Normale", large: "Grande",
        french: "Français", english: "Anglais",
        enabled: "Activé", disabled: "Désactivé",
        newPassword: "Nouveau mot de passe", confirmPassword: "Confirmer",
        currentPassword: "Mot de passe actuel",
        searchPatient: "Rechercher un patient...",
        newPatient: "Nouveau patient",
        noPatient: "Aucun patient",
        addFirstPatient: "Ajoutez votre premier patient",
        consultations: "Consultations",
        myTools: "Mes outils",
        pendingConsultations: "Consultations en attente",
        noPending: "Aucune consultation en attente",
        globalStats: "Statistiques globales",
        administration: "Administration",
        manageUsers: "Gérer les utilisateurs",
        seePatients: "Voir les patients",
        goodMorning: "Bonjour", goodAfternoon: "Bon après-midi", goodEvening: "Bonsoir",
      },
      en: {
        patients: "Patients", dashboard: "Dashboard", chat: "Chat",
        profile: "Profile", settings: "Settings", logout: "Sign out",
        darkMode: "Dark mode", language: "Language", notifications: "Notifications",
        fontSize: "Font size", security: "Security",
        changePassword: "Change password", editProfile: "Edit profile",
        privacy: "Privacy", about: "About",
        save: "Save", cancel: "Cancel",
        small: "Small", medium: "Medium", large: "Large",
        french: "French", english: "English",
        enabled: "Enabled", disabled: "Disabled",
        newPassword: "New password", confirmPassword: "Confirm",
        currentPassword: "Current password",
        searchPatient: "Search patient...",
        newPatient: "New patient",
        noPatient: "No patient",
        addFirstPatient: "Add your first patient",
        consultations: "Consultations",
        myTools: "My tools",
        pendingConsultations: "Pending consultations",
        noPending: "No pending consultations",
        globalStats: "Global statistics",
        administration: "Administration",
        manageUsers: "Manage users",
        seePatients: "See patients",
        goodMorning: "Good morning", goodAfternoon: "Good afternoon", goodEvening: "Good evening",
      }
    };
    return translations[language]?.[key] || key;
  }, [language]);

  const fontSizeMap = { small: 12, medium: 14, large: 17 };
  const baseFontSize = fontSizeMap[fontSize] || 14;

  const theme = {
    bg: darkMode ? "#0f172a" : "#f9fafb",
    surface: darkMode ? "#1e293b" : "#ffffff",
    surfaceSecondary: darkMode ? "#334155" : "#f3f4f6",
    text: darkMode ? "#f1f5f9" : "#111827",
    textSecondary: darkMode ? "#94a3b8" : "#6b7280",
    textMuted: darkMode ? "#64748b" : "#9ca3af",
    border: darkMode ? "#334155" : "#e5e7eb",
    primary: "#1F6B9E",
    tabBar: darkMode ? "#1e293b" : "#ffffff",
    tabBarBorder: darkMode ? "#334155" : "#e5e7eb",
    statusBar: darkMode ? "light-content" : "dark-content",
    headerBg: "#1F6B9E",
    card: darkMode ? "#1e293b" : "#ffffff",
    input: darkMode ? "#334155" : "#f3f4f6",
    placeholder: darkMode ? "#64748b" : "#9ca3af",
  };

  return (
    <SettingsContext.Provider value={{
      darkMode, language, notifications, fontSize, loaded,
      toggleDarkMode, changeLanguage, toggleNotifications, changeFontSize,
      t, theme, baseFontSize
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

// Composant Text global qui applique baseFontSize
import { Text as RNText } from "react-native";
export function AppText({ style, children, ...props }) {
  const { baseFontSize } = useSettings();
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.map(s => s || {})) : (style || {});
  const finalSize = flatStyle.fontSize ? flatStyle.fontSize * (baseFontSize / 14) : baseFontSize;
  return <RNText style={[style, { fontSize: finalSize }]} {...props}>{children}</RNText>;
}
