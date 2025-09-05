import os
import json
from datetime import datetime
import mysql.connector
import textract
from .parser import ResumeParser

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth import logout
from django.db import connection
from django.http import (
    JsonResponse, HttpResponseBadRequest, FileResponse, Http404, HttpResponse
)
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt
from django.template.loader import render_to_string

from .db_initializer import ATSDatabaseInitializer

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .utils import DataOperations, MessageProviders

def login_view(request):
    """
    Login view for user authentication.

    """
    initializer = ATSDatabaseInitializer()
    initializer.initialize()
    initializer.close()

    username = request.POST.get('username', '').strip()
    password = request.POST.get('password', '').strip()
    name = username  # Default name

    if request.method == 'POST':
        if not username or not password:
            return render(request, 'login.html', {'error': 'Please enter both username/email and password.'})

        valid_user = validate_user(username, password)
        print("login_view -> Valid User:", valid_user)
        if valid_user and valid_user[0] is not None:
            user_id, db_username, role, status = valid_user

            # Check for existing active session
            conn = DataOperations.get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT session_id, expires_at FROM user_sessions WHERE user_id=%s AND expires_at > %s",
                (user_id, datetime.now())
            )
            existing_session = cursor.fetchone()
            if existing_session:
                cursor.close()
                conn.close()
                return render(request, 'login.html', {'error': 'User already logged in elsewhere.'})

            # Create new session
            import uuid
            session_id = str(uuid.uuid4())
            session_expiry = settings.SESSION_COOKIE_AGE  # seconds
            expires_at = datetime.now() + timedelta(seconds=session_expiry)
            cursor.execute(
                "INSERT INTO user_sessions (session_id, user_id, expires_at) VALUES (%s, %s, %s)",
                (session_id, user_id, expires_at)
            )

            # Fetch name from hr_team_members table against email
            cursor.execute("SELECT first_name, last_name FROM hr_team_members WHERE email=%s", [username])
            row = cursor.fetchone()
            if row:
                first_name, last_name = row['first_name'], row['last_name']
                name = f"{first_name} {last_name}"

            conn.commit()
            cursor.close()
            conn.close()

            request.session['user_id'] = user_id
            request.session['username'] = db_username
            request.session['role'] = role
            request.session['authenticated'] = True
            request.session['email'] = username
            request.session['name'] = name
            request.session['session_id'] = session_id  # Store session_id

            return redirect('home')
        else:
            return render(request, 'login.html', {'error': 'Invalid credentials or inactive user.'})
    print("login_view -> User Name:", name)
    return render(request, 'login.html', {'error': 'Click Submit to Proceed'})

# function to validate username and password with users table
def validate_user(username, password):
    """
    Validate user credentials against the database.

    """
    print("validate_user -> Username:", username)
    print("validate_user -> Password:", password)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, username, email, password_hash, role, is_active
        FROM users
        WHERE username=%s OR email=%s
        LIMIT 1
    """, [username, username])
    row = cursor.fetchone()
    print("validate_user -> Database row:", row)
    #compare the hashed password with the stored hash
    if row:
        print("validate_user -> User found in database")
        user_id, db_username, db_email, db_hash, role, is_active = row
        if check_password(password, db_hash) and is_active:
            status = True
            return user_id, db_username, role,status
    cursor.close()
    conn.close()
    return None, None, None,None

def home(request):
    """Home view for authenticated users."""
    name = request.session.get('name', 'Guest')
    return render(request, 'home.html', {'name': name})





def add_member(request):
    """
    View to add a new HR team member.

    """
    print("add_member -> Request method:", request.method)
    message = ''
    error = ''
    if request.method == 'POST':
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        email = request.POST.get('email', '').strip()
        phone = request.POST.get('phone', '').strip()
        role = request.POST.get('role', '').strip()
        date_joined = request.POST.get('date_joined', '').strip()
        status = request.POST.get('status', 'active').strip()

        # Basic in-view validation
        if not first_name or not last_name or not email or not role or not date_joined:
            error = "All fields except phone are required."
        elif '@' not in email or len(email) > 100:
            error = "Invalid email address."
        elif len(first_name) > 50 or len(last_name) > 50:
            error = "First and last name should be under 50 characters."
        elif status not in ('active', 'inactive', 'on_leave'):
            error = "Invalid status."
        elif phone and (not phone.isdigit() or len(phone) > 20):
            error = "Phone must be numeric and under 20 digits."
        else:
            try:
                # Add HR team member
                connection = DataOperations.get_db_connection()
                cursor = connection.cursor()
                cursor.execute("""
                    INSERT INTO hr_team_members
                    (first_name, last_name, email, phone, role, date_joined, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, [first_name, last_name, email, phone, role, date_joined, status])
                connection.commit()

                # Create user login for HR member
                from django.contrib.auth.hashers import make_password
                default_password = "Welcome@123"
                password_hash = make_password(default_password)
                cursor.execute("""
                    INSERT INTO users (username, email, password_hash, role, is_active)
                    VALUES (%s, %s, %s, %s, %s)
                """, [email, email, password_hash, "User", True])
                connection.commit()

                message = f"Member {escape(first_name)} {escape(last_name)} added successfully and login created!"

                # creating login for the new member
            except Exception as e:
                if 'Duplicate entry' in str(e):
                    error = "A member with this email already exists."
                else:
                    error = f"Failed to add member: {str(e)}"
            finally:
                if 'cursor' in locals():
                    cursor.close()
                if 'connection' in locals():
                    connection.close()
    name = request.session.get('name', 'Guest')
    return render(request, 'add_member.html', {
        'message': message,
        'name': name,
        'error': error
    })

def create_team(request):
    """
    View to create a new team.

    """
    message = error = None
    members = []
    teams = []
    print("create_team -> Request method:", request.POST)
    if request.method == "POST":
        team_name = request.POST.get("team_name", "").strip()
        selected_members = request.POST.getlist("members")
        team_lead = request.POST.get("team_lead", "").strip()
        # Deduplicate member IDs
        selected_members = list(set(selected_members))
        if not team_name or not selected_members:
            error = "Team name and at least one member are required."
        else:
            # try:
                conn = DataOperations.get_db_connection()
                cursor = conn.cursor(dictionary=True)
                # Check for duplicate team name
                cursor.execute("SELECT COUNT(*) as count FROM teams WHERE team_name=%s", [team_name])
                t = cursor.fetchone()
                print("create_team -> Duplicate check result:", t, type(t), t['count'] if t else 'N/A', type(t['count']) if t else 'N/A')
                if t['count'] > 0:
                    error = "A team with this name already exists."
                else:
                    cursor.execute("INSERT INTO teams (team_name, lead_emp_id) VALUES (%s, %s)", [team_name, team_lead])
                    team_id = cursor.lastrowid
                    for emp_id in selected_members:
                        cursor.execute("INSERT INTO team_members (team_id, emp_id) VALUES (%s, %s)", [team_id, emp_id])

                    conn.commit()

                    for emp_id in selected_members:
                        user_id = DataOperations.get_user_id_from_emp_id(emp_id)
                        if user_id:
                            MessageProviders.send_notification(user_id, "Team Update", f"You have been added to the team '{team_name}'", created_by="system", notification_type="Team")
                    # message = f"Team '{team_name}' created successfully."
            # except Exception as e:
            #     error = f"Failed to create team: {str(e)}"
            # finally:
                if 'cursor' in locals():
                    cursor.close()
                if 'conn' in locals():
                    conn.close()
    # Fetch available members
    try:
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT emp_id, first_name, last_name, email, phone FROM hr_team_members WHERE status='active'")
        members = cursor.fetchall()
        # Fetch teams and their strength
        cursor.execute("""
            SELECT t.team_id, t.team_name, t.created_at, COUNT(tm.emp_id) as strength
            FROM teams t
            LEFT JOIN team_members tm ON t.team_id = tm.team_id
            GROUP BY t.team_id, t.team_name, t.created_at
            ORDER BY t.created_at DESC
        """)
        teams = cursor.fetchall()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
    name = request.session.get('name', 'Guest')
    return render(request, "create_team.html", {
        "members": members,
        "teams": teams,
        "message": message,
        "name": name,
        "error": error
    })

def team_members(request, team_id):
    """
    View to get members of a specific team.
    """
    try:
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT m.emp_id, m.first_name, m.last_name, m.email, m.phone, m.role, m.date_joined, m.status
            FROM hr_team_members m
            JOIN team_members tm ON m.emp_id = tm.emp_id
            WHERE tm.team_id = %s
        """, [team_id])
        members = cursor.fetchall()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
    return JsonResponse({"members": members})

def view_edit_teams(request):
    """
    View to edit existing teams.
    """
    teams = []
    try:
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT t.team_id, t.team_name, t.created_at, COUNT(tm.emp_id) as strength
            FROM teams t
            LEFT JOIN team_members tm ON t.team_id = tm.team_id
            GROUP BY t.team_id, t.team_name, t.created_at
            ORDER BY t.created_at DESC
        """)
        teams = cursor.fetchall()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
    name = request.session.get('name', 'Guest')
    return render(request, 'view_edit_teams.html', {'teams': teams,
                                                    'name': name})

def team_members_api(request, team_id):
    """
    API endpoint to get members of a specific team.
    """
    members = []
    available_members = []
    try:
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Get team members
        cursor.execute("""
            SELECT m.emp_id, m.first_name, m.last_name, m.email, m.role
            FROM hr_team_members m
            INNER JOIN team_members tm ON m.emp_id = tm.emp_id
            WHERE tm.team_id = %s
        """, [team_id])
        members = cursor.fetchall()
        # Get available members not in this team
        cursor.execute("""
            SELECT m.emp_id, m.first_name, m.last_name, m.email
            FROM hr_team_members m
            WHERE m.emp_id NOT IN (
                SELECT emp_id FROM team_members WHERE team_id = %s
            )
        """, [team_id])
        available_members = cursor.fetchall()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
    return JsonResponse({'members': members, 'available_members': available_members})

