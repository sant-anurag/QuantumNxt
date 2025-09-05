from cryptography.fernet import Fernet

import mysql.connector

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

import datetime
import random
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from django.conf import settings
import smtplib


class DataOperations:
    @staticmethod
    def generate_random_string(length=8):
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        return ''.join(random.choice(characters) for _ in range(length))

    @staticmethod
    def get_db_connection():
        """
        Establishes and returns a MySQL database connection.
        """
        try:
            return mysql.connector.connect(
                host='localhost',
                user='root',
                password='root',
                database='ats',
                charset='utf8mb4'
            )
        except mysql.connector.Error as e:
            print(f"Error connecting to database: {e}")
            return None

    @staticmethod
    def get_user_id_from_emp_id(emp_id):
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM users WHERE email=(select email from hr_team_members where emp_id=%s)", (emp_id,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result[0] if result else None



class MessageProviders:

    @staticmethod
    def send_notification(user_id, message, **kwargs):
        """
        Sends a real-time notification to a specific user via a WebSocket group
        and saves the notification record to the database.

        This function performs two main actions:
        1. It persists the notification data (message, sender, type, timestamp)
        to the `notifications` table in the database.
        2. It uses Django Channels' `group_send` to broadcast the notification
        data in real-time to all connected clients (e.g., a user's web browser)
        that are part of the user's specific notification group.

        Args:
            user_id (int or str): The unique identifier for the user who will
                                receive the notification.
            message (str): The main content of the notification.
            **kwargs: Optional keyword arguments to customize the notification.
                    - created_by (str, optional): The source of the notification.
                                                    Defaults to 'system'.
                    - notification_type (str, optional): The category of the
                                                        notification. Defaults
                                                        to 'General'.
        """
        
        channel_layer = get_channel_layer()
        group_name = f'user_notifications_{user_id}'
        now = datetime.datetime.now()
        notification_data = {
            'message': message,
            'created-by': kwargs.get('created_by', 'system'),
            'notification_type': kwargs.get('notification_type', 'General'),
            'created-at': {
                'date': now.strftime('%Y-%m-%d'),
                'time': now.strftime('%H:%M:%S')
            },
            'is_read': False
        }
        # store notification in database
        print(f"send_notification -> Preparing to send notification to user_id={user_id}")
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO notifications (user_id, message, created_by, notification_type, created_at, is_read)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (user_id, message, notification_data['created-by'], notification_data['notification_type'], now, False))

        print(f"send_notification -> Preparing to send notification to user_id={user_id}")

        # get notification ID
        notification_id = cursor.lastrowid
        
        conn.commit()
        cursor.close()
        conn.close()

        print(f"send_notification -> Sending to group: {group_name} with data: {notification_data}")
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'send_notification',
                **notification_data,
                'notification_id': notification_id,
            }
        )

    @staticmethod
    def send_email(
        from_email,
        app_password,
        to_email,
        subject,
        html_body,
        smtp_host='smtp.gmail.com',
        smtp_port=587,
        **kwargs
    ):
        """
        Send an email using SMTP with HTML content, supporting CC and BCC.
        Args:
            from_email (str): Sender's email address
            app_password (str): App password for SMTP authentication
            to_email (str or list): Recipient's email address(es)
            subject (str): Email subject
            html_body (str): HTML content of the email
            smtp_host (str): SMTP server host (default: Gmail)
            smtp_port (int): SMTP server port (default: 587)
            cc (str or list, optional): CC email address(es)
            bcc (str or list, optional): BCC email address(es)
            attachments (list, optional): List of file paths to attach
        Returns:
            bool: True if sent, False otherwise
        """
        from email.mime.base import MIMEBase
        from email import encoders

        cc = kwargs.get('cc', None)
        bcc = kwargs.get('bcc', None)
        attachments = kwargs.get('attachments', None)

        # Normalize recipients
        def normalize(emails):
            if not emails:
                return []
            if isinstance(emails, str):
                return [emails]
            return list(emails)

        to_emails = normalize(to_email)
        cc_emails = normalize(cc)
        bcc_emails = normalize(bcc)

        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        if cc_emails:
            msg['Cc'] = ', '.join(cc_emails)
        msg.attach(MIMEText(html_body, 'html'))

        # Attach files if provided
        if attachments:
            for file_path in attachments:
                try:
                    with open(file_path, 'rb') as f:
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f'attachment; filename="{file_path.split("/")[-1]}"')
                    msg.attach(part)
                except Exception as e:
                    print(f"send_email -> Failed to attach file {file_path}: {e}")

        # Combine all recipients for SMTP
        all_recipients = to_emails + cc_emails + bcc_emails
        if not all_recipients:
            print("send_email -> No recipients specified.")
            return False

        try:
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
            server.login(from_email, app_password)
            server.sendmail(from_email, all_recipients, msg.as_string())
            print("send_email -> Email sent successfully")
            server.quit()
            return True
        except Exception as e:
            print(f"send_email -> Failed to send email: {e}")
            return False
    

# Valid Fernet key (32 url-safe base64-encoded bytes)
FERNET_KEY = b'1cLjiFtjouXMiGiZ75eRUKkWo2MYpYqlguFRXQgv2wQ='

def encrypt_password(password):
    f = Fernet(FERNET_KEY)
    return f.encrypt(password.encode()).decode()

def decrypt_password(token):
    f = Fernet(FERNET_KEY)
    return f.decrypt(token.encode()).decode()


