import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/config";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Ajouter le token automatiquement
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gérer les erreurs 401 (token expiré)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
    }
    return Promise.reject(error);
  }
);

export default api;

// Remplace localhost par l'IP du PC pour les URLs MinIO
// (le téléphone ne peut pas accéder à localhost du PC)
export const fixMinioUrl = (url) => {
  if (!url) return null;
  return url
    .replace("http://minio.aria-web.site", "https://minio.aria-web.site").replace("localhost:9000", "minio.aria-web.site")
    .replace("127.0.0.1:9000", "minio.aria-web.site");
};