@csrf_exempt
def add_member_api(request, team_id):
    """
    API endpoint to add a member to a specific team.
    """
    success = False
    try:
        data = json.loads(request.body)
        emp_id = data.get('emp_id')
        if not emp_id:
            return HttpResponseBadRequest("emp_id required")
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        # Insert into team_members, ignore if already exists
        cursor.execute("""
            INSERT IGNORE INTO team_members (team_id, emp_id) VALUES (%s, %s)
        """, [team_id, emp_id])

        # Get user id of the member (from users table, by matching email from hr_team_members)
        user_id = DataOperations.get_user_id_from_emp_id(emp_id)

        # Get team name
        cursor.execute("SELECT team_name FROM teams WHERE team_id=%s", [team_id])
        team_row = cursor.fetchone()
        team_name = team_row[0] if team_row else None

        conn.commit()
        if user_id:
            MessageProviders.send_notification(user_id, "Team Update", f"You have been added to the team '{team_name}'", created_by="system", notification_type="Team")
    except Exception as e:
        return HttpResponseBadRequest(str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

    return team_members_api(request, team_id)

@csrf_exempt
def remove_member_api(request, team_id):
    """
    API endpoint to remove a member from a specific team.
    """
    try:
        data = json.loads(request.body)
        emp_id = data.get('emp_id')
        if not emp_id:
            return HttpResponseBadRequest("emp_id required")
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM team_members WHERE team_id = %s AND emp_id = %s
        """, [team_id, emp_id])

        # Get user id of the member (from users table, by matching email from hr_team_members)
        user_id = DataOperations.get_user_id_from_emp_id(emp_id)

        # Get team name
        cursor.execute("SELECT team_name FROM teams WHERE team_id=%s", [team_id])
        team_row = cursor.fetchone()
        team_name = team_row[0] if team_row else None
        conn.commit()
        MessageProviders.send_notification(user_id, "Team Update", f"You have been removed from the team '{team_name}'", created_by="system", notification_type="Team")
    except Exception as e:
        return HttpResponseBadRequest(str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
    return team_members_api(request, team_id)


def generate_jd_id():
    """
    Generate a new job description ID.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT jd_id FROM recruitment_jds ORDER BY created_at DESC LIMIT 1")
    last = cursor.fetchone()
    if last:
        num = int(last[0][2:]) + 1
    else:
        num = 1
    return f"JD{num:02d}"

def jd_list(request):
    """
    View to list all job descriptions.
    """
    print("jd_list -> Request method:", request.method)
    search = request.GET.get("search", "")
    page = int(request.GET.get("page", 1))
    limit = 10
    offset = (page - 1) * limit
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Join with customers to get company name
    query = """
        SELECT j.*, c.company_name
        FROM recruitment_jds j
        LEFT JOIN customers c ON j.company_id = c.company_id
    """
    params = []
    if search:
        query += " WHERE j.jd_id LIKE %s OR j.jd_summary LIKE %s"
        params = [f"%{search}%", f"%{search}%"]
    query += " ORDER BY j.created_at DESC LIMIT %s OFFSET %s"
    params += [limit, offset]
    cursor.execute(query, params)
    jds = cursor.fetchall()
    cursor.execute("SELECT COUNT(*) FROM recruitment_jds" + (" WHERE jd_id LIKE %s OR jd_summary LIKE %s" if search else ""), params[:2] if search else [])
    count_row = cursor.fetchone()
    total = count_row['COUNT(*)'] if count_row else 0
    num_pages = (total // limit) + (1 if total % limit else 0)
    page_range = range(1, num_pages + 1)
    # Fetch companies for dropdown
    cursor.execute("SELECT company_id, company_name FROM customers ORDER BY company_name")
    companies = cursor.fetchall()
    conn.close()
    name = request.session.get('name', 'Guest')
    return render(request, "jd_create.html", {
        "jds": jds,
        "total": total,
        "page": page,
        "name": name,
        "search": search,
        "page_range": page_range,
        "companies": companies
    })

@csrf_exempt
def create_jd(request):
    """
    View to create a new job description.
    """
    print("create_jd -> Request method:", request.method)
    message = error = None
    if request.method == "POST":
        jd_id = generate_jd_id()
        company_id = request.POST.get("company_id")
        jd_summary = request.POST["jd_summary"]
        jd_description = request.POST["jd_description"]
        must_have_skills = request.POST["must_have_skills"]
        good_to_have_skills = request.POST["good_to_have_skills"]
        no_of_positions = int(request.POST.get("no_of_positions", 1))
        jd_status = request.POST.get("jd_status", "active")
        created_by = request.session.get("user_id", None)
        try:
            conn = DataOperations.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO recruitment_jds
                (jd_id, company_id, jd_summary, jd_description, must_have_skills, good_to_have_skills, no_of_positions, jd_status, created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (jd_id, company_id, jd_summary, jd_description, must_have_skills, good_to_have_skills, no_of_positions, jd_status, created_by))
            conn.commit()
            message = f"Task {escape(jd_id)} created successfully!"
        except Exception as e:
            if "Duplicate entry" in str(e):
                error = "A JD with this ID already exists."
            else:
                error = f"Failed to create JD: {escape(str(e))}"
        finally:
            if 'cursor' in locals():
                cursor.close()
            if 'conn' in locals():
                conn.close()
        # Fetch companies for dropdown
        companies = []
        try:
            conn = DataOperations.get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT company_id, company_name FROM customers ORDER BY company_name")
            companies = cursor.fetchall()
        finally:
            if 'cursor' in locals():
                cursor.close()
            if 'conn' in locals():
                conn.close()
        return render(request, "jd_create.html", {
            "companies": companies,
            "message": message,
            "error": error
        })
    return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
def jd_detail(request, jd_id):
    """
    View to get details of a specific job description.
    """
    print("jd_detail -> Request method:", request.method)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    if request.method == "GET":
        cursor.execute("""
            SELECT j.*, c.company_name
            FROM recruitment_jds j
            LEFT JOIN customers c ON j.company_id = c.company_id
            WHERE j.jd_id=%s
        """, (jd_id,))
        jd = cursor.fetchone()
        # Also fetch companies for modal dropdown
        cursor.execute("SELECT company_id, company_name FROM customers ORDER BY company_name")
        companies = cursor.fetchall()
        jd['companies'] = companies
        conn.close()
        return JsonResponse(jd)
    elif request.method == "POST":
        company_id = request.POST.get("company_id")
        jd_summary = request.POST["jd_summary"]
        jd_description = request.POST["jd_description"]
        must_have_skills = request.POST["must_have_skills"]
        good_to_have_skills = request.POST["good_to_have_skills"]
        no_of_positions = int(request.POST.get("no_of_positions", 1))
        jd_status = request.POST.get("jd_status", "active")
        cursor.execute("""
            UPDATE recruitment_jds SET
            company_id=%s, jd_summary=%s, jd_description=%s, must_have_skills=%s, good_to_have_skills=%s,
            no_of_positions=%s, jd_status=%s, updated_at=NOW()
            WHERE jd_id=%s
        """, (company_id, jd_summary, jd_description, must_have_skills, good_to_have_skills, no_of_positions, total_profiles, jd_status, jd_id))
        conn.commit()
        conn.close()
        return JsonResponse({"success": True})


def create_customer(request):
    """
    View to create a new customer.
    """
    message = error = None
    if request.method == "POST":
        company_name = request.POST.get("company_name", "").strip()
        contact_person_name = request.POST.get("contact_person_name", "").strip()
        contact_email = request.POST.get("contact_email", "").strip()
        contact_phone = request.POST.get("contact_phone", "").strip()
        # Basic validation
        if not company_name or not contact_person_name or not contact_email or not contact_phone:
            error = "All fields are required."
        elif '@' not in contact_email or len(contact_email) > 100:
            error = "Invalid email address."
        elif len(company_name) > 255 or len(contact_person_name) > 100:
            error = "Company or contact name too long."
        elif len(contact_phone) > 20:
            error = "Phone number too long."
        else:
            try:
                conn = DataOperations.get_db_connection()
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO customers (company_name, contact_person_name, contact_email, contact_phone)
                    VALUES (%s, %s, %s, %s)
                """, [company_name, contact_person_name, contact_email, contact_phone])
                conn.commit()
                message = f"Customer '{escape(company_name)}' created successfully!"
            except Exception as e:
                if 'Duplicate entry' in str(e):
                    error = "A customer with this company name or email/phone already exists."
                else:
                    error = f"Failed to create customer: {str(e)}"
            finally:
                if 'cursor' in locals():
                    cursor.close()
                if 'conn' in locals():
                    conn.close()
    return render(request, "create_customer.html", {
        "message": message,
        "error": error
    })



def view_edit_jds(request):
    """
    View to edit existing job descriptions.

    """

    print("view_edit_jds -> Request method:", request.method)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT jd_id, jd_summary, jd_status, no_of_positions, company_id, team_id, created_at
        FROM recruitment_jds
        ORDER BY created_at DESC
    """)
    jds = [
        {
            'jd_id': row[0],
            'jd_summary': row[1],
            'jd_status': row[2],
            'no_of_positions': row[3],
            'company_id': row[4],
            'team_id': row[5],
            'created_at': row[6]
        }
        for row in cursor.fetchall()
    ]
    # Fetch companies and teams for dropdowns
    cursor.execute("SELECT company_id, company_name FROM customers")
    companies = cursor.fetchall()
    cursor.execute("SELECT team_id, team_name FROM teams")
    teams = cursor.fetchall()
    name = request.session.get('name', 'Guest')
    return render(request, 'view_edit_jds.html', {
        'jds': jds,
        'name': name,
        'companies': companies,
        'teams': teams
    })

def get_jd(request, jd_id):
    """
    View to get details of a specific job description.
    """

    print("get_jd details-> Request method:", request.method)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT jd_id, jd_summary, jd_description, must_have_skills, good_to_have_skills,
               no_of_positions, jd_status, company_id, team_id, closure_date
        FROM recruitment_jds WHERE jd_id=%s
    """, [jd_id])
    row = cursor.fetchone()
    if not row:
        return JsonResponse({'error': 'JD not found'}, status=404)
    jd = {
        'jd_id': row[0],
        'jd_summary': row[1],
        'jd_description': row[2],
        'must_have_skills': row[3],
        'good_to_have_skills': row[4],
        'no_of_positions': row[5],
        'jd_status': row[6],
        'company_id': row[7],
        'team_id': row[8],
        'closure_date': row[9].isoformat() if row[9] else ''
    }
    return JsonResponse({'jd': jd})

@csrf_exempt
def update_jd(request, jd_id):
    """
    View to update an existing job description.
    """

    print("update_jd -> Request method:", request.method)
    if request.method == 'POST':
        data = json.loads(request.body)
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        print("update_jd -> Data received:", data)

        team_id = data['team_id'] if data['team_id'] not in ('', None) else None
        company_id = data['company_id'] if data['company_id'] not in ('', None) else None

        cursor.execute("""
            UPDATE recruitment_jds SET
                jd_summary=%s,
                jd_description=%s,
                must_have_skills=%s,
                good_to_have_skills=%s,
                no_of_positions=%s,
                jd_status=%s,
                company_id=%s,
                team_id=%s,
                closure_date=%s
            WHERE jd_id=%s
        """, [
            data['jd_summary'],
            data['jd_description'],
            data['must_have_skills'],
            data['good_to_have_skills'],
            data['no_of_positions'],
            data['jd_status'],
            company_id,
            team_id,
            data['closure_date'] if data['closure_date'] else None,
            jd_id
        ])
        conn.commit()

        # TO DO: Send notification to the members of team if jd is allocated to a team.

        cursor.close()
        conn.close()
        return JsonResponse({'success': True})
    return JsonResponse({'error': 'Invalid method'}, status=405)

def assign_jd_data(request):
    """
    View to get data for assigning job descriptions.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT jd_id, jd_summary, jd_status, no_of_positions, company_id
        FROM recruitment_jds
        ORDER BY created_at DESC
    """)
    jds = cursor.fetchall()
    cursor.execute("SELECT team_id, team_name FROM teams ORDER BY team_name")
    teams = cursor.fetchall()
    conn.close()
    return JsonResponse({"jds": jds, "teams": teams})

@csrf_exempt
def assign_jd(request):
    """
    View to assign a job description to a team.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Invalid method"}, status=405)
    data = json.loads(request.body)
    jd_id = data.get("jd_id")
    team_id = data.get("team_id")
    if not jd_id or not team_id:
        return JsonResponse({"error": "JD and Team required"}, status=400)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)  # <-- Use dictionary=True
    cursor.execute("UPDATE recruitment_jds SET team_id=%s WHERE jd_id=%s", [team_id, jd_id])
    conn.commit()
    cursor.execute("""
        SELECT j.jd_id, j.jd_summary, j.jd_status, j.no_of_positions, j.company_id, c.company_name
        FROM recruitment_jds j
        LEFT JOIN customers c ON j.company_id = c.company_id
        WHERE j.jd_id=%s
    """, [jd_id])
    jd = cursor.fetchone()
    cursor.execute("SELECT team_id, team_name FROM teams WHERE team_id=%s", [team_id])
    team = cursor.fetchone()
    cursor.execute("""
        SELECT m.first_name, m.last_name, m.email
        FROM hr_team_members m
        INNER JOIN team_members tm ON m.emp_id = tm.emp_id
        WHERE tm.team_id=%s
    """, [team_id])
    members = cursor.fetchall()

    # Send notifications to all team members about the JD assignment
    for member in members:
        user_id = DataOperations.get_user_id_from_emp_id(member['emp_id'])
        if user_id:
            MessageProviders.send_notification(user_id, "JD Assignment", f"A new JD has been assigned to your team: {jd['jd_summary']}", created_by="system", notification_type="JD Assignment")

    conn.close()
    return JsonResponse({"success": True, "jd": jd, "team": team, "members": members})

def assign_jd_page(request):
    """
    View to render the job description assignment page.
    """

    name = request.session.get('name', 'Guest')
    return render(request, "assign_jd.html",{'name': name})

def employee_view_page(request):
    """
    View to render the employee details page.
    """
    name = request.session.get('name', 'Guest')
    return render(request, "employee_view.html",{'name': name})

def employee_view_data(request):
    """
    API endpoint to get data for a specific employee.
    """
    print("employee_view_data -> Request method:", request.method)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT emp_id, first_name, last_name, email, role, status
        FROM hr_team_members
        WHERE status='active'
        ORDER BY first_name, last_name
    """)
    members = cursor.fetchall()
    conn.close()
    return JsonResponse({"members": members})

def employee_view_report(request):
    """
    API endpoint to get report data for a specific employee.
    """
    print("employee_view_report -> Request method:", request.method)
    emp_id = request.GET.get("emp_id")
    if not emp_id:
        return JsonResponse({"error": "emp_id required"}, status=400)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Member details
    cursor.execute("""
        SELECT emp_id, first_name, last_name, email, role, status
        FROM hr_team_members WHERE emp_id=%s
    """, [emp_id])
    member = cursor.fetchone()
    # JDs assigned to member (via team membership)
    cursor.execute("""
        SELECT j.jd_id, j.jd_summary, j.jd_status, t.team_name, c.company_name
        FROM recruitment_jds j
        LEFT JOIN teams t ON j.team_id = t.team_id
        LEFT JOIN customers c ON j.company_id = c.company_id
        WHERE j.team_id IN (
            SELECT team_id FROM team_members WHERE emp_id=%s
        )
        ORDER BY j.jd_status, j.created_at DESC
    """, [emp_id])
    jds = cursor.fetchall()
    # Teams member is part of, and JDs for each team
    cursor.execute("""
        SELECT t.team_id, t.team_name
        FROM teams t
        INNER JOIN team_members tm ON t.team_id = tm.team_id
        WHERE tm.emp_id=%s
        ORDER BY t.team_name
    """, [emp_id])
    teams = cursor.fetchall()
    for team in teams:
        cursor.execute("""
            SELECT j.jd_id, j.jd_summary, j.jd_status, c.company_name
            FROM recruitment_jds j
            LEFT JOIN customers c ON j.company_id = c.company_id
            WHERE j.team_id=%s
            ORDER BY j.jd_status, j.created_at DESC
        """, [team['team_id']])
        team['jds'] = cursor.fetchall()
    conn.close()
    return JsonResponse({"member": member, "jds": jds, "teams": teams})


def upload_resume_page(request):
    """
    View to render the resume upload page.
    """
    # Get all JDs for dropdown
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT jd.jd_id, jd.jd_summary, c.company_name
        FROM recruitment_jds jd
        LEFT JOIN customers c ON jd.company_id = c.company_id
        ORDER BY jd.jd_id DESC
    """)
    jds = cursor.fetchall()
    cursor.close()
    conn.close()
    name = request.session.get('name', 'Guest')
    return render(request, 'upload_resume.html', {'jds': jds,'name': name})

