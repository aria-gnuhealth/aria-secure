#!/usr/bin/env python
"""
Script d'initialisation de la base de données ARIA
Exécuter : python init_db.py
"""

import sys
import os

# Ajouter le chemin du projet pour les imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine
from app.db import models
from app.core.config import settings

def init_database():
    """Crée toutes les tables si elles n'existent pas"""
    print("=" * 50)
    print("ARIA - Database Initialization")
    print("=" * 50)
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Database URL: {settings.DATABASE_URL}")
    print()
    
    try:
        print("🔨 Creating tables...")
        models.Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully!")
        print()
        print("Tables created:")
        print("   - users")
        print("   - patients")
        print("   - images")
        print("   - ai_models")
        print("   - analyses")
        print("   - findings")
        print("   - reports")
        print("   - audit_logs")
        print()
        print("🎉 Database is ready!")
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        sys.exit(1)

def drop_database():
    """Supprime toutes les tables (ATTENTION: perte de données)"""
    print("=" * 50)
    print("⚠️  WARNING: This will delete ALL data!")
    print("=" * 50)
    
    confirm = input("Type 'yes' to confirm: ")
    if confirm.lower() == "yes":
        print("🗑️  Dropping all tables...")
        models.Base.metadata.drop_all(bind=engine)
        print("✅ All tables dropped!")
    else:
        print("Operation cancelled.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ARIA Database Manager")
    parser.add_argument("--drop", action="store_true", help="Drop all tables")
    args = parser.parse_args()
    
    if args.drop:
        drop_database()
    else:
        init_database()