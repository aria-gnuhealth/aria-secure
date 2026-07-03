"""
Service d'envoi d'emails pour ARIA
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEVELOPMENT_MODE = os.getenv("ENVIRONMENT", "development") == "development"

SPAM_NOTE = """
<div style="background-color:#e8f4fd;border-left:4px solid #1F6B9E;padding:10px;margin:15px 0;font-size:12px;color:#555;">
    📬 <strong>Vous ne trouvez pas cet email ?</strong> Pensez à vérifier votre dossier <strong>Spams</strong> ou <strong>Courriers indésirables</strong> et à marquer cet email comme "Non spam".
</div>
"""

def send_email_smtp(to_email: str, subject: str, html_content: str) -> bool:
    smtp_host = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", "support@aria-web.site")
    smtp_name = os.getenv("SMTP_FROM_NAME", "ARIA Medical")

    if not smtp_user or not smtp_password:
        print(f"❌ SMTP non configuré. SMTP_USER: {smtp_user}, SMTP_PASSWORD: {'[SET]' if smtp_password else '[MISSING]'}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{smtp_name} <{smtp_from}>"
        msg["To"] = to_email
        msg["Reply-To"] = "support@aria-web.site"
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, to_email, msg.as_string())

        print(f"✅ Email envoyé à {to_email} via {smtp_host}")
        return True

    except Exception as e:
        print(f"❌ Erreur d'envoi d'email: {e}")
        return False


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    return send_email_smtp(to_email, subject, html_content)


def _base_template(title: str, header_emoji: str, body: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>{title}</title>
<style>
  body {{font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f4f6f9;}}
  .container {{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);}}
  .header {{background:linear-gradient(135deg,#1F6B9E 0%,#0d4a6e 100%);color:white;padding:30px;text-align:center;}}
  .header h1 {{margin:0;font-size:26px;}}
  .header p {{margin:8px 0 0;opacity:0.9;}}
  .content {{padding:30px;}}
  .button {{display:inline-block;background:linear-gradient(135deg,#1F6B9E,#0d4a6e);color:white!important;padding:14px 32px;text-decoration:none;border-radius:50px;margin:20px 0;font-weight:bold;}}
  .footer {{text-align:center;padding:20px;font-size:12px;color:#777;border-top:1px solid #eee;background:#fafafa;}}
  .warning {{background:#fff3cd;border-left:4px solid #ffc107;padding:12px;margin:20px 0;font-size:13px;}}
  .info {{background:#e8f4fd;border-left:4px solid #1F6B9E;padding:12px;margin:20px 0;font-size:13px;}}
  .danger {{background:#fde8e8;border-left:4px solid #dc3545;padding:12px;margin:20px 0;font-size:13px;}}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>{header_emoji} ARIA Medical</h1>
    <p>Plateforme de Télé-radiologie IA</p>
  </div>
  <div class="content">
    {body}
    {SPAM_NOTE}
  </div>
  <div class="footer">
    <p>🔒 ARIA Medical — Solution d'analyse radiographique par IA</p>
    <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre directement.</p>
    <p>© 2025 ARIA Medical - Tous droits réservés</p>
  </div>
</div>
</body>
</html>
"""


def send_verification_email(to_email: str, verification_token: str, base_url: str = None) -> bool:
    frontend_url = os.getenv("FRONTEND_URL", "https://www.aria-web.site")
    verification_link = f"{frontend_url}/verify-email/{verification_token}"

    body = f"""
        <h2>Vérification de votre adresse email</h2>
        <p>Bonjour,</p>
        <p>Merci de vous être inscrit sur <strong>ARIA Medical</strong>, notre plateforme d'analyse radiographique assistée par IA.</p>
        <p>Pour activer votre compte, cliquez sur le bouton ci-dessous :</p>
        <div style="text-align:center;">
            <a href="{verification_link}" class="button">✅ Activer mon compte</a>
        </div>
        <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
        <p style="background:#f0f0f0;padding:10px;word-break:break-all;font-size:12px;">
            <a href="{verification_link}">{verification_link}</a>
        </p>
        <div class="warning">⏰ <strong>Ce lien expire dans 24 heures.</strong></div>
        <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
        <p>Cordialement,<br><strong>L'équipe ARIA Medical</strong></p>
    """
    return send_email(to_email, "🔐 ARIA Medical - Activez votre compte", _base_template("Activation compte", "🏥", body))


def send_verification_reminder(to_email: str, verification_token: str, base_url: str = None) -> bool:
    frontend_url = os.getenv("FRONTEND_URL", "https://www.aria-web.site")
    verification_link = f"{frontend_url}/verify-email/{verification_token}"

    body = f"""
        <h2>Rappel : activez votre compte</h2>
        <p>Bonjour,</p>
        <p>Vous n'avez pas encore vérifié votre adresse email sur <strong>ARIA Medical</strong>.</p>
        <div style="text-align:center;">
            <a href="{verification_link}" class="button">🔓 Activer mon compte</a>
        </div>
        <div class="warning">⏰ <strong>Ce lien expire dans 24 heures.</strong></div>
        <p>Cordialement,<br><strong>L'équipe ARIA Medical</strong></p>
    """
    return send_email(to_email, "🔐 ARIA Medical - Rappel : activez votre compte", _base_template("Rappel activation", "🏥", body))