@csrf_exempt
def upload_resume(request):
    """
    API endpoint to upload a resume.
    """
    if request.method == 'POST':
        try:
            # Validate JD ID and file
            jd_id = request.POST.get('jd_id')
            resume_file = request.FILES.get('resume_file')
            if not jd_id:
                return JsonResponse({'success': False, 'error': 'JD ID is required.'}, status=400)
            if not resume_file:
                return JsonResponse({'success': False, 'error': 'Resume file is required.'}, status=400)

            # Check if JD exists
            conn = DataOperations.get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT company_id FROM recruitment_jds WHERE jd_id=%s", (jd_id,))
            jd_row = cursor.fetchone()
            if not jd_row:
                return JsonResponse({'success': False, 'error': 'Invalid JD ID.'}, status=404)
            customer_id = jd_row['company_id']

            # Validate file type
            allowed_extensions = ['pdf', 'doc', 'docx']
            file_extension = resume_file.name.split('.')[-1].lower()
            if file_extension not in allowed_extensions:
                return JsonResponse({'success': False, 'error': 'Invalid file type. Only PDF, DOC, and DOCX are allowed.'}, status=400)

            # Save file to the appropriate folder
            static_dir = settings.STATICFILES_DIRS[0] if hasattr(settings, 'STATICFILES_DIRS') else os.path.join(settings.BASE_DIR, 'static')
            base_folder = os.path.join(static_dir, 'resumes', jd_id, 'to_be_screened')
            os.makedirs(base_folder, exist_ok=True)
            file_name = resume_file.name
            file_path = os.path.join(base_folder, file_name)
            with open(file_path, 'wb+') as destination:
                for chunk in resume_file.chunks():
                    destination.write(chunk)

            # Save metadata in the database
            cursor.execute("""
                INSERT INTO resumes (jd_id, file_name, file_path, status, customer_id)
                VALUES (%s, %s, %s, %s, %s)
            """, (jd_id, file_name, file_path, 'toBeScreened', customer_id))
            conn.commit()
            resume_id = cursor.lastrowid
            # inclease the total_profiles count for the JD
            cursor.execute("""
                UPDATE recruitment_jds
                SET total_profiles = total_profiles + 1
                WHERE jd_id = %s
            """, (jd_id,))
            conn.commit()
            return JsonResponse({'success': True, 'resume_id': resume_id})

        except mysql.connector.Error as db_error:
            return JsonResponse({'success': False, 'error': f'Database error: {str(db_error)}'}, status=500)
        except Exception as e:
            return JsonResponse({'success': False, 'error': f'Unexpected error: {str(e)}'}, status=500)
        finally:
            if 'cursor' in locals():
                cursor.close()
            if 'conn' in locals():
                conn.close()

    return JsonResponse({'success': False, 'error': 'Invalid request method.'}, status=405)

def recent_resumes(request):
    """
    View to list recent resumes.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT r.resume_id, r.file_name, r.jd_id, jd.jd_summary, r.uploaded_on,
               c.company_name, r.status
        FROM resumes r
        LEFT JOIN recruitment_jds jd ON r.jd_id = jd.jd_id
        LEFT JOIN customers c ON r.customer_id = c.company_id
        ORDER BY r.uploaded_on DESC
        LIMIT 20
    """)
    resumes = []
    for row in cursor.fetchall():
        # Build file URL for static serving
        file_url = f"/static/resumes/{row['jd_id']}/{row['status']}/{row['file_name']}"
        resumes.append({
            'resume_id': row['resume_id'],
            'file_name': row['file_name'],
            'jd_id': row['jd_id'],
            'jd_summary': row['jd_summary'],
            'uploaded_on': row['uploaded_on'].strftime('%Y-%m-%d %H:%M'),
            'customer': row['company_name'] or '',
            'status': row['status'],
            'file_url': file_url
        })
    cursor.close()
    conn.close()
    return JsonResponse({'resumes': resumes})

def download_resume(request, resume_id):
    """
    View to download a specific resume.
    """
    # Connect to DB and fetch file path and name
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT file_path, file_name FROM resumes WHERE resume_id=%s", (resume_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        raise Http404("Resume not found")
    file_path = row['file_path']
    file_name = row['file_name']
    if not os.path.exists(file_path):
        raise Http404("File not found")
    return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=file_name)



def view_parse_resumes_page(request):
    """
    View to render the resume parsing page.
    """
    name = request.session.get('name', 'Guest')
    return render(request, 'view_parse_resumes.html', {'name': name})

@csrf_exempt
def view_parse_resumes(request):
    """
    API endpoint to parse resumes for a specific job description.
    """
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return JsonResponse({'success': False, 'error': 'JD ID required'}, status=400)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM resumes WHERE jd_id=%s", (jd_id,))
    resumes = cursor.fetchall()
    parsed_resumes = []
    for r in resumes:
        file_path = r['file_path']
        if not os.path.exists(file_path):
            continue
        try:
            text = textract.process(file_path).decode('utf-8')
            # Simple parsing logic (use regex for better extraction)
            import re
            name = re.search(r'Name[:\- ]*(.*)', text)
            email = re.search(r'[\w\.-]+@[\w\.-]+', text)
            phone = re.search(r'(\+?\d{10,13})', text)
            experience = re.search(r'Experience[:\- ]*(.*)', text)
            summary = text[:300]  # First 300 chars as summary
            parsed_resumes.append({
                'resume_id': r['resume_id'],
                'file_name': r['file_name'],
                'name': name.group(1) if name else '',
                'email': email.group(0) if email else '',
                'phone': phone.group(1) if phone else '',
                'experience': experience.group(1) if experience else '',
                'summary': summary,
                'status': r['status'],
                'file_url': f"/download_resume/{r['resume_id']}/"
            })
        except Exception as e:
            parsed_resumes.append({
                'resume_id': r['resume_id'],
                'file_name': r['file_name'],
                'error': str(e),
                'status': r['status'],
                'file_url': f"/download_resume/{r['resume_id']}/"
            })
    cursor.close()
    conn.close()
    return JsonResponse({'success': True, 'resumes': parsed_resumes})

@csrf_exempt
def update_resume_status(request):
    """
    API endpoint to update the status of a resume.
    """
    print("update_resume_status -> Request method:", request.method)
    if request.method == 'POST':
        resume_id = request.POST.get('resume_id')
        status = request.POST.get('status')
        if not resume_id or status not in ['selected', 'rejected']:
            return JsonResponse({'success': False, 'error': 'Invalid input'}, status=400)
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE resumes SET status=%s WHERE resume_id=%s", (status, resume_id))
        conn.commit()
        cursor.close()
        conn.close()
        return JsonResponse({'success': True})
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

import openpyxl
from openpyxl.utils import get_column_letter
from django.http import HttpResponse

def export_resumes_excel(request):
    """
    API endpoint to export resumes to an Excel file.
    """
    print("export_resumes_excel -> Request method:", request.method)
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return HttpResponse("JD ID required", status=400)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT r.file_name, r.status, r.uploaded_on, jd.jd_summary, c.company_name
        FROM resumes r
        LEFT JOIN recruitment_jds jd ON r.jd_id = jd.jd_id
        LEFT JOIN customers c ON r.customer_id = c.company_id
        WHERE r.jd_id = %s
        ORDER BY r.uploaded_on DESC
    """, (jd_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Resumes"
    headers = ["File Name", "Status", "Uploaded On", "JD Summary", "Company"]
    ws.append(headers)
    for row in rows:
        ws.append([
            row['file_name'],
            row['status'],
            row['uploaded_on'].strftime('%Y-%m-%d %H:%M') if row['uploaded_on'] else '',
            row['jd_summary'],
            row['company_name']
        ])
    for col in range(1, len(headers)+1):
        ws.column_dimensions[get_column_letter(col)].width = 22

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename="resumes_{jd_id}.xlsx"'
    wb.save(response)
    return response

@csrf_exempt
def parse_resumes(request):
    """
    API endpoint to parse resumes for a specific job description.
    """
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return JsonResponse({'success': False, 'error': 'JD ID required'}, status=400)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM resumes WHERE jd_id=%s", (jd_id,))
    resumes = cursor.fetchall()
    parser = ResumeParser()
    parsed_resumes = []
    for r in resumes:
        file_path = r['file_path']
        if not os.path.exists(file_path):
            continue
        try:
            result = parser.parse_resume(file_path)
            parsed_resumes.append({
                'resume_id': r['resume_id'],
                'file_name': r['file_name'],
                'name': result.get('Name', ''),
                'email': result.get('Email', ''),
                'phone': result.get('Contact Number', ''),
                'experience': result.get('Work Experience (Years)', ''),
                'status': r['status'],
                'file_url': f"/download_resume/{r['resume_id']}/"
            })
        except Exception as e:
            parsed_resumes.append({
                'resume_id': r['resume_id'],
                'file_name': r['file_name'],
                'error': str(e),
                'status': r['status'],
                'file_url': f"/download_resume/{r['resume_id']}/"
            })
    cursor.close()
    conn.close()
    print("parse_resumes -> Parsed resumes:", parsed_resumes)
    if not parsed_resumes:
        return JsonResponse({'success': False, 'error': 'No resumes found for this JD'}, status=404)
    return JsonResponse({'success': True, 'resumes': parsed_resumes})

@csrf_exempt
def save_candidate_details(request):
    """
    API endpoint to save candidate details.
    """
    if request.method == 'POST':
        data = json.loads(request.body)
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        try:
            # Always fetch after SELECT
            cursor.execute("SELECT candidate_id FROM candidates WHERE resume_id=%s", [data.get('resume_id')])
            _ = cursor.fetchall()  # Fetch all results, even if you only need one

            if _:
                cursor.execute("""
                    UPDATE candidates
                    SET name=%s, phone=%s, email=%s, skills=%s, experience=%s,
                        screened_on=%s, screen_status=%s, screened_remarks=%s,
                        team_id=%s, hr_member_id=%s, updated_at=NOW()
                    WHERE resume_id=%s
                """, [
                    data.get('name'), data.get('phone'), data.get('email'),
                    data.get('skills'), data.get('experience'), data.get('screened_on'),
                    data.get('screen_status'), data.get('screened_remarks'),
                    data.get('screening_team'), data.get('hr_member_id'),
                    data.get('resume_id')
                ])
            else:
                cursor.execute("""
                    INSERT INTO candidates (jd_id, resume_id, name, phone, email, skills,
                    experience, screened_on, screen_status, screened_remarks, team_id, hr_member_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, [
                    data.get('jd_id'), data.get('resume_id'), data.get('name'), data.get('phone'),
                    data.get('email'), data.get('skills'), data.get('experience'), data.get('screened_on'),
                    data.get('screen_status'), data.get('screened_remarks'),
                    data.get('screening_team'), data.get('hr_member_id')
                ])

            conn.commit()
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
        finally:
            cursor.close()
            conn.close()
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

