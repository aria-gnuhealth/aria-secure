from app.db.base import Base
from app.db.session import engine, SessionLocal, get_db
from app.db import models  # Importe tous les modèles

# Ce fichier permet d'importer facilement :
# from app.db import Base, engine, SessionLocal, get_db