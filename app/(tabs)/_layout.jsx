import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { useSettings } from "../../contexts/SettingsContext";

function Badge({ count }) {
  if (!count || count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

function TabIcon({ emoji, badge = 0, focused }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      {badge > 0 && <Badge count={badge} />}
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const { unreadMessages } = useNotifications();
  const { theme, darkMode } = useSettings();
  const role = user?.role;

  const tabBarOptions = {
    headerShown: false,
    tabBarActiveTintColor: "#1F6B9E",
    tabBarInactiveTintColor: darkMode ? "#64748b" : "#999",
    tabBarStyle: {
      backgroundColor: darkMode ? "#1e293b" : "#fff",
      borderTopWidth: 0.5,
      borderTopColor: darkMode ? "#334155" : "#e0e0e0",
      height: 64,
      paddingBottom: 8,
      paddingTop: 4,
    },
    tabBarLabelStyle: {
      fontSize: 10,
      fontWeight: "600",
    },
  };

  if (role === "admin") {
    return (
      <Tabs screenOptions={tabBarOptions}>
        <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }} />
        <Tabs.Screen name="patients" options={{ title: "Patients", tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} /> }} />
        <Tabs.Screen name="admin_users" options={{ title: "Utilisateurs", tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} /> }} />
        <Tabs.Screen name="admin_models" options={{ title: "Modèles IA", tabBarIcon: ({ focused }) => <TabIcon emoji="🤖" focused={focused} /> }} />
        <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ focused }) => <TabIcon emoji="💬" badge={unreadMessages} focused={focused} /> }} />
        <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
      </Tabs>
    );
  }

  if (role === "radiologist") {
    return (
      <Tabs screenOptions={tabBarOptions}>
        <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }} />
        <Tabs.Screen name="patients" options={{ title: "Patients", tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} /> }} />
        <Tabs.Screen name="chat" options={{ title: "Consultations", tabBarIcon: ({ focused }) => <TabIcon emoji="💬" badge={unreadMessages} focused={focused} /> }} />
        <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
        <Tabs.Screen name="admin_users" options={{ href: null }} />
        <Tabs.Screen name="admin_models" options={{ href: null }} />
      </Tabs>
    );
  }

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }} />
      <Tabs.Screen name="patients" options={{ title: "Patients", tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} /> }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ focused }) => <TabIcon emoji="💬" badge={unreadMessages} focused={focused} /> }} />
      <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
      <Tabs.Screen name="admin_users" options={{ href: null }} />
      <Tabs.Screen name="admin_models" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    position: "relative",
    width: 44, height: 34,
    alignItems: "center", justifyContent: "center",
    borderRadius: 12,
  },
  iconWrapActive: {
    backgroundColor: "rgba(31, 107, 158, 0.15)",
  },
  badge: {
    position: "absolute", top: -4, right: -4,
    backgroundColor: "#E74C3C", borderRadius: 10,
    minWidth: 18, height: 18,
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
