import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("token");
      const storedUser = await AsyncStorage.getItem("user");
      if (storedToken && storedUser) {
        try {
          await api.get("/auth/verify");
          setToken(storedToken);
          // Récupérer les infos fraîches depuis le backend
          try {
            const meRes = await api.get("/auth/me");
            const freshUser = {
              id: meRes.data.id,
              email: meRes.data.email,
              firstName: meRes.data.first_name,
              lastName: meRes.data.last_name,
              role: meRes.data.role,
            };
            await AsyncStorage.setItem("user", JSON.stringify(freshUser));
            setUser(freshUser);
          } catch (e) {
            setUser(JSON.parse(storedUser));
          }
        } catch (error) {
          await logout();
        }
      }
    } catch (error) {
      console.log("Erreur chargement user:", error);
    } finally {
      setLoading(false);
    }
  };

  const loginWithOTP = async (email, password) => {
    // Connexion finale après vérification OTP
    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);
      const response = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { access_token, user_id, email: userEmail, first_name, last_name, role } = response.data;
      const userData = { id: user_id, email: userEmail, firstName: first_name, lastName: last_name, role };
      await AsyncStorage.setItem("token", access_token);
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      const msg = error.response?.data?.detail || "Erreur de connexion";
      throw new Error(msg);
    }
  };

  const login = async (email, password, previewOnly = false) => {
    // En mode previewOnly, on vérifie juste les credentials sans connecter
    if (previewOnly) {
      try {
        const formData = new FormData();
        formData.append("username", email);
        formData.append("password", password);
        await api.post("/auth/login", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return { success: true };
      } catch (error) {
        const msg = error.response?.data?.detail || "Identifiants incorrects";
        throw new Error(msg);
      }
    }
    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const response = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { access_token, user_id, email: userEmail, first_name, last_name, role } = response.data;
      const userData = { id: user_id, email: userEmail, firstName: first_name, lastName: last_name, role };

      await AsyncStorage.setItem("token", access_token);
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      const msg = error.response?.data?.detail || "Erreur de connexion";
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {}
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithOTP, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