@csrf_exempt
def update_candidate_screen_status(request):
    """
    API endpoint to update the screening status of a candidate.
    """
    if request.method == 'POST':
        resume_id = request.POST.get('resume_id')
        status = request.POST.get('status')
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE candidates SET screen_status=%s WHERE resume_id=%s
        """, (status, resume_id))
        conn.commit()
        cursor.close()
        conn.close()
        return JsonResponse({'success': True})
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

def get_jd_team_members(request):
    """
    API endpoint to get team members for a specific job description.
    """
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return JsonResponse({'success': False, 'error': 'JD ID required'}, status=400)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT team_id FROM recruitment_jds WHERE jd_id=%s", (jd_id,))
    jd_row = cursor.fetchone()
    if not jd_row or not jd_row['team_id']:
        cursor.close()
        conn.close()
        return JsonResponse({'success': True, 'team_id': None, 'team_name': '', 'members': []})
    team_id = jd_row['team_id']
    cursor.execute("SELECT team_name FROM teams WHERE team_id=%s", (team_id,))
    team_row = cursor.fetchone()
    team_name = team_row['team_name'] if team_row else ''
    cursor.execute("""
        SELECT m.emp_id, m.first_name, m.last_name, m.email
        FROM hr_team_members m
        INNER JOIN team_members tm ON m.emp_id = tm.emp_id
        WHERE tm.team_id = %s AND m.status='active'
        ORDER BY m.first_name, m.last_name
    """, (team_id,))
    members = cursor.fetchall()
    cursor.close()
    conn.close()
    return JsonResponse({'success': True, 'team_id': team_id, 'team_name': team_name, 'members': members})

from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse

@csrf_exempt
def get_candidate_details(request):
    """
    API endpoint to get details of a specific candidate.
    """
    print("get_candidate_details -> Request method:", request.method)
    resume_id = request.GET.get('resume_id')
    if not resume_id:
        return JsonResponse({'success': False, 'error': 'resume_id required'}, status=400)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM candidates WHERE resume_id=%s ORDER BY candidate_id DESC LIMIT 1", (resume_id,))
    candidate = cursor.fetchone()
    cursor.close()
    conn.close()
    return JsonResponse({'success': True, 'candidate': candidate})

# views.py

def schedule_interviews_page(request):
    """
    View to render the schedule interviews page.
    """
    return render(request, 'schedule_interviews.html')

def get_candidates_for_jd(request):
    """
    API endpoint to get candidates for a specific job description.
    """
    print("get_candidates_for_jd -> Request method:", request.method)
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return JsonResponse({'success': False, 'error': 'JD ID required'}, status=400)

    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # First check if there are any candidates at all for this JD
        cursor.execute("SELECT COUNT(*) as total_count FROM candidates WHERE jd_id = %s", (jd_id,))
        total_count = cursor.fetchone()['total_count']

        # Then check how many are selected
        cursor.execute("SELECT COUNT(*) as selected_count FROM candidates WHERE jd_id = %s AND screen_status = 'selected'", (jd_id,))
        selected_count = cursor.fetchone()['selected_count']

        # Now get only the selected candidates
        cursor.execute("""
            SELECT c.*, r.status as resume_status
            FROM candidates c
            JOIN resumes r ON c.resume_id = r.resume_id
            WHERE c.jd_id = %s AND c.screen_status = 'selected'
            ORDER BY c.name
        """, (jd_id,))
        candidates = cursor.fetchall()

        # Prepare meaningful message based on counts
        message = ""
        if total_count == 0:
            message = "No selected candidates found for this JD."
        elif selected_count == 0:
            message = f"Found {total_count} candidates for this JD, but none have been Screened OK for interviews yet."

        return JsonResponse({
            'success': True,
            'candidates': candidates,
            'total_count': total_count,
            'selected_count': selected_count,
            'message': message
        })
    except Exception as e:
        print(f"get_candidates_for_jd -> Error: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    finally:
        cursor.close()
        conn.close()

@csrf_exempt
def schedule_interview(request):
    """
    API endpoint to schedule an interview.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)
        
    session = request.session
    # get user_id and email from session
    user_email = session.get('email')

    if not user_email:
        return redirect('login')

    try:
        data = json.loads(request.body)
        candidate_id = data.get('candidate_id')
        level = data.get('level')
        date = data.get('date')
        time = data.get('time')
        interviewer_name = data.get('interviewer_name')
        interviewer_email = data.get('interviewer_email')

        # Validate required fields
        if not all([candidate_id, level, date, time, interviewer_name, interviewer_email]):
            return JsonResponse({'success': False, 'error': 'All fields are required'}, status=400)

        # Get candidate info for calendar invite
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT c.candidate_id, c.name, c.email, c.jd_id, r.jd_summary
            FROM candidates c
            JOIN recruitment_jds r ON c.jd_id = r.jd_id
            WHERE c.candidate_id = %s
        """, (candidate_id,))
        candidate = cursor.fetchone()

        if not candidate:
            return JsonResponse({'success': False, 'error': 'Candidate not found'}, status=404)

        # Update candidate record with interview details
        cursor.execute(f"""
            UPDATE candidates 
            SET 
                {level}_date = %s,
                {level}_result = 'toBeScreened',
                {level}_interviewer_name = %s,
                {level}_interviewer_email = %s,
                updated_at = NOW()
            WHERE candidate_id = %s
        """, (date, interviewer_name, interviewer_email, candidate_id))

        conn.commit()
        user = request.user
        token = f"{candidate_id}-{level}-{int(datetime.now().timestamp())}"  # Simple token
        if send_interview_result_email(
            hr_email=user_email, # if request.user.is_authenticated else 'hr@yourdomain.com',
            interviewer_email=interviewer_email,
            candidate_id = candidate_id,
            interviewer_name=interviewer_name,
            candidate=candidate,
            level=level,
            token=token
        ):
            
            # TO DO: If necessary, need to send notification to team leads.

            return JsonResponse({
                'success': True,
                'message': 'Interview scheduled successfully'
            })
        else:
            return JsonResponse({'success': False, 'error': 'Failed to send interview result email'}, status=500)

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

def send_interview_result_email(hr_email, interviewer_email, candidate_id, interviewer_name, candidate, level, token):
    """
    Send email to interviewer with candidate details and interview result link.
    """
    print("send_interview_result_email -> Sending email to interviewer:", interviewer_email)
    print("send_interview_result_email -> Candidate details:", candidate, "candidiate id:", candidate_id)
    print("HR email:", hr_email)
    base_url = "http://127.0.0.1:8000"
    subject = f"Action Required: Record Interview Result for {candidate['name']} ({level.upper()})"
    result_url = f"{base_url}/record_interview_result/?candidate_id={candidate['candidate_id']}&level={level}&token={token}"
    html_content = render_to_string('interview_result_request.html', {
        'interviewer_name': interviewer_name,
        'candidate': candidate,
        'level': level.upper(),
        'result_url': result_url,
        'hr_email': hr_email,
    })

    # Fetch email config for hr_email
    from .utils import decrypt_password
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT email, email_smtp_host, email_smtp_port, email_host_password FROM email_config WHERE email=%s", (hr_email,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        print(f"send_interview_result_email -> No email config found for {hr_email}")
        return False
    app_password = decrypt_password(row['email_host_password'])
    from_email = row['email']
    smtp_host = row['email_smtp_host']
    smtp_port = row['email_smtp_port']

    # Use send_email utility
    result = MessageProviders.send_email(
        from_email=from_email,
        app_password=app_password,
        to_email=interviewer_email,
        subject=subject,
        html_body=html_content,
        smtp_host=smtp_host,
        smtp_port=smtp_port
    )

    if result:
        print("send_interview_result_email -> Email sent successfully")
    else:
        print("send_interview_result_email -> Failed to send email")
    return result

def record_interview_result_page(request):
    """
    View to render the record interview result page.
    """
    candidate_id = request.GET.get('candidate_id')
    level = request.GET.get('level')
    token = request.GET.get('token')
    # Optionally validate token here
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM candidates WHERE candidate_id=%s", (candidate_id,))
    candidate = cursor.fetchone()
    cursor.close()
    conn.close()
    if not candidate:
        return render(request, 'record_interview_result.html', {'error': 'Candidate not found'})
    return render(request, 'record_interview_result.html', {
        'candidate': candidate,
        'level': level,
        'token': token
    })

@csrf_exempt
def submit_interview_result(request):
    """
    API endpoint to submit interview results.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)
    data = json.loads(request.body)
    candidate_id = data.get('candidate_id')
    level = data.get('level')
    result = data.get('result')
    comments = data.get('comments')
    token = data.get('token')
    # Optionally validate token here
    if not all([candidate_id, level, result]):
        return JsonResponse({'success': False, 'error': 'Missing fields'}, status=400)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"""
        UPDATE candidates
        SET {level}_result = %s, {level}_comments = %s, updated_at = NOW()
        WHERE candidate_id = %s
    """, (result, comments, candidate_id))
    conn.commit()
    cursor.close()
    conn.close()

    # TO DO: If necessary, need to send notification to team leads.

    return JsonResponse({'success': True})

from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse

def manage_candidate_status_page(request):
    """
    View to render the manage candidate status page.
    """
    return render(request, "manage_candidate_status.html")

def manage_candidate_status_data(request):
    """
    API endpoint to get candidate status data.
    """
    search = request.GET.get("search", "")
    page = int(request.GET.get("page", 1))
    limit = 10
    offset = (page - 1) * limit
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT c.*, jd.jd_summary
        FROM candidates c
        LEFT JOIN recruitment_jds jd ON c.jd_id = jd.jd_id
        WHERE c.screen_status = 'selected'
    """
    params = []
    if search:
        query += " AND (c.name LIKE %s OR c.email LIKE %s OR jd.jd_summary LIKE %s)"
        params = [f"%{search}%", f"%{search}%", f"%{search}%"]
    query += " ORDER BY c.updated_at DESC LIMIT %s OFFSET %s"
    params += [limit, offset]
    cursor.execute(query, params)
    candidates = cursor.fetchall()
    cursor.execute("SELECT COUNT(*) as total FROM candidates WHERE screen_status = 'selected'" + (" AND (name LIKE %s OR email LIKE %s OR jd_id LIKE %s)" if search else ""), params[:3] if search else [])
    total = cursor.fetchone()['total']
    num_pages = (total // limit) + (1 if total % limit else 0)
    cursor.close()
    conn.close()
    return JsonResponse({
        "candidates": candidates,
        "page": page,
        "num_pages": num_pages
    })

@csrf_exempt
def update_candidate_status(request):
    """
    API endpoint to update the status of a candidate.
    """
    print("update_candidate_status -> Request method:", request.method)
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Invalid method"}, status=405)
    data = json.loads(request.body)
    candidate_id = data.get("candidate_id")
    l1_result = data.get("l1_result")
    l2_result = data.get("l2_result")
    l3_result = data.get("l3_result")
    if not candidate_id:
        return JsonResponse({"success": False, "error": "Candidate ID required"}, status=400)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            UPDATE candidates
            SET l1_result=%s, l2_result=%s, l3_result=%s, updated_at=NOW()
            WHERE candidate_id=%s
        """, [l1_result, l2_result, l3_result, candidate_id])
        conn.commit()

        # TO DO: Send notification to team lead if any candidate is finallized.(means, selected for all levels)
        cursor.execute("SELECT name, team_id, hr_member_id FROM candidates WHERE candidate_id=%s", [candidate_id])
        candidate_data = cursor.fetchone()
        print("Candidate data for notification:", candidate_data)
        if candidate_data:
            team_id = candidate_data['team_id']
            hr_member_id = candidate_data['hr_member_id']
            hr_user_id = DataOperations.get_user_id_from_emp_id(hr_member_id)
            if hr_user_id:
                MessageProviders.send_notification(
                    user_id=hr_user_id,
                    title="Candidate Status Updated",
                    message=f"Candidate {candidate_data['name']}'s status has been updated."
                )
            cursor.execute("SELECT lead_emp_id FROM teams WHERE team_id=%s", [team_id])
            team_row = cursor.fetchone()
            if team_row:
                lead_emp_id = team_row['lead_emp_id']
                lead_user_id = DataOperations.get_user_id_from_emp_id(lead_emp_id)
                if lead_user_id:
                    MessageProviders.send_notification(
                        user_id=lead_user_id,
                        title="Candidate Status Updated",
                        message=f"Candidate {candidate_data['name']}'s status has been updated.",
                        notification_type="status_update"
                    )
        return JsonResponse({"success": True})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)
    finally:
        cursor.close()
        conn.close()

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

def view_finalized_candidates(request):
    """
    View to render the finalized candidates page.
    """
    print("view_finalized_candidates -> Request method:", request.method)
    name = request.session.get('name', 'Guest')
    return render(request, 'view_finalized_candidates.html', {'name': name})

def api_jds(request):
    """
    API endpoint to get job descriptions.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT jd_id, jd_summary FROM recruitment_jds WHERE jd_status='active'")
    jds = cursor.fetchall()
    cursor.close()
    conn.close()
    return JsonResponse({'jds': jds})

def api_finalized_candidates(request):
    """
    API endpoint to get finalized candidates for a specific job description.
    """
    jd_id = request.GET.get('jd_id')
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT candidate_id, name, email, phone, experience
        FROM candidates
        WHERE jd_id=%s AND l3_result='selected'
        ORDER BY updated_at DESC
    """, (jd_id,))
    candidates = cursor.fetchall()
    cursor.close()
    conn.close()
    return JsonResponse({'candidates': candidates})

def api_candidate_details(request):
    """
    API endpoint to get details of a specific candidate.
    """
    candidate_id = request.GET.get('candidate_id')
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM candidates WHERE candidate_id=%s", (candidate_id,))
    candidate = cursor.fetchone()
    cursor.close()
    conn.close()
    return JsonResponse({'details': candidate})

def logout_page(request):
    """
    View to render the logout page.
    """
    session_id = request.session.get('session_id')
    if session_id:
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_sessions WHERE session_id=%s", (session_id,))
        conn.commit()
        cursor.close()
        conn.close()
    logout(request)  # This logs out the user
    return render(request, 'logout.html')

