import mysql.connector

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

import datetime
import random


def get_db_connection():
    return mysql.connector.connect(
        host='localhost',
        user='root',
        password='root',
        database='ats',
        charset='utf8mb4'
    )


def send_notification(user_id, message, **kwargs):
    channel_layer = get_channel_layer()
    group_name = f'user_notifications_{user_id}'
    now = datetime.datetime.now()
    notification_data = {
        'message': message,
        'created-by': 'system',
        'notification_type': kwargs.get('notification_type', 'General'),
        'notification_id': kwargs.get('notification_id', random.randint(1000, 9999)),
        'created-at': {
            'date': now.strftime('%Y-%m-%d'),
            'time': now.strftime('%H:%M:%S')
        },
        'is_read': False
    }

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'send_notification',
            **notification_data
        }
    )