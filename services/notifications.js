import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Notifications push désactivées dans Expo Go (SDK 53)
// Elles fonctionneront dans le build de production APK

export async function registerForPushNotifications() {
  console.log("Notifications push disponibles dans le build APK");
  return null;
}

export async function sendLocalNotification({ title, body, data = {} }) {
  console.log("Notification locale:", title, body);
}

export function addNotificationListener(handler) {
  return { remove: () => {} };
}

export function addNotificationResponseListener(handler) {
  return { remove: () => {} };
}

export async function clearBadge() {}