def candidate_profile(request):
    """
    View to render the candidate profile page.
    """
    name = request.session.get('name', 'Guest')
    """Render the Candidate Profile page."""
    return render(request, 'candidate_profile.html', {'name': name})

@csrf_exempt
def get_candidate_details_profile(request):
    """Fetch candidate details based on name or email using raw SQL."""
    if request.method == 'GET':
        search_query = request.GET.get('query', '').strip()
        print("get_candidate_details -> Search query:", search_query)
        if search_query:
            conn = DataOperations.get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT candidate_id, name, email, phone, skills, experience, screened_remarks,
                       l1_comments, l2_comments, l3_comments, screen_status
                FROM candidates
                WHERE email LIKE %s OR name LIKE %s
                LIMIT 1
            """, [f"%{search_query}%", f"%{search_query}%"])
            candidate = cursor.fetchone()
            print("get_candidate_details -> Candidate found:", candidate)
            if candidate:
                return JsonResponse({
                    'success': True,
                    'data': {
                        'candidate_id': candidate['candidate_id'],
                        'name': candidate['name'],
                        'email': candidate['email'],
                        'phone': candidate['phone'],
                        'skills': candidate['skills'],
                        'experience': candidate['experience'],
                        'screened_remarks': candidate['screened_remarks'],
                        'l1_comments': candidate['l1_comments'],
                        'l2_comments': candidate['l2_comments'],
                        'l3_comments': candidate['l3_comments'],
                        'status': candidate['screen_status'],
                    }
                })
        return JsonResponse({'success': False, 'message': 'Candidate not found.'})

def save_candidate_details_profile(request):
    """Save updated candidate details using raw SQL."""
    if request.method == 'POST':
        candidate_id = request.POST.get('candidate_id')
        screened_remarks = request.POST.get('screened_remarks', '')
        l1_comments = request.POST.get('l1_comments', '')
        l2_comments = request.POST.get('l2_comments', '')
        l3_comments = request.POST.get('l3_comments', '')
        status = request.POST.get('status', '')

        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            UPDATE candidates
            SET screened_remarks = %s, l1_comments = %s, l2_comments = %s, l3_comments = %s, screen_status = %s
            WHERE candidate_id = %s
        """, [screened_remarks, l1_comments, l2_comments, l3_comments, status, candidate_id])
        return JsonResponse({'success': True, 'message': 'Candidate details updated successfully.'})
    return JsonResponse({'success': False, 'message': 'Invalid request method.'})


@csrf_exempt
def candidate_suggestions(request):
    """
    API endpoint to get candidate suggestions based on a search query.
    """
    if request.method == 'GET':
        query = request.GET.get('q', '').strip()
        if len(query) < 3:
            return JsonResponse({'results': []})
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT candidate_id, name, email
            FROM candidates
            WHERE name LIKE %s OR email LIKE %s
            LIMIT 8
        """, [f"%{query}%", f"%{query}%"])
        results = cursor.fetchall()
        return JsonResponse({'results': results})
    return JsonResponse({'results': []})

from django.shortcuts import render
from django.http import JsonResponse
import mysql.connector
from datetime import datetime, timedelta

def dashboard_data(request):
    """
    API endpoint to get dashboard data for the logged-in user.
    """
    email = request.session['email'] if 'email' in request.session else None
    print("dashboard_data -> User email:", email)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Get emp_id for logged-in HR member
    cursor.execute("SELECT emp_id FROM hr_team_members WHERE email=%s", (email,))
    emp_row = cursor.fetchone()
    emp_id = emp_row['emp_id'] if emp_row else None
    print("dashboard_data -> Employee ID:", emp_id)
    # Pending/Active JDs assigned to user via team membership
    # Python
    # Logic Fault @1627
    cursor.execute("""
        SELECT 
            r.jd_id, 
            r.jd_summary, 
            r.jd_status, 
            cu.company_name,
            COUNT(CASE WHEN (c.l3_result IS NULL OR c.l3_result != 'selected') AND (c.l3_result != 'rejected' AND c.l2_result != 'rejected' AND c.l1_result != 'rejected' AND c.screen_status != 'rejected') THEN 1 END) AS not_finalized_count
        FROM recruitment_jds r
        JOIN customers cu ON r.company_id = cu.company_id
        JOIN candidates c ON r.jd_id = c.jd_id
        WHERE c.hr_member_id = %s AND r.jd_status = 'active'
        GROUP BY r.jd_id, r.jd_summary, r.jd_status, cu.company_name
        ORDER BY r.jd_id DESC
    """, (emp_id,))

    pending_jds = cursor.fetchall()
    print("dashboard_data -> Pending JDs:", pending_jds)

    # Monthly closed JDs and candidates (last 6 months)
    monthly_report = []
    for i in range(6, 0, -1):
        month_start = (datetime.now().replace(day=1) - timedelta(days=30*i)).replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        cursor.execute("""
            SELECT COUNT(DISTINCT r.jd_id) AS closed_jds
            FROM recruitment_jds r
            JOIN candidates c ON r.jd_id = c.jd_id
            WHERE c.hr_member_id = %s AND r.jd_status = 'closed'
            AND r.closure_date BETWEEN %s AND %s
        """, (emp_id, month_start.date(), month_end.date()))
        closed_jds = cursor.fetchone()['closed_jds'] or 0

        cursor.execute("""
            SELECT COUNT(*) AS candidates
            FROM candidates
            WHERE hr_member_id = %s AND screen_status = 'selected'
            AND l1_result = 'selected'
            AND l3_result = 'selected'
            AND created_at BETWEEN %s AND %s
        """, (emp_id, month_start.date(), month_end.date()))
        candidates = cursor.fetchone()['candidates'] or 0

        monthly_report.append({
            "month": month_start.strftime("%b %Y"),
            "closed_jds": closed_jds,
            "candidates": candidates
        })

    # Pie chart: active JDs by customer
    cursor.execute("""
        SELECT cu.company_name, COUNT(DISTINCT r.jd_id) AS jd_count
        FROM recruitment_jds r
        JOIN customers cu ON r.company_id = cu.company_id
        JOIN candidates c ON r.jd_id = c.jd_id
        WHERE c.hr_member_id = %s AND r.jd_status = 'active'
        GROUP BY cu.company_name
    """, (emp_id,))
    pie_rows = cursor.fetchall()

    customer_pie = {
        "labels": [row['company_name'] for row in pie_rows],
        "data": [row['jd_count'] for row in pie_rows]
    }

    # Bar chart: closed JDs in last 6 months
    bar_labels = [row['month'] for row in monthly_report]
    bar_data = [row['closed_jds'] for row in monthly_report]
    closed_jds_bar = {
        "labels": bar_labels,
        "data": bar_data
    }
    # In Progress Candidates
    cursor.execute("""
            SELECT 
                c.candidate_id,
                c.name,
                c.jd_id,
                c.l1_result,
                c.l2_result,
                c.l3_result,
                cu.company_name,
                t.team_name
            FROM candidates c
            LEFT JOIN recruitment_jds r ON c.jd_id = r.jd_id
            LEFT JOIN customers cu ON r.company_id = cu.company_id
            LEFT JOIN teams t ON c.team_id = t.team_id
            WHERE c.hr_member_id = %s
              AND r.jd_status = 'active'
              AND (c.screen_status IN ('toBeScreened', 'onHold', 'selected'))
              AND (c.l3_result IS NULL OR c.l3_result != 'selected')
            ORDER BY c.updated_at DESC
            LIMIT 30
        """, (emp_id,))
    in_progress_candidates = cursor.fetchall()

    cursor.close()
    conn.close()

    return JsonResponse({
        "pending_jds": pending_jds,
        "monthly_report": monthly_report,
        "customer_pie": customer_pie,
        "closed_jds_bar": closed_jds_bar,
        "in_progress_candidates": in_progress_candidates
    })

# Python
from django.shortcuts import render
from django.http import JsonResponse
import json

def offer_letter_page(request):
    """
    View to render the offer letter page.
    """
    name = request.session.get('name', 'Guest')
    return render(request, 'offer_letter.html', {'name': name})

from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def generate_offer_letter(request):
    """
    API endpoint to generate an offer letter.
    """
    if request.method == 'POST':
        data = json.loads(request.body)
        candidate_id = data.get('candidate_id')
        basic = float(data.get('basic', 0))
        hra = float(data.get('hra', 0))
        special_allowance = float(data.get('special_allowance', 0))
        pf = float(data.get('pf', 0))
        gratuity = float(data.get('gratuity', 0))
        bonus = float(data.get('bonus', 0))
        other = float(data.get('other', 0))
        total_ctc = sum([basic, hra, special_allowance, pf, gratuity, bonus, other])

        # Save to DB
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO offer_letters (candidate_id, basic, hra, special_allowance, pf, gratuity, bonus, other, total_ctc)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [candidate_id, basic, hra, special_allowance, pf, gratuity, bonus, other, total_ctc])
        conn.commit()
        cursor.close()
        conn.close()

        # Generate offer letter HTML
        offer_html = f"""
        <div class='offer-letter'>
            <h2>Offer Letter</h2>
            <p>Candidate ID: {candidate_id}</p>
            <table class='salary-stack'>
                <tr><th>Component</th><th>Amount (INR)</th></tr>
                <tr><td>Basic</td><td>{basic:.2f}</td></tr>
                <tr><td>HRA</td><td>{hra:.2f}</td></tr>
                <tr><td>Special Allowance</td><td>{special_allowance:.2f}</td></tr>
                <tr><td>PF</td><td>{pf:.2f}</td></tr>
                <tr><td>Gratuity</td><td>{gratuity:.2f}</td></tr>
                <tr><td>Bonus</td><td>{bonus:.2f}</td></tr>
                <tr><td>Other</td><td>{other:.2f}</td></tr>
                <tr class='total'><td>Total CTC</td><td>{total_ctc:.2f}</td></tr>
            </table>
            <p>Congratulations! Please find your salary stack above.</p>
        </div>
        """
        
        # TO DO: send notification  to team lead about offere letter generated to candidate and Customer
        return JsonResponse({'success': True, 'offer_html': offer_html})
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
import mysql.connector
import csv
from datetime import datetime, timedelta

def teams_list(request):
    """
    API endpoint to get the list of teams.
    """
    print("teams_list -> Request method:", request.method)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT team_id, team_name FROM teams")
    teams = [{"id": row['team_id'], "name": row['team_name']} for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    print("teams_list -> Teams fetched:", teams)
    return JsonResponse({"teams": teams})

def teams_filters(request):
    """
    API endpoint to get filters for teams.
    """
    print("teams_filters -> Request method:", request.method)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT emp_id, first_name, last_name FROM hr_team_members WHERE status='active'")
    members = [{"id": row['emp_id'], "name": f"{row['first_name']} {row['last_name']}"} for row in cursor.fetchall()]
    cursor.execute("SELECT company_id, company_name FROM customers")
    # Python
    customers = [{"id": row["company_id"], "name": row["company_name"]} for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return JsonResponse({"members": members, "customers": customers})

def team_reports_page(request):
    """
    View to render the team reports page.
    """
    name = request.session.get('name', 'Guest')
    return render(request, 'team_reports.html', {'name': name})

def team_report_filters(request):
    """
    API endpoint to get filters for team reports.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT emp_id, first_name, last_name FROM hr_team_members WHERE status='active'")
    members = [{'id': m['emp_id'], 'name': f"{m['first_name']} {m['last_name']}"} for m in cursor.fetchall()]
    cursor.execute("SELECT company_id, company_name FROM customers")
    customers = [{'id': c['company_id'], 'name': c['company_name']} for c in cursor.fetchall()]
    cursor.close()
    conn.close()
    return JsonResponse({'members': members, 'customers': customers})