def send_password_reset_email(to_email: str, reset_token: str, base_url: str = None) -> bool:
    frontend_url = os.getenv("FRONTEND_URL", "https://www.aria-web.site")
    reset_link = f"{frontend_url}/reset-password/{reset_token}"

    body = f"""
        <h2>Réinitialisation de votre mot de passe</h2>
        <p>Vous avez demandé à réinitialiser votre mot de passe ARIA Medical.</p>
        <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :</p>
        <div style="text-align:center;">
            <a href="{reset_link}" class="button">🔑 Réinitialiser mon mot de passe</a>
        </div>
        <div class="warning">⏰ <strong>Ce lien est valable 1 heure seulement.</strong></div>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        <p>Cordialement,<br><strong>L'équipe ARIA Medical</strong></p>
    """
    return send_email(to_email, "🔐 ARIA Medical - Réinitialisation de votre mot de passe", _base_template("Reset mot de passe", "🔐", body))


def send_welcome_email(to_email: str, first_name: str, last_name: str) -> bool:
    body = f"""
        <h2>Bienvenue, {first_name} {last_name} ! 🎉</h2>
        <p>Votre compte ARIA Medical a été activé avec succès !</p>
        <p>Vous pouvez maintenant :</p>
        <ul>
            <li>📤 Soumettre des radiographies pour analyse</li>
            <li>🤖 Utiliser notre IA pour détecter des anomalies</li>
            <li>📊 Consulter l'historique de vos analyses</li>
            <li>📄 Générer des rapports PDF</li>
        </ul>
        <p>Cordialement,<br><strong>L'équipe ARIA Medical</strong></p>
    """
    return send_email(to_email, "🎉 ARIA Medical - Votre compte est activé", _base_template("Bienvenue", "🏥", body))


ROLE_LABELS = {
    "medecin": "Médecin",
    "radiologue": "Radiologue",
    "infirmier": "Infirmier",
    "admin": "Administrateur",
    "patient": "Patient",
}

def send_role_changed_email(to_email: str, first_name: str, old_role: str, new_role: str) -> bool:
    old_label = ROLE_LABELS.get(old_role, old_role)
    new_label = ROLE_LABELS.get(new_role, new_role)
    frontend_url = os.getenv("FRONTEND_URL", "https://www.aria-web.site")

    body = f"""
        <h2>Modification de votre rôle</h2>
        <p>Bonjour <strong>{first_name}</strong>,</p>
        <p>Votre rôle sur la plateforme <strong>ARIA Medical</strong> a été modifié par un administrateur.</p>
        <div class="info">
            <p>🔄 <strong>Ancien rôle :</strong> {old_label}</p>
            <p>✅ <strong>Nouveau rôle :</strong> {new_label}</p>
        </div>
        <p>Vos accès et permissions ont été mis à jour en conséquence. Reconnectez-vous pour bénéficier de votre nouveau profil.</p>
        <div style="text-align:center;">
            <a href="{frontend_url}/login" class="button">🔐 Se connecter</a>
        </div>
        <p>Pour toute question, contactez le support ARIA Medical.</p>
        <p>Cordialement,<br><strong>L'équipe ARIA Medical</strong></p>
    """
    return send_email(to_email, f"🔄 ARIA Medical - Votre rôle a été modifié", _base_template("Changement de rôle", "🔄", body))


def send_account_deactivated_email(to_email: str, first_name: str) -> bool:
    body = f"""
        <h2>Votre compte a été désactivé</h2>
        <p>Bonjour <strong>{first_name}</strong>,</p>
        <p>Votre compte sur la plateforme <strong>ARIA Medical</strong> a été <strong>désactivé</strong> par un administrateur.</p>
        <div class="danger">
            ⚠️ Vous ne pouvez plus vous connecter à la plateforme tant que votre compte est désactivé.
        </div>
        <p>Si vous pensez qu'il s'agit d'une erreur ou souhaitez obtenir plus d'informations, contactez le support.</p>
        <p>Cordialement,<br><strong>L'équipe ARIA Medical</strong></p>
    """
    return send_email(to_email, "⚠️ ARIA Medical - Votre compte a été désactivé", _base_template("Compte désactivé", "⚠️", body))


def send_account_reactivated_email(to_email: str, first_name: str) -> bool:
    frontend_url = os.getenv("FRONTEND_URL", "https://www.aria-web.site")
    body = f"""
        <h2>Votre compte a été réactivé ✅</h2>
        <p>Bonjour <strong>{first_name}</strong>,</p>
        <p>Bonne nouvelle ! Votre compte sur la plateforme <strong>ARIA Medical</strong> a été <strong>réactivé</strong> par un administrateur.</p>
        <div class="info">
            ✅ Vous pouvez maintenant vous reconnecter et accéder à vos services.
        </div>
        <div style="text-align:center;">
            <a href="{frontend_url}/login" class="button">🔐 Se connecter</a>
        </div>
        <p>Cordialement,<br><strong>L'équipe ARIA Medical</strong></p>
    """
    return send_email(to_email, "✅ ARIA Medical - Votre compte a été réactivé", _base_template("Compte réactivé", "✅", body))


def send_account_deleted_email(to_email: str, first_name: str) -> bool:
    body = f"""
        <h2>Votre compte a été supprimé</h2>
        <p>Bonjour <strong>{first_name}</strong>,</p>
        <p>Votre compte sur la plateforme <strong>ARIA Medical</strong> a été <strong>définitivement supprimé</strong> par un administrateur.</p>
        <div class="danger">
            🗑️ Toutes vos données ont été effacées de notre système conformément à notre politique de confidentialité.
        </div>
        <p>Si vous pensez qu'il s'agit d'une erreur, contactez immédiatement le support ARIA Medical.</p>
        <p>Cordialement,<br><strong>L'équipe ARIA Medical</strong></p>
    """
    return send_email(to_email, "🗑️ ARIA Medical - Votre compte a été supprimé", _base_template("Compte supprimé", "🗑️", body))
