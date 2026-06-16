import { Redirect } from "expo-router";

export default function Index() {
  // Ce fichier est juste un point d'entrée. Le Layout gère tout.
  return <Redirect href="/(auth)/login" />;
}