@csrf_exempt
def team_report(request):
    """
    API endpoint to get team report data.
    """
    print("team_reports_api -> Request method:", request.method)
    if request.method != "POST":
        return JsonResponse({}, status=400)
    params = json.loads(request.body)
    db = ATSDatabaseInitializer()
    db.cursor.execute("USE ats")
    # --- Team Overview ---
    team_name = params.get("team_search", "")
    overview_sql = """
        SELECT t.team_name, m.first_name, m.last_name,
            GROUP_CONCAT(tm2.first_name, ' ', tm2.last_name)
        FROM teams t
        LEFT JOIN hr_team_members m ON t.lead_emp_id = m.emp_id
        LEFT JOIN team_members tm ON t.team_id = tm.team_id
        LEFT JOIN hr_team_members tm2 ON tm.emp_id = tm2.emp_id
        WHERE (%s = '' OR t.team_name = %s)
        GROUP BY t.team_id
    """
    db.cursor.execute(overview_sql, (team_name, team_name))
    team_overview = []
    for row in db.cursor.fetchall():
        team_overview.append({
            "team_name": row[0],
            "team_lead": f"{row[1]} {row[2]}" if row[1] else "",
            "members": row[3].split(",") if row[3] else []
        })
    # --- Recruitment Metrics ---
    jd_status = params.get("jd_status", "")
    metrics_sql = """
        SELECT COUNT(jd_id), 
            SUM(jd_status='active'), 
            SUM(jd_status='closed'), 
            AVG(DATEDIFF(closure_date, created_at))
        FROM recruitment_jds
        WHERE (%s = '' OR jd_status = %s)
        AND (%s = '' OR team_id IN (SELECT team_id FROM teams WHERE team_name = %s))
    """
    db.cursor.execute(metrics_sql, (jd_status, jd_status, team_name, team_name))
    row = db.cursor.fetchone()
    recruitment_metrics = [{
        "total_jds": row[0] or 0,
        "in_progress": row[1] or 0,
        "closed": row[2] or 0,
        "avg_closure_time": float(row[3]) if row[3] else 0
    }]
    # --- Candidate Pipeline ---
    pipeline_sql = """
        SELECT 
            SUM(screen_status='toBeScreened'), 
            SUM(l1_result='selected'), 
            SUM(l2_result='selected'), 
            SUM(l3_result='selected'), 
            SUM(offer_status='released'), 
            SUM(offer_status='accepted'), 
            SUM(screen_status='rejected')
        FROM candidates
        WHERE (%s = '' OR team_id IN (SELECT team_id FROM teams WHERE team_name = %s))
    """
    db.cursor.execute(pipeline_sql, (team_name, team_name))
    row = db.cursor.fetchone()
    candidate_pipeline = [{
        "sourced": row[0] or 0,
        "l1": row[1] or 0,
        "l2": row[2] or 0,
        "l3": row[3] or 0,
        "offered": row[4] or 0,
        "accepted": row[5] or 0,
        "rejected": row[6] or 0
    }]
    # Performance Analytics
    offered = int(row[4] or 0)
    accepted = int(row[5] or 0)
    sourced = int(row[0] or 0)
    conversion_rate = round((offered / sourced) * 100, 2) if sourced else 0
    success_rate = round((accepted / offered) * 100, 2) if offered else 0
    monthly_trends = {'labels': [], 'values': []}
    for i in range(6, 0, -1):
        month_start = (datetime.now().replace(day=1) - timedelta(days=30 * i))
        month_end = (datetime.now().replace(day=1) - timedelta(days=30 * (i - 1)))
        db.cursor.execute("SELECT COUNT(*) as cnt FROM recruitment_jds WHERE jd_status='closed' AND closure_date >= %s AND closure_date < %s", (month_start.date(), month_end.date()))
        count = int(db.cursor.fetchone()[0])
        monthly_trends['labels'].append(month_start.strftime('%b %Y'))
        monthly_trends['values'].append(count)

    # --- Member Contribution ---
    member_sql = """
        SELECT m.first_name, m.last_name,
            COUNT(DISTINCT j.jd_id), COUNT(c.candidate_id),
            SUM(offer_status='released')
        FROM hr_team_members m
        LEFT JOIN team_members tm ON m.emp_id = tm.emp_id
        LEFT JOIN teams t ON tm.team_id = t.team_id
        LEFT JOIN recruitment_jds j ON t.team_id = j.team_id
        LEFT JOIN candidates c ON j.jd_id = c.jd_id AND c.hr_member_id = m.emp_id
        WHERE (%s = '' OR t.team_name = %s)
        GROUP BY m.emp_id
    """
    db.cursor.execute(member_sql, (team_name, team_name))
    member_contribution = []
    for row in db.cursor.fetchall():
        member_contribution.append({
            "member": f"{row[0]} {row[1]}",
            "jds_handled": row[2] or 0,
            "candidates_processed": row[3] or 0,
            "offers_made": row[4] or 0,
            "top_performer": False  # Add logic if needed
        })
    # --- Customer Distribution ---
    customer_sql = """
        SELECT c.company_name, COUNT(j.jd_id), SUM(cand.screen_status='selected')
        FROM customers c
        LEFT JOIN recruitment_jds j ON c.company_id = j.company_id
        LEFT JOIN candidates cand ON j.jd_id = cand.jd_id
        WHERE (%s = '' OR j.team_id IN (SELECT team_id FROM teams WHERE team_name = %s))
        GROUP BY c.company_id
    """
    db.cursor.execute(customer_sql, (team_name, team_name))
    customer_distribution = []
    for row in db.cursor.fetchall():
        customer_distribution.append({
            "customer": row[0],
            "jds_handled": row[1] or 0,
            "candidates_placed": row[2] or 0
        })
    db.close()
    return JsonResponse({
        "team_overview": team_overview,
        "recruitment_metrics": recruitment_metrics,
        "candidate_pipeline": candidate_pipeline,
        "member_contribution": member_contribution,
        "customer_distribution": customer_distribution,
        'performance_analytics': {
            'conversion_rate': conversion_rate,
            'success_rate': success_rate,
            'monthly_trends': monthly_trends
        },# Add chart data if needed
    })

def team_reports_export(request):
    """
    API endpoint to export team reports.
    """
    team_search = request.GET.get('team_search', '')
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM teams WHERE team_name LIKE %s", (f"%{team_search}%",))
    teams = cursor.fetchall()
    team_ids = [t['team_id'] for t in teams]
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="team_reports.csv"'
    writer = csv.writer(response)
    writer.writerow(['Team Name', 'Team Lead', 'Members', 'Total JDs', 'In Progress', 'Closed', 'Avg Closure Time'])
    for t in teams:
        cursor.execute("SELECT first_name, last_name FROM hr_team_members WHERE emp_id IN (SELECT emp_id FROM team_members WHERE team_id=%s AND role LIKE 'lead%%')", (t['team_id'],))
        lead = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as cnt FROM team_members WHERE team_id=%s", (t['team_id'],))
        members = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) as cnt FROM recruitment_jds WHERE team_id=%s", (t['team_id'],))
        total_jds = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) as cnt FROM recruitment_jds WHERE team_id=%s AND jd_status='active'", (t['team_id'],))
        in_progress = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) as cnt FROM recruitment_jds WHERE team_id=%s AND jd_status='closed'", (t['team_id'],))
        closed = cursor.fetchone()['cnt']
        writer.writerow([
            t['team_name'],
            f"{lead['first_name']} {lead['last_name']}" if lead else '',
            members,
            total_jds,
            in_progress,
            closed,
            ''  # Avg closure time can be added if needed
        ])
    cursor.close()
    conn.close()
    return response

import mysql.connector
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
import csv

def task_progress_reports_page(request):
    """
    View to render the task progress reports page.
    """
    name = request.session.get('name', 'Guest')
    return render(request, "task_progress_reports.html", {"name": name})

def team_report_filters(request):
    """
    API endpoint to get filters for team reports.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT team_id, team_name FROM teams")
    teams = cursor.fetchall()
    cursor.close()
    conn.close()
    return JsonResponse({"teams": teams})

def team_reports_api(request):
    """
    API endpoint to get team reports.
    """
    team_id = request.GET.get("team_id")
    jd_status = request.GET.get("jd_status")
    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # JD Progress Overview
    jd_query = """
        SELECT jd.jd_id, jd.jd_summary, t.team_name, jd.jd_status, jd.total_profiles,
            jd.profiles_in_progress, jd.profiles_completed, jd.profiles_selected,
            jd.profiles_rejected, jd.profiles_on_hold
        FROM recruitment_jds jd
        LEFT JOIN teams t ON jd.team_id = t.team_id
        WHERE 1=1
    """
    params = []
    if team_id:
        jd_query += " AND jd.team_id = %s"
        params.append(team_id)
    if jd_status:
        jd_query += " AND jd.jd_status = %s"
        params.append(jd_status)
    if from_date:
        jd_query += " AND jd.created_at >= %s"
        params.append(from_date)
    if to_date:
        jd_query += " AND jd.created_at <= %s"
        params.append(to_date)
    cursor.execute(jd_query, params)
    jd_progress = cursor.fetchall()

    # Profile Status Breakdown (Pie) - filtered
    status_counts = {"toBeScreened": 0, "selected": 0, "rejected": 0, "onHold": 0}
    status_query = """
        SELECT c.screen_status, COUNT(*) as cnt
        FROM candidates c
        LEFT JOIN recruitment_jds jd ON c.jd_id = jd.jd_id
        WHERE 1=1
    """
    status_params = []
    if team_id:
        status_query += " AND jd.team_id = %s"
        status_params.append(team_id)
    if jd_status:
        status_query += " AND jd.jd_status = %s"
        status_params.append(jd_status)
    if from_date:
        status_query += " AND jd.created_at >= %s"
        status_params.append(from_date)
    if to_date:
        status_query += " AND jd.created_at <= %s"
        status_params.append(to_date)
    status_query += " GROUP BY c.screen_status"
    cursor.execute(status_query, status_params)
    for row in cursor.fetchall():
        status_counts[row["screen_status"]] = row["cnt"]
    profile_status_chart = {
        "labels": ["To Be Screened", "Selected", "Rejected", "On Hold"],
        "data": [
            status_counts.get("toBeScreened", 0),
            status_counts.get("selected", 0),
            status_counts.get("rejected", 0),
            status_counts.get("onHold", 0)
        ]
    }

    # JD Completion Rate (Bar)
    jd_completion_chart = {
        "labels": [jd["jd_id"] for jd in jd_progress],
        "data": [
            int((jd["profiles_selected"] / jd["total_profiles"] * 100) if jd["total_profiles"] else 0)
            for jd in jd_progress
        ]
    }

    # Team/Member Contribution
    cursor.execute("""
        SELECT c.jd_id, t.team_name, CONCAT(m.first_name, ' ', m.last_name) AS member_name,
            COUNT(c.candidate_id) AS profiles_processed,
            SUM(c.screen_status='selected') AS selected,
            SUM(c.screen_status='rejected') AS rejected,
            SUM(c.screen_status='onHold') AS on_hold
        FROM candidates c
        LEFT JOIN teams t ON c.team_id = t.team_id
        LEFT JOIN hr_team_members m ON c.hr_member_id = m.emp_id
        GROUP BY c.jd_id, t.team_name, member_name
    """)
    team_contribution = cursor.fetchall()

    # Timeline/Trend Analysis (Line)
    cursor.execute("""
        SELECT DATE(screened_on) as date, 
            SUM(screen_status='selected') as selected,
            SUM(screen_status='rejected') as rejected,
            SUM(screen_status='onHold') as on_hold,
            COUNT(*) as processed
        FROM candidates
        WHERE screened_on IS NOT NULL
        GROUP BY DATE(screened_on)
        ORDER BY date ASC
    """)
    rows = cursor.fetchall()
    labels = [r["date"].strftime("%Y-%m-%d") for r in rows]
    timeline_chart = {
        "labels": labels,
        "datasets": [
            {"label": "Processed", "data": [r["processed"] for r in rows], "borderColor": "#2563eb", "fill": False},
            {"label": "Selected", "data": [r["selected"] for r in rows], "borderColor": "#16a34a", "fill": False},
            {"label": "Rejected", "data": [r["rejected"] for r in rows], "borderColor": "#dc2626", "fill": False},
            {"label": "On Hold", "data": [r["on_hold"] for r in rows], "borderColor": "#f59e42", "fill": False}
        ]
    }

    cursor.close()
    conn.close()
    return JsonResponse({
        "jd_progress": jd_progress,
        "profile_status_chart": profile_status_chart,
        "jd_completion_chart": jd_completion_chart,
        "team_contribution": team_contribution,
        "timeline_chart": timeline_chart
    })

def api_jd_detail(request, jd_id):
    """
    API endpoint to get details of a specific job description.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT c.candidate_id, c.name, c.email, c.phone, c.screen_status as status,
            t.team_name, CONCAT(m.first_name, ' ', m.last_name) AS member_name
        FROM candidates c
        LEFT JOIN teams t ON c.team_id = t.team_id
        LEFT JOIN hr_team_members m ON c.hr_member_id = m.emp_id
        WHERE c.jd_id = %s
    """, (jd_id,))
    candidates = cursor.fetchall()
    cursor.close()
    conn.close()
    return JsonResponse({"candidates": candidates})

def team_reports_export(request):
    """
    API endpoint to export team reports as CSV.
    """
    team_id = request.GET.get("team_id")
    jd_status = request.GET.get("jd_status")
    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT jd.jd_id, jd.jd_summary, t.team_name, jd.jd_status, jd.total_profiles,
            jd.profiles_in_progress, jd.profiles_completed, jd.profiles_selected,
            jd.profiles_rejected, jd.profiles_on_hold
        FROM recruitment_jds jd
        LEFT JOIN teams t ON jd.team_id = t.team_id
        WHERE 1=1
    """
    params = []
    if team_id:
        query += " AND jd.team_id = %s"
        params.append(team_id)
    if jd_status:
        query += " AND jd.jd_status = %s"
        params.append(jd_status)
    if from_date:
        query += " AND jd.created_at >= %s"
        params.append(from_date)
    if to_date:
        query += " AND jd.created_at <= %s"
        params.append(to_date)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = "attachment; filename=task_progress_report.csv"
    writer = csv.writer(response)
    writer.writerow([
        "JD ID", "Summary", "Team", "Status", "Total Profiles",
        "In Progress", "Completed", "Selected", "Rejected", "On Hold"
    ])
    for row in rows:
        writer.writerow(row)
    cursor.close()
    conn.close()
    return response

