# ats_tracker/views.py
from django.shortcuts import render
from django.db import connection
from django.utils.html import escape
from .db_initializer import ATSDatabaseInitializer
import mysql.connector
from django.shortcuts import render, redirect
from django.urls import reverse
from django.http import JsonResponse
import json
from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest
from django.db import connection
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.contrib.auth.hashers import check_password
from django.utils.html import escape
from django.contrib.auth.hashers import make_password

def login_view(request):
    initializer = ATSDatabaseInitializer()
    initializer.initialize()
    initializer.close()

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '').strip()
        if not username or not password:
            return render(request, 'login.html', {'error': 'Please enter both username/email and password.'})

        valid_user = validate_user(username, password)
        print("login_view -> Valid user:", valid_user)
        # If valid_user is not None, it means the user was found and password matched
        # valid_user will be a tuple (user_id, db_username, role, status)
        if valid_user:
            user_id, db_username, role,status = valid_user
            request.session['user_id'] = user_id
            request.session['username'] = db_username
            request.session['role'] = role
            request.session['authenticated'] = True
            return redirect('home')
        else:
            return render(request, 'login.html', {'error': 'Invalid credentials or inactive user.'})

    return render(request, 'login.html',{ 'error': 'Click Submit to Proceed'})

# function to validate username and password with users table
def validate_user(username, password):
    print("validate_user -> Username:", username)
    print("validate_user -> Password:", password)
    conn = get_db_connection_ats()
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
    return None, None, None

def home(request):
    return render(request, 'home.html')


def get_db_connection():
    return mysql.connector.connect(
        host='localhost',
        user='root',
        password='root',
        database='ats',
        charset='utf8mb4'
    )
def add_member(request):
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
                connection = get_db_connection()
                cursor = connection.cursor()
                cursor.execute("""
                    INSERT INTO hr_team_members
                    (first_name, last_name, email, phone, role, date_joined, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, [first_name, last_name, email, phone, role, date_joined, status])
                connection.commit()
                message = f"Member {escape(first_name)} {escape(last_name)} added successfully!"
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

    return render(request, 'add_member.html', {
        'message': message,
        'error': error
    })

# python

from django.http import JsonResponse

def create_team(request):
    message = error = None
    members = []
    teams = []
    if request.method == "POST":
        team_name = request.POST.get("team_name", "").strip()
        selected_members = request.POST.getlist("members")
        if not team_name or not selected_members:
            error = "Team name and at least one member are required."
        else:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("INSERT INTO teams (team_name) VALUES (%s)", [team_name])
                team_id = cursor.lastrowid
                for emp_id in selected_members:
                    cursor.execute("INSERT INTO team_members (team_id, emp_id) VALUES (%s, %s)", [team_id, emp_id])
                conn.commit()
                message = f"Team '{team_name}' created successfully."
            except Exception as e:
                if "Duplicate entry" in str(e):
                    error = "A team with this name already exists."
                else:
                    error = f"Failed to create team: {str(e)}"
            finally:
                if 'cursor' in locals():
                    cursor.close()
                if 'conn' in locals():
                    conn.close()
    # Fetch available members
    try:
        conn = get_db_connection()
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
    return render(request, "create_team.html", {
        "members": members,
        "teams": teams,
        "message": message,
        "error": error
    })

def team_members(request, team_id):
    try:
        conn = get_db_connection()
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

def get_db_connection_ats():
    return mysql.connector.connect(
        host='localhost',
        user='root',
        password='root',
        database='ats',
        charset='utf8mb4'
    )

def view_edit_teams(request):
    teams = []
    try:
        conn = get_db_connection_ats()
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
    return render(request, 'view_edit_teams.html', {'teams': teams})

def team_members_api(request, team_id):
    members = []
    available_members = []
    try:
        conn = get_db_connection_ats()
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
    try:
        data = json.loads(request.body)
        emp_id = data.get('emp_id')
        if not emp_id:
            return HttpResponseBadRequest("emp_id required")
        conn = get_db_connection_ats()
        cursor = conn.cursor()
        # Insert into team_members, ignore if already exists
        cursor.execute("""
            INSERT IGNORE INTO team_members (team_id, emp_id) VALUES (%s, %s)
        """, [team_id, emp_id])
        conn.commit()
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
    try:
        data = json.loads(request.body)
        emp_id = data.get('emp_id')
        if not emp_id:
            return HttpResponseBadRequest("emp_id required")
        conn = get_db_connection_ats()
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM team_members WHERE team_id = %s AND emp_id = %s
        """, [team_id, emp_id])
        conn.commit()
    except Exception as e:
        return HttpResponseBadRequest(str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
    return team_members_api(request, team_id)
