# consumers/middleware.py
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from django.contrib.sessions.models import Session
from .utils import DataOperations

class User:
    def __init__(self, user_id, username, email, role):
        self.id = user_id
        self.username = username
        self.email = email
        self.role = role
        self.is_authenticated = False

    def authenticate(self):
        self.is_authenticated = True
    
    def __str__(self):
        return f"User({self.id}, {self.username}, {self.email}, {self.role}, {self.is_authenticated})"

@database_sync_to_async
def get_user_from_session(session_key):
    try:
        session = Session.objects.get(session_key=session_key)
        session_data = session.get_decoded()
        user_id = session_data.get('user_id')
        
        if user_id:
            conn = DataOperations.get_db_connection()
            cursor = conn.cursor(dictionary=True)

            cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
            
            user = cursor.fetchone()
            cursor.close()
            conn.close()
            fields = ['user_id', 'username', 'email', 'role', ]  # Add other fields as necessary
            user_obj = User(**{field: user[field] for field in fields if field in user})
            user_obj.authenticate()
            return user_obj
    except Exception:
        pass
    return AnonymousUser()


class CustomAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # Extract sessionid from cookies
        session_key = None
        for header in scope.get('headers', []):
            if header[0] == b'cookie':
                cookies = header[1].decode().split(';')
                for cookie in cookies:
                    if cookie.strip().startswith('sessionid='):
                        session_key = cookie.strip().split('=')[1]
        user = await get_user_from_session(session_key)
        print("Authenticated user:", user)
        scope['user'] = user
        return await self.inner(scope, receive, send)


def CustomAuthMiddlewareStack(inner):
    return CustomAuthMiddleware(inner)