import mysql.connector
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
import csv

def candidate_conversion_rates_page(request):
    name = request.session.get('name', 'Guest')
    return render(request, "candidate_conversion_rates.html",{'name': name})

def ccr_filters(request):
    """
    API endpoint to get filters for candidate conversion rates.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT jd_id, jd_summary FROM recruitment_jds")
    jds = cursor.fetchall()
    cursor.execute("SELECT team_id, team_name FROM teams")
    teams = cursor.fetchall()
    cursor.close()
    conn.close()
    return JsonResponse({"jds": jds, "teams": teams})

def ccr_reports_api(request):
    """
    API endpoint to get candidate conversion reports.
    """
    jd_id = request.GET.get("jd_id")
    team_id = request.GET.get("team_id")
    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Overall Funnel
    funnel_labels = ["Screened", "L1 Cleared", "L2 Cleared", "L3 Cleared", "Final Selected"]
    funnel_query = """
        SELECT
            COUNT(*) as total,
            SUM(screen_status='selected') as screened,
            SUM(l1_result='selected') as l1,
            SUM(l2_result='selected') as l2,
            SUM(l3_result='selected') as l3,
            SUM(l3_result='selected' AND screen_status='selected') as final_selected
        FROM candidates WHERE 1=1
    """
    params = []
    if jd_id:
        funnel_query += " AND jd_id = %s"
        params.append(jd_id)
    if team_id:
        funnel_query += " AND team_id = %s"
        params.append(team_id)
    if from_date:
        funnel_query += " AND created_at >= %s"
        params.append(from_date)
    if to_date:
        funnel_query += " AND created_at <= %s"
        params.append(to_date)
    cursor.execute(funnel_query, params)
    row = cursor.fetchone()
    funnel_data = [row["screened"], row["l1"], row["l2"], row["l3"], row["final_selected"]]

    # Stage-wise Conversion Rates
    stage_labels = ["Screen → L1", "L1 → L2", "L2 → L3", "L3 → Final"]
    stage_data = []
    total_screened = row["screened"] or 1
    total_l1 = row["l1"] or 1
    total_l2 = row["l2"] or 1
    total_l3 = row["l3"] or 1
    stage_data.append(round((int(row["l1"] or 0) / total_screened) * 100, 2))
    stage_data.append(round((int(row["l2"] or 0) / (total_l1 or 1)) * 100, 2))
    stage_data.append(round((int(row["l3"] or 0) / (total_l2 or 1)) * 100, 2))
    stage_data.append(round((int(row["final_selected"] or 0) / (total_l3 or 1)) * 100, 2))
        # Trend Analysis
    cursor.execute("""
        SELECT DATE(created_at) as date,
            SUM(screen_status='selected') as screened,
            SUM(l1_result='selected') as l1,
            SUM(l2_result='selected') as l2,
            SUM(l3_result='selected') as l3
        FROM candidates
        WHERE 1=1
        {} {} {} {}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    """.format(
        "AND jd_id = %s" if jd_id else "",
        "AND team_id = %s" if team_id else "",
        "AND created_at >= %s" if from_date else "",
        "AND created_at <= %s" if to_date else ""
    ), tuple(filter(None, [jd_id, team_id, from_date, to_date])))
    rows = cursor.fetchall()
    trend_labels = [str(r["date"]) for r in rows]
    trend_datasets = [
        {"label": "Screened", "data": [r["screened"] for r in rows], "borderColor": "#2563eb", "fill": False},
        {"label": "L1", "data": [r["l1"] for r in rows], "borderColor": "#3b82f6", "fill": False},
        {"label": "L2", "data": [r["l2"] for r in rows], "borderColor": "#0ea5e9", "fill": False},
        {"label": "L3", "data": [r["l3"] for r in rows], "borderColor": "#16a34a", "fill": False},
    ]

    # JD-wise Conversion Rates
    jd_query = """
        SELECT jd.jd_id, jd.jd_summary, t.team_name,
            COUNT(c.candidate_id) as total,
            SUM(c.screen_status='selected') as screened,
            SUM(c.l1_result='selected') as l1,
            SUM(c.l2_result='selected') as l2,
            SUM(c.l3_result='selected') as l3,
            SUM(c.l3_result='selected' AND c.screen_status='selected') as final_selected
        FROM recruitment_jds jd
        LEFT JOIN teams t ON jd.team_id = t.team_id
        LEFT JOIN candidates c ON jd.jd_id = c.jd_id
        WHERE 1=1
    """
    jd_params = []
    if team_id:
        jd_query += " AND jd.team_id = %s"
        jd_params.append(team_id)
    if jd_id:
        jd_query += " AND jd.jd_id = %s"
        jd_params.append(jd_id)
    if from_date:
        jd_query += " AND c.created_at >= %s"
        jd_params.append(from_date)
    if to_date:
        jd_query += " AND c.created_at <= %s"
        jd_params.append(to_date)
    jd_query += " GROUP BY jd.jd_id, jd.jd_summary, t.team_name"
    cursor.execute(jd_query, jd_params)
    jd_rates = []
    for r in cursor.fetchall():
        total = r["total"] or 1
        final_selected = r["final_selected"] or 0
        conversion_pct = round((int(final_selected) / total) * 100, 2) if total else 0
        jd_rates.append({
            "jd_summary": r["jd_summary"],
            "team_name": r["team_name"],
            "total": r["total"],
            "screened": r["screened"],
            "l1": r["l1"],
            "l2": r["l2"],
            "l3": r["l3"],
            "final_selected": r["final_selected"],
            "conversion_pct": conversion_pct
        })

    # Team/Member Conversion Performance
    cursor.execute("""
        SELECT t.team_name, CONCAT(m.first_name, ' ', m.last_name) AS member_name,
            COUNT(c.candidate_id) as total,
            SUM(c.l3_result='selected' AND c.screen_status='selected') as final_selected
        FROM candidates c
        LEFT JOIN teams t ON c.team_id = t.team_id
        LEFT JOIN hr_team_members m ON c.hr_member_id = m.emp_id
        WHERE 1=1
        {} {} {} {}
        GROUP BY t.team_name, member_name
    """.format(
        "AND c.jd_id = %s" if jd_id else "",
        "AND c.team_id = %s" if team_id else "",
        "AND c.created_at >= %s" if from_date else "",
        "AND c.created_at <= %s" if to_date else ""
    ), tuple(filter(None, [jd_id, team_id, from_date, to_date])))
    team_rates = []
    for r in cursor.fetchall():
        total = r["total"] or 1
        conversion_pct = round((r["final_selected"] / total) * 100, 2) if total else 0
        team_rates.append({
            "team_name": r["team_name"],
            "member_name": r["member_name"],
            "total": r["total"],
            "final_selected": r["final_selected"],
            "conversion_pct": conversion_pct
        })

    # Time-to-Conversion Metrics
    cursor.execute("""
        SELECT jd.jd_summary,
            AVG(DATEDIFF(c.l1_date, c.screened_on)) as screen_l1,
            AVG(DATEDIFF(c.l2_date, c.l1_date)) as l1_l2,
            AVG(DATEDIFF(c.l3_date, c.l2_date)) as l2_l3,
            AVG(DATEDIFF(c.updated_at, c.l3_date)) as l3_final
        FROM candidates c
        LEFT JOIN recruitment_jds jd ON c.jd_id = jd.jd_id
        WHERE c.screened_on IS NOT NULL AND c.l1_date IS NOT NULL AND c.l2_date IS NOT NULL AND c.l3_date IS NOT NULL
        {} {} {} {}
        GROUP BY jd.jd_summary
    """.format(
        "AND c.jd_id = %s" if jd_id else "",
        "AND c.team_id = %s" if team_id else "",
        "AND c.created_at >= %s" if from_date else "",
        "AND c.created_at <= %s" if to_date else ""
    ), tuple(filter(None, [jd_id, team_id, from_date, to_date])))
    time_metrics = []
    for r in cursor.fetchall():
        time_metrics.append({
            "jd_summary": r["jd_summary"],
            "screen_l1": round(r["screen_l1"] or 0, 1),
            "l1_l2": round(r["l1_l2"] or 0, 1),
            "l2_l3": round(r["l2_l3"] or 0, 1),
            "l3_final": round(r["l3_final"] or 0, 1)
        })

    cursor.close()
    conn.close()
    return JsonResponse({
        "funnel": {"labels": funnel_labels, "data": funnel_data},
        "stage_rates": {"labels": stage_labels, "data": stage_data},
        "trend": {"labels": trend_labels, "datasets": trend_datasets},
        "jd_rates": jd_rates,
        "team_rates": team_rates,
        "time_metrics": time_metrics
    })

def ccr_reports_export(request):
    """
    API endpoint to export candidate conversion reports.
    """
    jd_id = request.GET.get("jd_id")
    team_id = request.GET.get("team_id")
    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT jd.jd_summary, t.team_name,
            COUNT(c.candidate_id) as total,
            SUM(c.screen_status='selected') as screened,
            SUM(c.l1_result='selected') as l1,
            SUM(c.l2_result='selected') as l2,
            SUM(c.l3_result='selected') as l3,
            SUM(c.l3_result='selected' AND c.screen_status='selected') as final_selected
        FROM recruitment_jds jd
        LEFT JOIN teams t ON jd.team_id = t.team_id
        LEFT JOIN candidates c ON jd.jd_id = c.jd_id
        WHERE 1=1
    """
    params = []
    if team_id:
        query += " AND jd.team_id = %s"
        params.append(team_id)
    if jd_id:
        query += " AND jd.jd_id = %s"
        params.append(jd_id)
    if from_date:
        query += " AND c.created_at >= %s"
        params.append(from_date)
    if to_date:
        query += " AND c.created_at <= %s"
        params.append(to_date)
    query += " GROUP BY jd.jd_summary, t.team_name"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = "attachment; filename=candidate_conversion_rates.csv"
    writer = csv.writer(response)
    writer.writerow([
        "JD", "Team", "Total Candidates", "Screened", "L1 Cleared", "L2 Cleared", "L3 Cleared", "Final Selected"
    ])
    for row in rows:
        writer.writerow(row)
    cursor.close()
    conn.close()
    return response

def user_profile(request):
    """
    View to render the user profile page.
    """
    try:
        email = request.session.get('email')
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT
                t.emp_id,
                CONCAT(t.first_name, ' ', t.last_name) AS name,
                t.email,
                t.phone,
                t.role,
                t.date_joined,
                tm.team_id,
                teams.team_name
            FROM hr_team_members t
            JOIN team_members tm ON t.emp_id = tm.emp_id
            JOIN teams ON tm.team_id = teams.team_id
            WHERE t.email = %s
            LIMIT 1
        """, (email,))
        userDetails = cursor.fetchone() or {}
        cursor.close()
        conn.close()
    except mysql.connector.Error as err:
        return HttpResponse(f"Database error: {err}", status=500)
    return render(request, "user_profile.html", {"user": userDetails})

def manage_sessions_view(request):
    """
    View to manage user sessions.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT us.session_id, us.user_id, us.expires_at, u.username, u.role
        FROM user_sessions us
        JOIN users u ON us.user_id = u.user_id
        WHERE us.expires_at > NOW()
        ORDER BY us.expires_at DESC
    """)
    sessions = []
    for row in cursor.fetchall():
        sessions.append({
            'session_id': row['session_id'],
            'user_id': row['user_id'],
            'username': row['username'],
            'role': row['role'],
            'expires_at': row['expires_at'].strftime('%Y-%m-%d %H:%M')
        })
    cursor.close()
    conn.close()
    print(sessions)
    name = request.session.get('name', 'Guest')
    return render(request, 'manage_sessions.html', {'sessions': json.dumps(sessions), 'name': name})

@csrf_exempt
def logout_session_api(request):
    """
    API endpoint to log out a user session.
    """
    if request.method == 'POST':
        data = json.loads(request.body)
        session_id = data.get('session_id')
        if session_id:
            conn = DataOperations.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE session_id=%s", (session_id,))
            conn.commit()
            cursor.close()
            conn.close()
            return JsonResponse({'success': True})
    return JsonResponse({'success': False})

import mysql.connector
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json


def access_permissions(request):
    """
    View to manage access permissions.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT user_id, username, email, role, is_active, created_at FROM users")
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return render(request, "access_permissions.html", {"users": users})


