"""
ASGI config for ats project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from ats_tracker.consumers_auth import CustomAuthMiddlewareStack
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ats.settings')

# application = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import ats_tracker.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(), # Standard HTTP handling by Django
    "websocket": # AllowedHostsOriginValidator( # WebSocket handling
    CustomAuthMiddlewareStack( # Ensures user is authenticated for WebSocket
            URLRouter(
                ats_tracker.routing.websocket_urlpatterns # Your WebSocket routes
            )
        )
    # ),
})