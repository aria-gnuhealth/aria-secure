import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";

export default function AdminUsers() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Seul l'admin peut accéder à cette page
  if (user?.role !== "admin") {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 18, color: "#c62828" }}>⛔ Accès refusé</Text>
        <Text style={{ marginTop: 8, color: "#666" }}>Réservé aux administrateurs</Text>
      </View>
    );
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data || []);
    } catch (error) {
      console.log("Erreur chargement utilisateurs:", error);
      Alert.alert("Erreur", "Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const changeRole = async (userId, newRole) => {
    Alert.alert(
      "Changer le rôle",
      `Passer cet utilisateur en "${newRole}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: async () => {
            try {
              await api.put(`/auth/users/${userId}/role`, { role: newRole });
              fetchUsers();
            } catch (error) {
              Alert.alert("Erreur", "Impossible de modifier le rôle");
            }
          },
        },
      ]
    );
  };

  const deleteUser = async (userId) => {
    Alert.alert(
      "⚠️ Supprimer l'utilisateur",
      "Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/auth/users/${userId}`);
              fetchUsers();
            } catch (error) {
              Alert.alert("Erreur", "Impossible de supprimer l'utilisateur");
            }
          },
        },
      ]
    );
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: "#c62828",
      radiologist: "#9c27b0",
      doctor: "#1a73e8",
      nurse: "#00897b",
      auditor: "#546e7a",
    };
    return colors[role] || "#666";
  };

  const renderUser = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.userName}>{item.first_name} {item.last_name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + "20" }]}>
          <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
            {item.role}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {item.role === "admin" ? (
          <Text style={styles.adminNote}>👑 Admin — ne peut pas être modifié</Text>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.roleBtn]}
              onPress={() => changeRole(item.id, "radiologist")}
            >
              <Text style={styles.actionText}>🔬 Radiologue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.roleBtn]}
              onPress={() => changeRole(item.id, "doctor")}
            >
              <Text style={styles.actionText}>👨‍⚕️ Médecin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => deleteUser(item.id)}
            >
              <Text style={styles.actionText}>🗑️</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>👑 Administration</Text>
        <Text style={styles.headerSub}>Gestion des utilisateurs</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchUsers();
            }}
            colors={["#1a73e8"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucun utilisateur</Text>
          </View>
        }
        contentContainerStyle={users.length === 0 && styles.emptyContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  backText: { fontSize: 16, color: "#1a73e8", marginBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#1a1a1a" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#e8e8e8",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  userName: { fontSize: 16, fontWeight: "600", color: "#1a1a1a" },
  userEmail: { fontSize: 13, color: "#888", marginTop: 2 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: { borderRadius: 8, padding: 8, flex: 1, alignItems: "center" },
  roleBtn: { backgroundColor: "#e8f0fe" },
  deleteBtn: { backgroundColor: "#ffebee", flex: 0.3 },
  actionText: { fontSize: 12, fontWeight: "600", color: "#1a73e8" },
  adminNote: { fontSize: 12, color: "#888", fontStyle: "italic" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyContainer: { flexGrow: 1 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#555" },
});