@csrf_exempt
def change_password(request):
    """
    API endpoint to change user password.
    """
    if request.method == "POST":
        data = json.loads(request.body)
        old_password = data.get("old_password")
        new_password = data.get("new_password")
        user_id = request.session.get("user_id")
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM users WHERE user_id=%s", (user_id,))
        row = cursor.fetchone()
        if not row or not check_password(old_password, row[0]):
            cursor.close()
            conn.close()
            return JsonResponse({"success": False, "message": "Current password is incorrect."})
        new_password_hash = make_password(new_password)
        cursor.execute("UPDATE users SET password_hash=%s WHERE user_id=%s", (new_password_hash, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return JsonResponse({"success": True, "message": "Password changed successfully."})
    return JsonResponse({"success": False, "message": "Invalid request."})

@csrf_exempt
def change_role(request):
    """
    API endpoint to change user role.
    """
    if request.method == "POST":
        data = json.loads(request.body)
        user_id = data.get("user_id")
        role = data.get("role")
        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET role=%s WHERE user_id=%s", (role, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        MessageProviders.send_notification(user_id, "Role Update", f"Your role has been changed to {role}")
        return JsonResponse({"success": True, "message": "Role updated successfully."})
    return JsonResponse({"success": False, "message": "Invalid request."})

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .db_initializer import ATSDatabaseInitializer

def status_report_page(request):
    """
    View to render the status report page.
    """
    db = ATSDatabaseInitializer()
    db.cursor.execute("USE ats")
    db.cursor.execute("SELECT team_id, team_name FROM teams")
    teams = [{"team_id": t[0], "team_name": t[1]} for t in db.cursor.fetchall()]
    db.cursor.execute("SELECT emp_id, first_name, last_name FROM hr_team_members WHERE status='active'")
    members = [{"emp_id": m[0], "first_name": m[1], "last_name": m[2]} for m in db.cursor.fetchall()]
    db.close()
    return render(request, 'status_report.html', {"teams": teams, "members": members})

@csrf_exempt
def generate_status_report(request):
    """
    API endpoint to generate status reports.
    """
    if request.method == "POST":
        db = ATSDatabaseInitializer()
        db.cursor.execute("USE ats")
        report_type = request.POST.get("report_type")
        team_id = request.POST.get("team_id")
        member_id = request.POST.get("member_id")
        date = request.POST.get("date")
        from_date = request.POST.get("from_date")
        to_date = request.POST.get("to_date")

        where = []
        params = []
        if team_id and team_id != "all":
            where.append("c.team_id=%s")
            params.append(team_id)
        if member_id and member_id != "all":
            where.append("c.hr_member_id=%s")
            params.append(member_id)
        if report_type == "daily" and date:
            where.append("DATE(c.shared_on)=%s")
            params.append(date)
        elif report_type == "weekly" and date:
            where.append("YEARWEEK(c.shared_on, 1)=YEARWEEK(%s, 1)")
            params.append(date)
        elif report_type == "custom" and from_date and to_date:
            where.append("DATE(c.shared_on) BETWEEN %s AND %s")
            params.extend([from_date, to_date])

        where_clause = " AND ".join(where) if where else "1=1"
        db.cursor.execute(f"""
            SELECT
                cu.company_name,
                j.jd_summary,
                c.jd_id,
                DATE_FORMAT(c.shared_on, '%%d-%%b-%%Y') AS shared_on,
                COUNT(c.candidate_id) AS profile_count,
                GROUP_CONCAT(c.screened_remarks SEPARATOR ', ') AS feedback
            FROM candidates c
            JOIN recruitment_jds j ON c.jd_id = j.jd_id
            JOIN customers cu ON j.company_id = cu.company_id
            WHERE {where_clause}
            GROUP BY cu.company_name, j.jd_summary, c.jd_id, shared_on
            ORDER BY shared_on DESC
        """, tuple(params))
        rows = db.cursor.fetchall()
        report = []
        for idx, r in enumerate(rows):
            report.append({
                "company_name": r[0],
                "jd_summary": r[1],
                "jd_id": r[2],
                "shared_on": r[3],
                "profile_count": r[4],
                "feedback": r[5] or ""
            })
        db.close()
        return JsonResponse({"report": report, "message": "Report generated."})
    return JsonResponse({"report": [], "message": "Invalid request."})


@csrf_exempt
def export_teams_excel(request):
    """
    API endpoint to export team data as Excel.
    """
    if request.method == "POST":
        data = json.loads(request.body)
        teams = data.get("teams", [])
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Teams"
        headers = ["Team Id", "Team Name", "Total Strength", "Created On"]
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True, color="1F497D")
            cell.alignment = Alignment(horizontal="center")
        for team in teams:
            ws.append([
                team.get("team_id", ""),
                team.get("team_name", ""),
                team.get("strength", ""),
                team.get("created_at", "")
            ])
        # Auto-width columns
        for col in ws.columns:
            max_length = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            ws.column_dimensions[col_letter].width = max_length + 2
        # Save to response
        response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = "attachment; filename=teams_export.xlsx"
        wb.save(response)
        return response
    return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
def export_team_reports_excel(request):
    """
    API endpoint to export team reports as Excel.
    """
    print("Received request for exporting team reports to Excel.")
    if request.method == "POST":
        data = json.loads(request.body)
        print("Data received for export:", data)
        wb = openpyxl.Workbook()
        thin = Side(border_style="thin", color="000000")

        # Sheet mapping: key -> sheet name
        sheet_map = {
            "teamOverviewData": "Team Overview",
            "recruitmentMetricsData": "Recruitment Metrics",
            "candidatePipelineData": "Candidate Pipeline",
            "memberContributionData": "Member Contribution",
            "customerDistributionData": "Customer Distribution"
        }

        # Remove default sheet if not used
        default_sheet = wb.active
        default_sheet.title = "DeleteMe"
        used = False

        for key, sheet_name in sheet_map.items():
            rows = data.get(key, [])
            if not rows:
                continue
            if not used:
                ws = default_sheet
                ws.title = sheet_name
                used = True
            else:
                ws = wb.create_sheet(title=sheet_name)
            for i, row in enumerate(rows):
                ws.append(row)
                for j, cell in enumerate(ws[i+1]):
                    cell.font = Font(bold=(i==0), color="1F497D" if i==0 else "000000")
                    cell.alignment = Alignment(horizontal="center")
                    cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
                    if i == 0:
                        cell.fill = PatternFill("solid", fgColor="D9E1F2")
            # Auto-width columns
            for col in ws.columns:
                max_length = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                ws.column_dimensions[col_letter].width = max_length + 2

        # Remove default sheet if unused
        if not used:
            wb.remove(default_sheet)

        response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = "attachment; filename=team_reports.xlsx"
        wb.save(response)
        return response
    return HttpResponse(status=405)

def get_user_id_by_username(username):
    """
    Fetch user ID from the database using username.
    """
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM users WHERE username=%s", (username,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row[0] if row else None

def notification_settings(request):
    """
    View to manage notification settings.
    """
    print("Accessing notification settings page.")
    #fetch user id for username
    username = request.session.get("username")
    user_id = get_user_id_by_username(username)
    print("Current user ID:", username, "for:", user_id)
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
   # python
    cursor.execute("SELECT notifications_enabled FROM user_settings WHERE user_id=%s", [user_id])
    row = cursor.fetchone()
    notifications_enabled = row["notifications_enabled"] if row else True
    print(f"User {username} notifications enabled: {notifications_enabled}")

    # get all notifications for user
    cursor.execute("SELECT * FROM notifications WHERE user_id=%s and is_read=%s", [user_id, False])
    notifications = cursor.fetchall()
    print(f"User {username} notifications: {notifications}")

    cursor.close()
    conn.close()
    name = request.session.get('name', 'Guest')
    print(f"User {username} notifications: {notifications}")
    return render(request, "settings_notification.html", {
        "notifications_enabled": notifications_enabled,
        "name": name,
        "notifications": notifications
    })

def mark_as_read_notification(request, notification_id):
    """
    API endpoint to mark a notification as read.
    """
    print("Accessing mark as read notification API.")
    if request.method == "POST":
        username = request.session.get("username")
        user_id = get_user_id_by_username(username)
        print("Marking notification as read for user ID:", username)

        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read=true WHERE user_id=%s AND notification_id=%s", [user_id, notification_id])
        conn.commit()
        cursor.close()
        conn.close()
        return JsonResponse({"status": "success"})
    return JsonResponse({"error": "Invalid request"}, status=400)

def clear_all_notifications(request):
    user_name = request.session.get("username")
    try:
        user_id = get_user_id_by_username(user_name)
        print("Clearing all notifications for user ID:", user_name)

        conn = DataOperations.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notifications WHERE user_id=%s", [user_id])
        conn.commit()
        cursor.close()
        conn.close()
        return JsonResponse({"status": "success"})
    except Exception as e:
        print("Error clearing notifications for user ID:", user_name, "Error:", e)
        return JsonResponse({"status": "error", "message": str(e)})

def notification_count(request):
    """
    API endpoint to get the count of unread notifications.
    """
    if request.method == "GET":
        username = request.session.get("username")
        user_id = get_user_id_by_username(username)
        print("Fetching notification count for user ID:", username)

        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) as count FROM notifications WHERE user_id=%s AND is_read=false", [user_id])
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        count = row["count"] if row else 0
        return JsonResponse({"notification_count": count})
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def toggle_notification(request):
    """
    API endpoint to toggle notification settings.
    """
    if request.method == "POST":
        # fetch username from session or request
        username = request.session.get("username")
        user_id = get_user_id_by_username(username)
        print("Toggling notification for user ID:", username)
        data = json.loads(request.body)
        enabled = data.get("enabled", True)

        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM user_settings WHERE user_id=%s", [user_id])
        if cursor.fetchone():
            cursor.execute("UPDATE user_settings SET notifications_enabled=%s WHERE user_id=%s", [enabled, user_id])
        else:
            cursor.execute("INSERT INTO user_settings (user_id, notifications_enabled) VALUES (%s, %s)", [user_id, enabled])
        status_text = "Notifications are ON" if enabled else "Notifications are OFF"
        conn.commit()
        cursor.close()
        conn.close()
        return JsonResponse({"status_text": status_text})
    return JsonResponse({"error": "Invalid request"}, status=400)






def save_email_config(request):
   
    useremail = request.session.get('username')
    if not useremail:
        return redirect('login')
    
    mail_providers = MessageProviders.MAIL_SERVICE_PROVIDERS

    if request.method == "POST":
        print("save_email_config -> Saving email config for user:", request.session.get('username'))
        email = request.POST.get("email_address")
        email_host_password = request.POST.get("email_host_password")
        # Checkbox: present as 'on' if checked, None if not
        email_provider = request.POST.get("email_provider", "gmail")
        smtp_host = mail_providers.get(email_provider, {}).get("smtp_host", "smtp.gmail.com")
        smtp_port = mail_providers.get(email_provider, {}).get("smtp_port", 587)
        # Validate email_host and email_host_password
        if not email:
            messages.error(request, "Email should not be blank.")
            return redirect('save_email_config')
        if not email_host_password:
            messages.error(request, "Host Password should not be blank.")
            return redirect('save_email_config')
        
        # Get user_id from users table
        user_id = get_user_id_by_username(useremail)

        if not user_id:
            return render(request, "email_config.html", {"user": {"email": useremail}, "error": "User not found."})
        print("Saving email config for user ID:", useremail, "->", user_id)
        # Check email credentials by sending a test mail
        from .utils import encrypt_password
        test_subject = "[QuantumNxt] Email Configuration Test"
        test_body = "<p>Your email configuration was tested and is working! If you did not request this, please ignore.</p>"
        test_result = MessageProviders.send_email(
            from_email=email,
            app_password=email_host_password,
            to_email=email,  # send to self
            subject=test_subject,
            html_body=test_body,
            smtp_host=smtp_host,
            smtp_port=smtp_port
        )
        if not test_result:
            messages.error(request, "Could not send test email. Please check your email address and password.")
            return redirect('save_email_config')

        # Encrypt the password before saving
        encrypted_password = encrypt_password(email_host_password)

        conn = DataOperations.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Upsert into email_config table (user_id, email, email_host_password)
        cursor.execute("""
            INSERT INTO email_config (user_id, email, email_smtp_host, email_smtp_port, email_host_password)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE email=%s, email_smtp_host=%s, email_smtp_port=%s, email_host_password=%s
        """, (user_id, email, smtp_host, smtp_port, encrypted_password, email, smtp_host, smtp_port, encrypted_password))
        conn.commit()
        cursor.close()
        conn.close()

        messages.success(request, "Email configuration successful!")
        return redirect('save_email_config')
    return render(request, "email_config.html", {"user": {"email": useremail}, "email_providers": mail_providers, "is_gmail": False})

def notifications_list(request):
    """
    View to render the notifications list page.
    """
    return render(request, 'notifications_list.html', {})

def get_email_configs(user_id):
    conn = DataOperations.get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM email_config WHERE user_id=%s", [user_id])
    email_configs = cursor.fetchone()
    cursor.close()
    conn.close()
    return email_configs