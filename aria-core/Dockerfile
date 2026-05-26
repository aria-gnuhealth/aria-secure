# ============================================================
# ARIA-Core — Dockerfile
# Backend FastAPI + Pipeline IA (ONNX)
# ============================================================
# Build   : docker build -t aria-core .
# Run     : docker run -p 8000:8000 --env-file .env aria-core
# ============================================================

# ------------------------------------------------------------
# STAGE 1 — Builder
# Installe les dépendances dans un environnement isolé
# ------------------------------------------------------------
FROM python:3.13-slim AS builder

# Éviter les fichiers .pyc et forcer les logs non-bufférisés
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Installer les outils de compilation nécessaires pour
# certaines librairies (psycopg2, opencv, cryptography...)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copier uniquement requirements.txt d'abord
# (optimisation cache Docker : si requirements ne change pas,
#  cette couche est réutilisée sans réinstaller)
COPY requirements.txt .

# Installer les dépendances Python dans un dossier dédié
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt

# ------------------------------------------------------------
# STAGE 2 — Runtime
# Image finale légère, sans les outils de compilation
# ------------------------------------------------------------
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Installer uniquement les libs runtime (pas les headers de compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copier les dépendances installées depuis le stage builder
COPY --from=builder /install /usr/local

# Créer un utilisateur non-root pour la sécurité
# (ne jamais faire tourner un conteneur en root en production)
RUN groupadd -r ariagroup && \
    useradd -r -g ariagroup -u 1000 -m -s /sbin/nologin ariauser

# Copier le code source de l'application
COPY --chown=ariauser:ariagroup . .

# Créer les dossiers nécessaires avec les bonnes permissions
RUN mkdir -p ml/models logs && \
    chown -R ariauser:ariagroup ml/ logs/

# Basculer sur l'utilisateur non-root
USER ariauser

# Exposer le port de l'API FastAPI
EXPOSE 8000

# Healthcheck : vérifie que l'API répond bien
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# ------------------------------------------------------------
# Commande de démarrage
# --host 0.0.0.0   : écouter sur toutes les interfaces réseau
# --port 8000      : port exposé
# --workers 4      : 4 processus workers (adapter selon CPU)
# --reload         : à retirer en production (hot-reload dev uniquement)
# ------------------------------------------------------------
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--log-level", "info"]