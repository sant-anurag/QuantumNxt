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
    def close_db_connection(conn, cursor=None):
        """
        Closes the database connection.
        """
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    @staticmethod
    def get_user_id_from_emp_id(emp_id):
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM users WHERE email=(select email from hr_team_members where emp_id=%s)", (emp_id,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result[0] if result else None
    
    @staticmethod
    def get_team_lead_user_id_from_team_id(team_id):
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT lead_emp_id FROM teams WHERE team_id=%s", (team_id,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        if result:
            lead_emp_id = result['lead_emp_id']
            return DataOperations.get_user_id_from_emp_id(lead_emp_id)
        return None
    
    @staticmethod
    def get_user_settings(user_id):
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM user_settings WHERE user_id=%s", (user_id,))
        settings = cursor.fetchone()
        cursor.close()
        conn.close()
        return settings if settings else {}

    @staticmethod
    def get_jds(columns=[], Where_clause="", params=()):
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = f"""
            SELECT {', '.join(columns) if columns else '*'}
            FROM recruitment_jds 
        """
        if Where_clause:
            query += f" WHERE {Where_clause}"
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        jds = cursor.fetchall()
        cursor.close()
        conn.close()
        return jds
    
    @staticmethod
    def update_recruitment_jds(cursor, previous_candidate_data, current_candidate_data):
        """
        Checks for status changes in a candidate profile and updates the
        corresponding JD's progress counts in the recruitment_jds table.

        Args:
            cursor: A MySQL cursor object.
            previous_candidate_data (dict): The candidate's data before the update.
            current_candidate_data (dict): The candidate's data after the update.
        """
        jd_id = current_candidate_data.get("jd_id")
        
        if not jd_id:
            print("Error: JD ID not found in candidate data.")
            return False

        # A dictionary to hold the fields to update and their new values
        update_fields = {}
        
        # Check for change in screen_status
        prev_screen_status = previous_candidate_data.get('screen_status')
        curr_screen_status = current_candidate_data.get('screen_status')

        # Condition 1: Update total_profiles
        # This should be handled at the point of candidate creation, not update.
        # The initial function would have an INSERT trigger or logic to increment total_profiles.

        # Condition 2: Update profiles_in_progress
        # A profile moves to 'in progress' when it is screened 'selected' but hasn't completed all rounds.
        # A profile is removed from 'in progress' when it's completed.
        
        # Check if a profile is now completed or rejected, and if it was previously in progress
        is_now_completed_or_rejected = (
            (curr_screen_status == 'rejected') or 
            (current_candidate_data.get('l1_result') == 'rejected') or 
            (current_candidate_data.get('l2_result') == 'rejected') or 
            (current_candidate_data.get('l3_result') == 'selected')
        )
        was_in_progress = (
            (prev_screen_status == 'selected' and current_candidate_data.get('l1_result') == 'toBeScreened') or
            (previous_candidate_data.get('l1_result') == 'selected' and current_candidate_data.get('l2_result') == 'toBeScreened') or
            (previous_candidate_data.get('l2_result') == 'selected' and current_candidate_data.get('l3_result') == 'toBeScreened')
        )

        if is_now_completed_or_rejected and was_in_progress:
            # A profile is no longer 'in progress' once completed or rejected in a later round
            update_fields['profiles_in_progress'] = 'profiles_in_progress - 1'

        # Condition 3 & 4: Update profiles_selected and profiles_completed
        # A profile is considered completed if it's rejected at any stage or selected in all stages.
        prev_l1_result = previous_candidate_data.get('l1_result')
        prev_l2_result = previous_candidate_data.get('l2_result')
        prev_l3_result = previous_candidate_data.get('l3_result')

        curr_l1_result = current_candidate_data.get('l1_result')
        curr_l2_result = current_candidate_data.get('l2_result')
        curr_l3_result = current_candidate_data.get('l3_result')

        # When a candidate is fully selected
        if (curr_l3_result == 'selected' and 
            prev_l3_result in ['toBeScreened', 'onHold'] and
            curr_l1_result == 'selected' and 
            curr_l2_result == 'selected'):
            update_fields['profiles_selected'] = 'profiles_selected + 1'
            update_fields['profiles_completed'] = 'profiles_completed + 1'

        # Condition 5: Update profiles_rejected
        # When a candidate is rejected at any stage
        is_now_rejected = (
            (curr_screen_status == 'rejected' and prev_screen_status != 'rejected') or
            (curr_l1_result == 'rejected' and prev_l1_result != 'rejected') or
            (curr_l2_result == 'rejected' and prev_l2_result != 'rejected') or
            (curr_l3_result == 'rejected' and prev_l3_result != 'rejected')
        )
        if is_now_rejected:
            update_fields['profiles_rejected'] = 'profiles_rejected + 1'
            update_fields['profiles_completed'] = 'profiles_completed + 1'

        # Condition 6: Update profiles_on_hold
        # When a candidate is put on hold at any stage
        is_now_on_hold = (
            (curr_screen_status == 'onHold' and prev_screen_status != 'onHold') or
            (curr_l1_result == 'onHold' and prev_l1_result != 'onHold') or
            (curr_l2_result == 'onHold' and prev_l2_result != 'onHold') or
            (curr_l3_result == 'onHold' and prev_l3_result != 'onHold')
        )
        was_on_hold = (
            (prev_screen_status == 'onHold' and curr_screen_status != 'onHold') or
            (prev_l1_result == 'onHold' and curr_l1_result != 'onHold') or
            (prev_l2_result == 'onHold' and curr_l2_result != 'onHold') or
            (prev_l3_result == 'onHold' and curr_l3_result != 'onHold')
        )

        if is_now_on_hold:
            update_fields['profiles_on_hold'] = 'profiles_on_hold + 1'
        if was_on_hold:
            update_fields['profiles_on_hold'] = 'profiles_on_hold - 1'

        # Build and execute the dynamic UPDATE query
        if update_fields:
            set_clauses = [f"{field} = {value}" for field, value in update_fields.items()]
            query = f"UPDATE recruitment_jds SET {', '.join(set_clauses)} WHERE jd_id = %s"
            try:
                cursor.execute(query, (jd_id,))
                print(f"Updated recruitment_jds for JD: {jd_id} with changes: {update_fields}")
                return True
            except mysql.connector.Error as err:
                print(f"Error updating recruitment_jds: {err}")
                return False
        return True




