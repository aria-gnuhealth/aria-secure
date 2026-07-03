# ARIA - Automated Radiography Intelligent Analysis

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-teal)
![React Native](https://img.shields.io/badge/React%20Native-TypeScript-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 📋 Table des matières

- [Description](#description)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [API Endpoints](#api-endpoints)
- [Structure du projet](#structure-du-projet)
- [Tests](#tests)
- [Déploiement](#déploiement)
- [Documentation](#documentation)
- [Contributions](#contributions)
- [Licence](#licence)

## 🎯 Description

ARIA (Automated Radiography Intelligent Analysis) est un module d'intelligence artificielle qui s'intègre à GNU Health, un logiciel hospitalier open source. Son objectif est d'analyser automatiquement des radiographies médicales (poumons, os, etc.) pour aider les médecins à détecter des maladies comme la pneumonie, la tuberculose, les fractures ou le COVID-19.

L'application est accessible depuis un smartphone ou une tablette (Android/iOS) et fonctionne même sans connexion internet. C'est particulièrement utile dans les régions où les radiologues sont rares.

### ✨ Fonctionnalités

- **Authentification sécurisée** : JWT avec vérification email
- **Gestion des patients** : CRUD complet, recherche, statistiques
- **Upload d'images** : Stockage sécurisé dans MinIO (compatible S3)
- **Analyses IA** :
  - **CheXpert** : 14 pathologies pulmonaires (DenseNet121)
  - **MURA** : Détection de fractures osseuses (EfficientNetV2-S)
- **Génération de rapports PDF** : Comptes rendus d'analyse
- **Audit logs** : Traçabilité complète des actions
- **Cache Redis** : Optimisation des performances
- **Tâches asynchrones** : File d'attente Celery

## 🏗 Architecture
┌─────────────────────────────────────────────────────────────────────────┐
│ ARIA-Core │
├─────────────────────────────────────────────────────────────────────────┤
│ FastAPI + Uvicorn │
│ ├── /api/v1/auth → Authentification JWT │
│ ├── /api/v1/patients → CRUD patients + recherche │
│ ├── /api/v1/images → Upload, MinIO, URLs pré-signées │
│ ├── /api/v1/analyze → CheXpert (thorax) + MURA (membres) │
│ ├── /api/v1/ai-models → Gestion modèles IA │
│ ├── /api/v1/reports → Génération rapports PDF │
│ └── /api/v1/audit → Logs d'audit │
├─────────────────────────────────────────────────────────────────────────┤
│ PostgreSQL (Données) + MinIO (Images/PDFs) + Redis (Cache + Celery) │
└─────────────────────────────────────────────────────────────────────────┘


## 🛠 Technologies

| Technologie | Rôle | Version |
|-------------|------|---------|
| **Python 3.11+** | Backend principal | 3.11+ |
| **FastAPI** | API REST | 0.115.0 |
| **PostgreSQL** | Base de données | 16 |
| **Redis** | Cache + Broker Celery | 7 |
| **MinIO** | Stockage d'images (S3) | latest |
| **Celery** | Tâches asynchrones | 5.4.0 |
| **ONNX Runtime** | Inférence IA | 1.18.0 |
| **ReportLab** | Génération PDF | 4.2.0 |
| **SQLAlchemy** | ORM | 2.0.30 |
| **Docker** | Conteneurisation | latest |

## 📦 Prérequis

- **Python** 3.11 ou supérieur
- **Docker** et **Docker Compose** (pour PostgreSQL, Redis, MinIO)
- **Git** pour le contrôle de version
- **pip** pour la gestion des dépendances

## 🔧 Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/your-org/aria.git
cd aria
