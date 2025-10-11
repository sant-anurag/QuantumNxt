import re
# ...existing code...
import bleach
from bleach.css_sanitizer import CSSSanitizer
from bleach.linkifier import Linker, DEFAULT_CALLBACKS
from bleach.callbacks import target_blank # To add target="_blank" to links

import os
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

import io
import pdfkit

import environ

env = environ.Env()
environ.Env.read_env()





class RegEx:
    # PHONE_REG = re.compile(r'[\+\(]?[1-9][0-9 .\-\(\)]{8,}[0-9]')
    PHONE_REG = re.compile(r'^\+?[0-9\s\-()]{10,15}$')  # E.164 format
    EMAIL_REG = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    NAME_REG = re.compile(r'^[a-zA-Z\s.-]+$')

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
                host=env('DATABASE_HOST', default='localhost'),
                user=env('DATABASE_USER', default='your_username'),
                password=env('DATABASE_PASSWORD', default='your_password'),
                database=env('DATABASE_NAME', default='your_database'),
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
    def get_emp_id_from_user_id(user_id):
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT emp_id FROM hr_team_members WHERE email=(SELECT email FROM users WHERE user_id=%s LIMIT 1)", (user_id,))
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
    
    # @staticmethod
    # def update_recruitment_jds(cursor, previous_candidate_data, current_candidate_data):
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
    # Helper to determine the single category of a candidate (based on your definitions)
    def _get_candidate_category(data: dict) -> str:
        """Determines the single, final category for a candidate based on their statuses."""
        
        # 1. Hired (Highest Priority based on 'profiles_completed' definition)
        if data.get('offer_status') == 'accepted':
            return 'completed'
        
        # 2. Rejected (Second Highest Priority)
        rejection_statuses = ['rejected', 'declined']
        if any(data.get(f'{level}_result') == 'rejected' for level in ['screen', 'l1', 'l2', 'l3']):
            return 'rejected'
        if data.get('offer_status') == 'declined':
            return 'rejected'

        # 3. Selected (Post L3, Pre-Offer Acceptance)
        if data.get('l3_result') == 'selected':
            return 'selected'
        
        # 4. On Hold
        if any(data.get(f'{level}_result') == 'onHold' for level in ['screen', 'l1', 'l2', 'l3']):
            return 'on_hold'
            
        # 5. In Progress
        # A candidate is in progress if selected at screening but L3 is not yet done/selected.
        if data.get('screen_status') == 'selected' and data.get('l3_result') == 'toBeScreened':
            return 'in_progress'

        # 6. Default/New (Not tracked by the counters, but helps for tracking logic)
        return 'new'

    @staticmethod
    def update_recruitment_jds(cursor, previous_candidate_data, current_candidate_data):
        """
        Checks for a candidate's status change and updates the corresponding JD's 
        progress counts based on the defined categories.
        """
        jd_id = current_candidate_data.get("jd_id")
        
        if not jd_id:
            print("Error: JD ID not found in candidate data.")
            return False

        # Get the single category for the candidate before and after the update
        prev_category = DataOperations._get_candidate_category(previous_candidate_data)
        curr_category = DataOperations._get_candidate_category(current_candidate_data)

        # Map categories to the JD counter columns
        category_to_column = {
            'completed': 'profiles_completed',  # Offer accepted
            'selected': 'profiles_selected',   # L3 selected, offer not accepted
            'rejected': 'profiles_rejected',   # Rejected at any level or offer declined/withdrawn
            'on_hold': 'profiles_on_hold',     # On hold at any level
            'in_progress': 'profiles_in_progress', # Screened selected, but not L3 selected
            'new': None # Default state, doesn't increment a special counter
        }
        
        # --- Logic for Total Profiles (Handles Initial Candidate Creation) ---
        update_fields = {}
        if previous_candidate_data is None:
            # This assumes the function is called immediately after candidate insertion
            update_fields['total_profiles'] = 'total_profiles + 1'

        # --- Logic for Category Change ---

        # Only proceed if the effective category has changed
        if prev_category != curr_category:
            
            # 1. Decrement the counter for the previous category (if it was a tracked category)
            prev_column = category_to_column.get(prev_category)
            if prev_column:
                update_fields[prev_column] = f'{prev_column} - 1'

            # 2. Increment the counter for the current category (if it is a tracked category)
            curr_column = category_to_column.get(curr_category)
            if curr_column:
                # Check if we are trying to update the same field twice (e.g., in_progress -1 and +1)
                # We must resolve the conflict, which should only happen if the logic in _get_candidate_category is flawed.
                # But in the event of a clash (e.g., A -> B, then B -> A in one step), prioritize the final state.
                if curr_column in update_fields and update_fields[curr_column] == f'{curr_column} - 1':
                    # If previous was X and current is X (but status check somehow triggered this), 
                    # this should mean no change, so we remove both the +1 and -1.
                    del update_fields[curr_column]
                else:
                    update_fields[curr_column] = f'{curr_column} + 1'


        # Build and execute the dynamic UPDATE query
        if update_fields:
            set_clauses = [f"{field} = {value}" for field, value in update_fields.items()]
            query = f"UPDATE recruitment_jds SET {', '.join(set_clauses)} WHERE jd_id = %s"
            try:
                # We assume a MySQL connection error handling utility is available
                cursor.execute(query, (jd_id,)) 
                print(f"Updated recruitment_jds for JD: {jd_id} with changes: {update_fields}")
                return True
            except Exception as err:
                # Assuming mysql.connector.Error is caught higher up or in DataOperations
                print(f"Error updating recruitment_jds: {err}")
                return False
                
        return True

    @staticmethod
    def get_team_lead_teams(user_id):
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT team_id 
            FROM teams 
            WHERE lead_emp_id = (
                SELECT emp_id 
                FROM hr_team_members 
                WHERE email = (SELECT email FROM users WHERE user_id=%s)
            )
        """, (user_id,))
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return [row['team_id'] for row in results] if results else []

    @staticmethod
    def get_email_configs(user_id):
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT email, email_smtp_port, email_smtp_host, email_host_password 
            FROM email_config
            WHERE user_id=%s
        """, (user_id,))
        config = cursor.fetchone()
        cursor.close()
        conn.close()
        return config if config else {}

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
            in_memory_attachments (list, optional): List of (filename, file_content) tuples
        Returns:
            bool: True if sent, False otherwise
        """
        from email.mime.base import MIMEBase
        from email import encoders

        cc = kwargs.get('cc', None)
        bcc = kwargs.get('bcc', None)
        attachments = kwargs.get('attachments', None)
        in_memory_attachments = kwargs.get('in_memory_attachments', None)

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

        if in_memory_attachments:
            for filename, file_content in in_memory_attachments:
                try:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(file_content.getvalue())
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
                    msg.attach(part)
                except Exception as e:
                    print(f"send_email -> Failed to attach file {filename}: {e}")
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
    

class DataValidators:
    @staticmethod
    def is_valid_email(email):
        return re.match(RegEx.EMAIL_REG, email) is not None

    @staticmethod
    def is_valid_mobile_number(mobile):
        return re.match(RegEx.PHONE_REG, mobile) is not None

    @staticmethod
    def is_valid_date(date_str):
        try:
            datetime.datetime.strptime(date_str, '%Y-%m-%d')
            return True
        except ValueError:
            return False
    
    @staticmethod
    def validate_password_strength(password):
        """
        Validates the strength of a password.
        A strong password must be at least 8 characters long and include at least one uppercase letter,
        one lowercase letter, one digit, and one special character.

        Args:
            password (str): The password to validate.
        Returns:
            bool: True if the password is strong, False otherwise.
        """
        if len(password) < 8:
            return False
        if not re.search(r'[A-Z]', password):
            return False
        if not re.search(r'[a-z]', password):
            return False
        if not re.search(r'\d', password):
            return False
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            return False
        return True
    
    def validate_names(name):
        """
        Validates that a name contains only alphabetic characters and spaces.
        
        Args:
            name (str): The name to validate.

        Returns:
            bool: True if the name is valid, False otherwise.
        """

        return re.match(RegEx.NAME_REG, name) is not None

    @staticmethod
    def sanitize_html(html_content):
        """
        Sanitizes HTML content to prevent XSS attacks by removing potentially dangerous tags and attributes.

        Args:
            html_content (str): The HTML content to sanitize.
        Returns:
            str: The sanitized HTML content.
        """
        css_sanitizer = CSSSanitizer(allowed_css_properties=Constants.ALLOWED_STYLES)
        linkify_callbacks = DEFAULT_CALLBACKS + [target_blank]
        if not html_content:
            return ""
            
        # --- 2. Initial Cleaning and Stripping ---
        cleaned_html = bleach.clean(
            html_content,
            tags=Constants.ALLOWED_TAGS,
            attributes=Constants.ALLOWED_ATTRIBUTES,
            css_sanitizer=css_sanitizer, # Strips all non-allowed styles
            strip=True,                  # Strip disallowed tags entirely
            strip_comments=True
        )
        
        # --- 3. Linkification and Security ---
        
        # Safely convert plain text URLs into links, and enforce security attributes 
        # on ALL links (new or existing).
        cleaned_html = bleach.linkify(
            cleaned_html,
            # Force these security attributes on all links
            callbacks=linkify_callbacks,
            # Don't try to make links out of text inside a pre or code block 
            skip_tags=['pre', 'code'], 
        )
        
        return cleaned_html



# Valid Fernet key (32 url-safe base64-encoded bytes)
FERNET_KEY = env('FERNET_KEY', default='1cLjiFtjouXMiGiZ75eRUKkWo2MYpYqlguFRXQgv2wQ=')  # Replace with your actual key or load from env

def encrypt_password(password):
    f = Fernet(FERNET_KEY)
    return f.encrypt(password.encode()).decode()

def decrypt_password(token):
    f = Fernet(FERNET_KEY)
    return f.decrypt(token.encode()).decode()

def get_display_filename(file_name, jd_id):
    # file_name format: JDID__OriginalName__Unique.ext
    # Remove prefix and suffix
    try:
        parts = file_name.split('__')
        if len(parts) >= 3:
            # parts[1] is the original name
            orig_name = parts[1]
            ext = os.path.splitext(file_name)[1]
            return orig_name + ext
        return file_name
    except Exception:
        return file_name


def compare_mobile_numbers(num1, num2):
    """
    Compare two mobile numbers for equality, ignoring country codes, spaces, dashes, brackets, and leading zeros.
    Returns True if numbers match, False otherwise.
    """
    def normalize(number):
        # Remove all non-digit characters
        digits = re.sub(r'\D', '', str(number))
        # Remove leading country code (assume country code is up to 3 digits)
        # Remove leading zeros
        digits = digits.lstrip('0')
        # If number is longer than 10 digits, take last 10 digits (assume Indian mobile numbers)
        if len(digits) > 10:
            digits = digits[-10:]
        return digits

    return normalize(num1) == normalize(num2)


class PDFGenerator:
    """
    A utility class for generating PDF files from HTML content using pdfkit, 
    which is a wrapper around the powerful wkhtmltopdf utility.

    Dependencies required:
    1. Python package: pip install pdfkit
    2. System dependency: The wkhtmltopdf executable MUST be installed on your system 
       and available in your system's PATH. (wkhtmltopdf can be downloaded from its official website).
    """

    @staticmethod
    def generate_pdf_from_html(html_content: str) -> io.BytesIO:
        """
        Converts a string of HTML content into a PDF file held in memory.

        Args:
            html_content: The full HTML content string (including <html>, <body> tags).

        Returns:
            An io.BytesIO object containing the generated PDF data.
        """
        try:
            # pdfkit.from_string returns the raw PDF content (bytes)
            # The output is suppressed (False) so it returns the bytes instead of writing to a file.
            pdf_bytes = pdfkit.from_string(html_content, False)

            # 1. Create an in-memory file-like object and write the bytes
            pdf_file = io.BytesIO(pdf_bytes)

            # 2. Rewind the buffer's position to the start before returning.
            pdf_file.seek(0)
            
            return pdf_file

        except IOError as e:
            # Handle case where wkhtmltopdf is not found or not accessible.
            # This is the most common error with pdfkit setup.
            print(f"I/O Error generating PDF. Ensure 'wkhtmltopdf' is installed and in your PATH. Error: {e}")
            # Returning an empty BytesIO object upon failure
            return io.BytesIO(b'')
        except Exception as e:
            # Catch other potential errors
            print(f"Error generating PDF: {e}")
            return io.BytesIO(b'')


class Constants:
    ROLES = {
        'Admin': 'Admin',
        'Team Lead': 'Team_Lead',
        'User': 'User'
    }
    NOTIFICATION_TYPES = ['General', 'Task', 'Alert', 'Reminder']
    EMAIL_PROVIDERS = list(MessageProviders.MAIL_SERVICE_PROVIDERS.keys())

    DEFAULT_PASSWORD = env('DEFAULT_PASSWORD', default='Welcome@123')  # Default password for new users

    MIN_JOIN_DATE = env('MIN_JOIN_DATE', default='2020-01-01')  # Minimum allowed joining date

    ALLOWED_TAGS = {
        'p', 'div', 'h2', 'h3', 'ul', 'ol', 'li', 'br',
        'strong', 'b', 'em', 'i', 'a', 
    }
    ALLOWED_ATTRIBUTES = {
        'a': ['href', 'title', 'target', 'rel'],
        '*': ['class', 'style'], 
    }
    ALLOWED_STYLES = [
        'text-align', 
        'list-style-type', # for list styling
    ]

    @staticmethod
    def validate_role(role):
        return role in Constants.ROLES.keys()
    # Add more constants as needed

print("utils.py loaded successfully", Constants.MIN_JOIN_DATE)

# tdbksrwtmgqzbyid