class MessageProviders:

    MAIL_SERVICE_PROVIDERS = {
        'Gmail': {
            'smtp_host': 'smtp.gmail.com',
            'smtp_port': 587
        },
        'Outlook': {
            'smtp_host': 'smtp.office365.com',
            'smtp_port': 587
        },
        'Yahoo': {
            'smtp_host': 'smtp.mail.yahoo.com',
            'smtp_port': 587
        },
        'Zoho': {
            'smtp_host': 'smtp.zoho.com',
            'smtp_port': 587
        }
    }

    @staticmethod
    def send_notification(user_id, title, message, **kwargs):
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
            'title': title,
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
            INSERT INTO notifications (user_id, title, message, created_by, notification_type, created_at, is_read)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_id, title, message, notification_data['created-by'], notification_data['notification_type'], now, False))

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

class Constants:
    ROLES = {
        'Admin': 'Admin',
        'Team Lead': 'Team_Lead',
        'User': 'User'
    }
    NOTIFICATION_TYPES = ['General', 'Task', 'Alert', 'Reminder']
    EMAIL_PROVIDERS = list(MessageProviders.MAIL_SERVICE_PROVIDERS.keys())
    
    def validate_role(role):
        return role in Constants.ROLES.keys()
    # Add more constants as needed

# tdbksrwtmgqzbyid