import psycopg2
import os

# Essaie de te connecter avec les identifiants que tu utilises dans psql
try:
    conn = psycopg2.connect(
        dbname="postgres",
        user="aria_user",
        password="aria123",
        host="localhost",
        port=5432
    )
    print("✅ Connexion réussie avec psycopg2 !")
    conn.close()
except Exception as e:
    print(f"❌ Échec de connexion : {e}")
