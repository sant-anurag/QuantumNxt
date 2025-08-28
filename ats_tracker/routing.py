from django.urls import re_path
from . import consumers # You'll create this file next

websocket_urlpatterns = [
    re_path(r'ws/notifications/$', consumers.NotificationConsumer.as_asgi()),
]