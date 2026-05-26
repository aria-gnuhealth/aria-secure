"""
Service d'envoi d'emails pour ARIA
Utilise SMTP (Gmail) pour l'envoi des emails de vérification
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from pathlib import Path

# ------------------------------------------------------------
# Configuration SMTP (depuis .env)
# ------------------------------------------------------------
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "ariasecure.support@gmail.com")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "ARIA Secure - Automated Radiography Analysis")
DEVELOPMENT_MODE = os.getenv("ENVIRONMENT", "development") == "development"

def send_email_smtp(to_email: str, subject: str, html_content: str) -> bool:
    """
    Envoie un email via SMTP (Gmail ou autre).
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        print("❌ SMTP non configuré. Vérifiez SMTP_USER et SMTP_PASSWORD dans .env")
        print(f"   SMTP_USER: {SMTP_USER}")
        print(f"   SMTP_PASSWORD: {'[SET]' if SMTP_PASSWORD else '[MISSING]'}")
        return False
    
    try:
        # Créer le message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        
        # Version HTML
        html_part = MIMEText(html_content, "html")
        msg.attach(html_part)
        
        # Se connecter et envoyer
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())
        
        print(f"✅ Email envoyé à {to_email} via {SMTP_HOST}")
        return True
        
    except Exception as e:
        print(f"❌ Erreur d'envoi d'email: {e}")
        return False


def send_email_development(to_email: str, subject: str, html_content: str) -> bool:
    """Mode développement : écrire l'email dans un fichier log"""
    log_dir = Path(__file__).parent.parent.parent / "logs"
    log_dir.mkdir(exist_ok=True)
    
    log_file = log_dir / "emails.log"
    
    with open(log_file, "a", encoding="utf-8") as f:
        f.write("=" * 60 + "\n")
        f.write(f"📧 TO: {to_email}\n")
        f.write(f"📧 FROM: {SMTP_FROM_EMAIL}\n")
        f.write(f"📧 SUBJECT: {subject}\n")
        f.write(f"📧 BODY:\n{html_content}\n")
        f.write("=" * 60 + "\n\n")
    
    print(f"📧 [DEV] Email envoyé à {to_email} (log dans {log_file})")
    return True


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Envoie un email (choix automatique selon environnement)
    """
    if DEVELOPMENT_MODE:
        # En développement : on écrit dans un fichier log
        # return send_email_development(to_email, subject, html_content)
        return send_email_smtp(to_email, subject, html_content)
    else:
        # En production : on envoie vraiment
        return send_email_smtp(to_email, subject, html_content)


def send_verification_email(to_email: str, verification_token: str, base_url: str = None) -> bool:
    """
    Envoie l'email de vérification avec lien d'activation.
    
    Args:
        to_email: Email du destinataire
        verification_token: Token unique de vérification
        base_url: URL de base de l'API (ex: http://localhost:8000)
    """
    if base_url is None:
        base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    
    verification_link = f"{base_url}/api/v1/auth/verify-email/{verification_token}"
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bienvenue sur ARIA Secure</title>
    <style>
        body {{
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f6f9;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #1F6B9E 0%, #0d4a6e 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
        }}
        .header p {{
            margin: 10px 0 0;
            opacity: 0.9;
        }}
        .content {{
            padding: 30px;
        }}
        .button {{
            display: inline-block;
            background: linear-gradient(135deg, #1F6B9E 0%, #0d4a6e 100%);
            color: white !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 50px;
            margin: 20px 0;
            font-weight: bold;
            text-align: center;
        }}
        .button:hover {{
            background: linear-gradient(135deg, #0d4a6e 0%, #0a3a55 100%);
        }}
        .footer {{
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #777;
            border-top: 1px solid #eee;
            background-color: #fafafa;
        }}
        .warning {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 20px 0;
            font-size: 13px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 ARIA Secure</h1>
            <p>Automated Radiography Intelligent Analysis</p>
        </div>
        <div class="content">
            <h2>Vérification de votre adresse email</h2>
            <p>Bonjour,</p>
            <p>Merci de vous être inscrit sur <strong>ARIA Secure</strong>, notre plateforme d'analyse radiographique assistée par intelligence artificielle.</p>
            <p>Pour activer votre compte et accéder à nos services, veuillez cliquer sur le bouton ci-dessous :</p>
            
            <div style="text-align: center;">
                <a href="{verification_link}" class="button">✅ Activer mon compte</a>
            </div>
            
            <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
            <p style="background-color: #f0f0f0; padding: 10px; word-break: break-all; font-size: 12px;">
                <a href="{verification_link}">{verification_link}</a>
            </p>
            
            <div class="warning">
                ⏰ <strong>Ce lien expire dans 24 heures.</strong><br>
                Après expiration, vous devrez demander un nouvel email de vérification.
            </div>
            
            <p><strong>Pourquoi cette vérification ?</strong><br>
            La vérification de votre email garantit la sécurité de vos données médicales et conforme aux réglementations (RGPD/HIPAA).</p>
            
            <p>Si vous n'avez pas créé de compte sur ARIA Secure, ignorez cet email.</p>
            
            <p>Cordialement,<br>
            <strong>L'équipe ARIA Secure</strong><br>
            <span style="color: #1F6B9E;">ariasecure.support@gmail.com</span></p>
        </div>
        <div class="footer">
            <p>🔒 ARIA Secure - Solution d'analyse radiographique par IA</p>
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            <p>© 2025 ARIA Secure - Tous droits réservés</p>
        </div>
    </div>
</body>
</html>
    """
    
    subject = "🔐 ARIA Secure - Activez votre compte"
    
    return send_email(to_email, subject, html_content)


