from sqlalchemy import create_engine, text

# Utiliser la même URL que dans ton .env
DATABASE_URL = "postgresql://aria_user:aria123@localhost:5432/aria_db"
# Alternative avec +psycopg2
# DATABASE_URL = "postgresql+psycopg2://aria_user:aria123@localhost:5432/aria_db"

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("✅ SQLAlchemy connecté !", result.fetchone())
except Exception as e:
    print(f"❌ SQLAlchemy échoue : {e}")
