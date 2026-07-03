import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { NotificationProvider } from "../contexts/NotificationContext";
import { SettingsProvider } from "../contexts/SettingsContext";
import * as NavigationBar from "expo-navigation-bar";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    try {
      NavigationBar.setBackgroundColorAsync("#ffffff");
      NavigationBar.setButtonStyleAsync("dark");
      NavigationBar.setVisibilityAsync("hidden");
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!loading) {
      const inAuthGroup = segments[0] === "(auth)";
      if (!user && !inAuthGroup) {
        router.replace("/(auth)/login");
      } else if (user && inAuthGroup) {
        router.replace("/(tabs)/dashboard");
      }
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#1F6B9E" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="admin/users" />
      <Stack.Screen name="analyse/[id]" />
      <Stack.Screen name="analyse/reports" />
      <Stack.Screen name="analyse/result" />
      <Stack.Screen name="patient/[id]" />
      <Stack.Screen name="patient/new" />
      <Stack.Screen name="patient/trash" />
      <Stack.Screen name="patient/edit/[id]" />
      <Stack.Screen name="chat/index" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="chat/new" />
      <Stack.Screen name="payment/index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SettingsProvider>
          <NotificationProvider>
            <RootLayoutNav />
          </NotificationProvider>
        </SettingsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