def send_verification_reminder(to_email: str, verification_token: str, base_url: str = None) -> bool:
    """Envoie un rappel pour vérifier l'email"""
    if base_url is None:
        base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    
    verification_link = f"{base_url}/api/v1/auth/verify-email/{verification_token}"
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ARIA Secure - Rappel d'activation</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #1F6B9E 0%, #0d4a6e 100%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }}
        .content {{
            background-color: #f4f4f4;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }}
        .button {{
            display: inline-block;
            background: linear-gradient(135deg, #1F6B9E 0%, #0d4a6e 100%);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🏥 ARIA Secure - Rappel d'activation</h1>
    </div>
    <div class="content">
        <h2>Vous n'avez pas encore activé votre compte</h2>
        <p>Bonjour,</p>
        <p>Nous constatons que vous n'avez pas encore vérifié votre adresse email.</p>
        <p>Cliquez sur le bouton ci-dessous pour activer votre compte ARIA Secure :</p>
        
        <div style="text-align: center;">
            <a href="{verification_link}" class="button">🔓 Activer mon compte</a>
        </div>
        
        <p>Ce lien expirera dans 24 heures.</p>
        
        <p>Cordialement,<br><strong>L'équipe ARIA Secure</strong></p>
    </div>
</body>
</html>
    """
    
    subject = "🔐 ARIA Secure - Rappel : activez votre compte"
    
    return send_email(to_email, subject, html_content)


def send_password_reset_email(to_email: str, reset_token: str, base_url: str = None) -> bool:
    """Envoie un email de réinitialisation de mot de passe"""
    if base_url is None:
        base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    
    reset_link = f"{base_url}/api/v1/auth/reset-password/{reset_token}"
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ARIA Secure - Réinitialisation mot de passe</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #1F6B9E 0%, #0d4a6e 100%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }}
        .content {{
            background-color: #f4f4f4;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 ARIA Secure</h1>
        <p>Réinitialisation du mot de passe</p>
    </div>
    <div class="content">
        <p>Vous avez demandé à réinitialiser votre mot de passe ARIA Secure.</p>
        <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :</p>
        <p><a href="{reset_link}">{reset_link}</a></p>
        <p>Ce lien est valable <strong>1 heure</strong>.</p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et votre mot de passe restera inchangé.</p>
        <p>Cordialement,<br><strong>L'équipe ARIA Secure</strong></p>
    </div>
</body>
</html>
    """
    
    subject = "🔐 ARIA Secure - Réinitialisation de votre mot de passe"
    
    return send_email(to_email, subject, html_content)


def send_welcome_email(to_email: str, first_name: str, last_name: str) -> bool:
    """Envoie un email de bienvenue après activation"""
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bienvenue sur ARIA Secure</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #1F6B9E 0%, #0d4a6e 100%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }}
        .content {{
            background-color: #f4f4f4;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🏥 Bienvenue sur ARIA Secure</h1>
    </div>
    <div class="content">
        <h2>Bonjour {first_name} {last_name},</h2>
        <p>Votre compte a été activé avec succès !</p>
        <p>Vous pouvez maintenant :</p>
        <ul>
            <li>📤 Soumettre des radiographies pour analyse</li>
            <li>🤖 Utiliser notre IA pour détecter des anomalies</li>
            <li>📊 Consulter l'historique des analyses</li>
            <li>📄 Générer des rapports PDF</li>
        </ul>
        <p>Connectez-vous dès maintenant : <a href="{os.getenv('API_BASE_URL', 'http://localhost:8000')}/docs">Accéder à ARIA Secure</a></p>
        <p>L'équipe ARIA Secure reste à votre disposition pour toute question.</p>
        <p>Cordialement,<br><strong>L'équipe ARIA Secure</strong></p>
    </div>
</body>
</html>
    """
    
    subject = "🎉 Bienvenue sur ARIA Secure - Votre compte est activé"
    
    return send_email(to_email, subject, html_content)