# notifications/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print("WebSocket connection requested")
        self.user = self.scope["user"]
        if self.user.is_authenticated:
            self.group_name = f'user_notifications_{self.user.id}' # Unique group for each user
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
            print(f"WebSocket connected for user: {self.user.username}")
        else:
            await self.close()
            print("WebSocket connection rejected: User not authenticated")

    async def disconnect(self, close_code):
        if self.user.is_authenticated:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            print(f"WebSocket disconnected for user: {self.user.username}, Close code: {close_code}")

    # Receive message from WebSocket (frontend) - not used for pushing, but could be for interaction
    async def receive(self, text_data):
        # We don't expect to receive messages from the frontend for this POC,
        # but you can add logic here if needed for client-to-server communication.
        pass

    # Receive message from channel layer (backend)
    async def send_notification(self, event):
        # Send all event data as notification
        notification_data = {
            'message': event.get('message'),
            'title': event.get('title'),
            'notification_type': event.get('notification_type'),
            'notification_id': event.get('notification_id'),
            'is_read': event.get('is_read'),
            'created-at': event.get('created-at'),
            'created-by': event.get('created-by'),
        }
        await self.send(text_data=json.dumps(notification_data))
        print(f"Sent notification to {self.user.username}: {event.get('message')}")