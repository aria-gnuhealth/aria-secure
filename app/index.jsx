import { useAuth } from "../contexts/AuthContext";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)/patients" : "/(auth)/login"} />;
}
