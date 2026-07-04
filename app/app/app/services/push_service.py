"""Service d'envoi de notifications push via Expo."""
import httpx
import logging

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def send_push_notification(token: str, title: str, body: str, data: dict = None):
    """Envoyer une notification push via Expo."""
    if not token or not token.startswith("ExponentPushToken"):
        return False

    message = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "priority": "high",
        "channelId": "default",
        "data": data or {},
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            result = response.json()
            if result.get("data", {}).get("status") == "ok":
                logger.info(f"✅ Notification envoyée à {token[:20]}...")
                return True
            else:
                logger.warning(f"Erreur notification: {result}")
                return False
    except Exception as e:
        logger.error(f"Erreur envoi notification: {e}")
        return False


async def send_message_notification(db, sender, discussion_id: str, message_content: str):
    """Notifier l'autre participant d'un nouveau message."""
    from app.db import models
    import uuid

    try:
        disc_uuid = uuid.UUID(discussion_id)
        discussion = db.query(models.Discussion).filter(
            models.Discussion.id == disc_uuid
        ).first()
        if not discussion:
            return

        # Déterminer le destinataire
        if str(sender.id) == str(discussion.doctor_id):
            recipient_id = discussion.radiologist_id
        else:
            recipient_id = discussion.doctor_id

        recipient = db.query(models.User).filter(
            models.User.id == recipient_id
        ).first()

        if recipient and recipient.push_token:
            await send_push_notification(
                token=recipient.push_token,
                title=f"💬 {sender.first_name} {sender.last_name}",
                body=message_content[:100],
                data={"discussionId": discussion_id}
            )
    except Exception as e:
        logger.error(f"Erreur notification message: {e}")
