import json

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.db.models import Q


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time messaging within a conversation.

    URL: ws/messaging/conversations/<conversation_id>/

    Message flow:
    - Messages are created via the REST API (POST .../messages/).
    - After saving, the REST view calls channel_layer.group_send to push the
      new message to all WebSocket clients subscribed to the conversation group.
    - This consumer is receive-only from the perspective of the client;
      the only client-to-server frame we accept is a keepalive ping.
    """

    async def connect(self):
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.conversation_id = int(self.scope["url_route"]["kwargs"]["conversation_id"])
        self.conversation_group = f"conversation_{self.conversation_id}"
        self.user_group = f"user_{self.user.id}"

        # Only allow participants to subscribe
        if not await self._is_participant():
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.conversation_group, self.channel_name)
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "conversation_group"):
            await self.channel_layer.group_discard(self.conversation_group, self.channel_name)
        if hasattr(self, "user_group"):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)

    async def receive(self, text_data):
        """Client → server. Only ping is handled; all messages go via REST."""
        try:
            data = json.loads(text_data)
            if data.get("type") == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
        except (json.JSONDecodeError, KeyError):
            pass

    # ── Group message handlers (server → client) ─────────────────────────────

    async def chat_message(self, event):
        """Triggered by REST view after a new message is saved."""
        await self.send(text_data=json.dumps({
            "type": "new_message",
            "message": event["message"],
        }))

    async def unread_update(self, event):
        """Triggered by REST view to update the recipient's unread badge."""
        await self.send(text_data=json.dumps({
            "type": "unread_update",
            "unread_count": event.get("unread_count", 0),
        }))

    # ── Helpers ───────────────────────────────────────────────────────────────

    @database_sync_to_async
    def _is_participant(self):
        from .models import Conversation
        return Conversation.objects.filter(
            pk=self.conversation_id
        ).filter(
            Q(participant_1=self.user) | Q(participant_2=self.user)
        ).exists()
