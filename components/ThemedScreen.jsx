import { View, StatusBar } from "react-native";
import { useSettings } from "../contexts/SettingsContext";

export default function ThemedScreen({ children, style }) {
  const { theme, darkMode } = useSettings();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.bg }, style]}>
      <StatusBar
        backgroundColor="#1F6B9E"
        barStyle="light-content"
      />
      {children}
    </View>
  );
}
