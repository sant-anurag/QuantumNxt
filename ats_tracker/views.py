# ats_tracker/views.py
import os
import json
from datetime import datetime
import mysql.connector
import textract
from .parser import ResumeParser
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.hashers import check_password, make_password
from django.db import connection
from django.http import (
    JsonResponse, HttpResponseBadRequest, FileResponse, Http404
)
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt

from .db_initializer import ATSDatabaseInitializer
import json
from django.http import JsonResponse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from django.http import JsonResponse
from django.db import connection
import environ




def login_view(request):
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
        if valid_user:
            user_id, db_username, role, status = valid_user
            # Fetch name from hr_team_members table against email
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT first_name, last_name FROM hr_team_members WHERE email=%s
            """, [username])
            row = cursor.fetchone()
            cursor.close()
            conn.close()
            if row:
                first_name, last_name = row
                name = f"{first_name} {last_name}"
            request.session['user_id'] = user_id
            request.session['username'] = db_username
            request.session['role'] = role
            request.session['authenticated'] = True
            request.session['email'] = username
            request.session['name'] = name  # Store name in session
            return redirect('home')
        else:
            return render(request, 'login.html', {'error': 'Invalid credentials or inactive user.'})
    print("login_view -> User Name:", name)
    return render(request, 'login.html', {'error': 'Click Submit to Proceed'})

# function to validate username and password with users table
def validate_user(username, password):
    print("validate_user -> Username:", username)
    print("validate_user -> Password:", password)
    conn = get_db_connection()
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
    name = request.session.get('name', 'Guest')
    return render(request, 'home.html', {'name': name})


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
                # Add HR team member
                connection = get_db_connection()
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

# python

from django.http import JsonResponse

def create_team(request):
    message = error = None
    members = []
    teams = []
    print("create_team -> Request method:", request.POST)
    if request.method == "POST":
        team_name = request.POST.get("team_name", "").strip()
        selected_members = request.POST.getlist("members")
        team_lead = request.POST.get("team_lead", "").strip()
        print("create_team -> Team Name:", team_name, "Selected Members:", selected_members, "Team Lead:", team_lead)
        if not team_name or not selected_members:
            error = "Team name and at least one member are required."
        else:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("INSERT INTO teams (team_name, lead_emp_id) VALUES (%s, %s)", [team_name, team_lead])
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
    name = request.session.get('name', 'Guest')
    return render(request, "create_team.html", {
        "members": members,
        "teams": teams,
        "message": message,
        "name": name,
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



def view_edit_teams(request):
    teams = []
    try:
        conn = get_db_connection()
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
    members = []
    available_members = []
    try:
        conn = get_db_connection()
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
        conn = get_db_connection()
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
        conn = get_db_connection()
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

# python


def get_db():
    return mysql.connector.connect(
        host="localhost", user="root", password="root", database="ats"
    )

def generate_jd_id():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT jd_id FROM recruitment_jds ORDER BY created_at DESC LIMIT 1")
    last = cursor.fetchone()
    if last:
        num = int(last[0][2:]) + 1
    else:
        num = 1
    return f"JD{num:02d}"

def jd_list(request):
    print("jd_list -> Request method:", request.method)
    search = request.GET.get("search", "")
    page = int(request.GET.get("page", 1))
    limit = 10
    offset = (page - 1) * limit
    conn = get_db_connection()
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
    return render(request, "jd_create.html", {
        "jds": jds,
        "total": total,
        "page": page,
        "search": search,
        "page_range": page_range,
        "companies": companies
    })

@csrf_exempt
def create_jd(request):
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
            conn = get_db_connection()
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
            conn = get_db_connection()
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
    print("jd_detail -> Request method:", request.method)
    conn = get_db_connection()
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
                conn = get_db_connection()
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
    print("view_edit_jds -> Request method:", request.method)
    conn = get_db_connection()
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
    return render(request, 'view_edit_jds.html', {
        'jds': jds,
        'companies': companies,
        'teams': teams
    })

def get_jd(request, jd_id):
    print("get_jd details-> Request method:", request.method)
    conn = get_db_connection()
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
    print("update_jd -> Request method:", request.method)
    if request.method == 'POST':
        data = json.loads(request.body)
        conn = get_db_connection()
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
        cursor.close()
        conn.close()
        return JsonResponse({'success': True})
    return JsonResponse({'error': 'Invalid method'}, status=405)

def assign_jd_data(request):
    conn = get_db_connection()
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
@csrf_exempt
def assign_jd(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid method"}, status=405)
    data = json.loads(request.body)
    jd_id = data.get("jd_id")
    team_id = data.get("team_id")
    if not jd_id or not team_id:
        return JsonResponse({"error": "JD and Team required"}, status=400)
    conn = get_db_connection()
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
    conn.close()
    return JsonResponse({"success": True, "jd": jd, "team": team, "members": members})

def assign_jd_page(request):
    return render(request, "assign_jd.html")

def employee_view_page(request):
    return render(request, "employee_view.html")

def employee_view_data(request):
    print("employee_view_data -> Request method:", request.method)
    conn = get_db_connection()
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
    print("employee_view_report -> Request method:", request.method)
    emp_id = request.GET.get("emp_id")
    if not emp_id:
        return JsonResponse({"error": "emp_id required"}, status=400)
    conn = get_db_connection()
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



def get_db_conn():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="root",
        database="ats"
    )

def upload_resume_page(request):
    # Get all JDs for dropdown
    conn = get_db_conn()
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
            conn = get_db_conn()
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
    conn = get_db_conn()
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
    # Connect to DB and fetch file path and name
    conn = get_db_conn()
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
    name = request.session.get('name', 'Guest')
    return render(request, 'view_parse_resumes.html', {'name': name})

@csrf_exempt
def view_parse_resumes(request):
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return JsonResponse({'success': False, 'error': 'JD ID required'}, status=400)
    conn = get_db_conn()
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
    print("update_resume_status -> Request method:", request.method)
    if request.method == 'POST':
        resume_id = request.POST.get('resume_id')
        status = request.POST.get('status')
        if not resume_id or status not in ['selected', 'rejected']:
            return JsonResponse({'success': False, 'error': 'Invalid input'}, status=400)
        conn = get_db_conn()
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
    print("export_resumes_excel -> Request method:", request.method)
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return HttpResponse("JD ID required", status=400)
    conn = get_db_conn()
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
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return JsonResponse({'success': False, 'error': 'JD ID required'}, status=400)
    conn = get_db_conn()
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
    if request.method == 'POST':
        data = json.loads(request.body)
        conn = get_db_conn()
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
    if request.method == 'POST':
        data = json.loads(request.body)
        conn = get_db_conn()
        cursor = conn.cursor()
        try:
            # First query to check for existing candidate
            cursor.execute("SELECT candidate_id FROM candidates WHERE resume_id=%s", [data.get('resume_id')])
            row = cursor.fetchone()  # <-- This fetches the result

            if row:
                # Update logic
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
                # Insert logic
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
            # No unread results remain, safe to close
            cursor.close()
            conn.close()
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

@csrf_exempt
def update_candidate_screen_status(request):
    if request.method == 'POST':
        resume_id = request.POST.get('resume_id')
        status = request.POST.get('status')
        conn = get_db_conn()
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
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return JsonResponse({'success': False, 'error': 'JD ID required'}, status=400)
    conn = get_db_conn()
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
    print("get_candidate_details -> Request method:", request.method)
    resume_id = request.GET.get('resume_id')
    if not resume_id:
        return JsonResponse({'success': False, 'error': 'resume_id required'}, status=400)
    conn = get_db_conn()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM candidates WHERE resume_id=%s ORDER BY candidate_id DESC LIMIT 1", (resume_id,))
    candidate = cursor.fetchone()
    cursor.close()
    conn.close()
    return JsonResponse({'success': True, 'candidate': candidate})

# views.py

def schedule_interviews_page(request):
    return render(request, 'schedule_interviews.html')

def get_candidates_for_jd(request):
    print("get_candidates_for_jd -> Request method:", request.method)
    jd_id = request.GET.get('jd_id')
    if not jd_id:
        return JsonResponse({'success': False, 'error': 'JD ID required'}, status=400)

    conn = get_db_conn()
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
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

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
        conn = get_db_conn()
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

        token = f"{candidate_id}-{level}-{int(datetime.now().timestamp())}"  # Simple token
        send_interview_result_email(
            hr_email=request.user.email if request.user.is_authenticated else 'hr@yourdomain.com',
            interviewer_email=interviewer_email,
            candidate_id = candidate_id,
            interviewer_name=interviewer_name,
            candidate=candidate,
            level=level,
            token=token
        )

        return JsonResponse({
            'success': True,
            'message': 'Interview scheduled successfully'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()


def send_interview_result_email(hr_email, interviewer_email, candidate_id,interviewer_name, candidate, level, token):
    print("send_interview_result_email -> Sending email to interviewer:", interviewer_email)
    print("send_interview_result_email -> Candidate details:", candidate, "candidiate id:", candidate_id)
    print("HR email:", hr_email)
    base_url = "http://127.0.0.1:8000/"
    subject = f"Action Required: Record Interview Result for {candidate['name']} ({level.upper()})"
    result_url = f"{base_url}/record_interview_result/?candidate_id={candidate['candidate_id']}&level={level}&token={token}"
    html_content = render_to_string('interview_result_request.html', {
        'interviewer_name': interviewer_name,
        'candidate': candidate,
        'level': level.upper(),
        'result_url': result_url,
        'hr_email': hr_email,
    })
    msg = MIMEMultipart()
    msg['From'] = hr_email
    msg['To'] = interviewer_email
    msg['Subject'] = subject
    msg.attach(MIMEText(html_content, 'html'))

    # Use your SMTP config here
    gmail_user = 'sant.vihangam@gmail.com'
    gmail_app_password = 'pdsexaeusfdgvqsu'  # Use app password, not your Gmail password

    # Send email via Gmail SMTP
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login(gmail_user, gmail_app_password)
    server.sendmail(gmail_user, interviewer_email, msg.as_string())
    print("send_interview_result_email -> Email sent successfully")
    server.quit()

def record_interview_result_page(request):
    candidate_id = request.GET.get('candidate_id')
    level = request.GET.get('level')
    token = request.GET.get('token')
    # Optionally validate token here
    conn = get_db_conn()
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
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute(f"""
        UPDATE candidates
        SET {level}_result = %s, {level}_comments = %s, updated_at = NOW()
        WHERE candidate_id = %s
    """, (result, comments, candidate_id))
    conn.commit()
    cursor.close()
    conn.close()
    return JsonResponse({'success': True})

from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse

def manage_candidate_status_page(request):
    return render(request, "manage_candidate_status.html")

def manage_candidate_status_data(request):
    search = request.GET.get("search", "")
    page = int(request.GET.get("page", 1))
    limit = 10
    offset = (page - 1) * limit
    conn = get_db_conn()
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
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Invalid method"}, status=405)
    data = json.loads(request.body)
    candidate_id = data.get("candidate_id")
    l1_result = data.get("l1_result")
    l2_result = data.get("l2_result")
    l3_result = data.get("l3_result")
    if not candidate_id:
        return JsonResponse({"success": False, "error": "Candidate ID required"}, status=400)
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE candidates
            SET l1_result=%s, l2_result=%s, l3_result=%s, updated_at=NOW()
            WHERE candidate_id=%s
        """, [l1_result, l2_result, l3_result, candidate_id])
        conn.commit()
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
    print("view_finalized_candidates -> Request method:", request.method)
    name = request.session.get('name', 'Guest')
    return render(request, 'view_finalized_candidates.html', {'name': name})

def api_jds(request):
    conn = get_db_conn()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT jd_id, jd_summary FROM recruitment_jds WHERE jd_status='active'")
    jds = cursor.fetchall()
    cursor.close()
    conn.close()
    return JsonResponse({'jds': jds})

def api_finalized_candidates(request):
    jd_id = request.GET.get('jd_id')
    conn = get_db_conn()
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
    candidate_id = request.GET.get('candidate_id')
    conn = get_db_conn()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM candidates WHERE candidate_id=%s", (candidate_id,))
    candidate = cursor.fetchone()
    cursor.close()
    conn.close()
    return JsonResponse({'details': candidate})

# Python
from django.contrib.auth import logout
from django.shortcuts import render

def logout_page(request):
    logout(request)  # This logs out the user
    return render(request, 'logout.html')

def candidate_profile(request):
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
            conn = get_db_conn()
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

        conn = get_db_conn()
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
    if request.method == 'GET':
        query = request.GET.get('q', '').strip()
        if len(query) < 3:
            return JsonResponse({'results': []})
        conn = get_db_conn()
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
    email = request.session['email'] if 'email' in request.session else None
    print("dashboard_data -> User email:", email)
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="root",
        database="ats"
    )
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
    name = request.session.get('name', 'Guest')
    return render(request, 'offer_letter.html', {'name': name})

from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def generate_offer_letter(request):
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
        conn = get_db_conn()
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
        return JsonResponse({'success': True, 'offer_html': offer_html})
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
import mysql.connector
import csv
from datetime import datetime, timedelta


def team_reports_page(request):
    name = request.session.get('name', 'Guest')
    return render(request, 'team_reports.html', {'name': name})

def team_report_filters(request):
    conn = get_db_conn()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT emp_id, first_name, last_name FROM hr_team_members WHERE status='active'")
    members = [{'id': m['emp_id'], 'name': f"{m['first_name']} {m['last_name']}"} for m in cursor.fetchall()]
    cursor.execute("SELECT company_id, company_name FROM customers")
    customers = [{'id': c['company_id'], 'name': c['company_name']} for c in cursor.fetchall()]
    cursor.close()
    conn.close()
    return JsonResponse({'members': members, 'customers': customers})

def team_reports_api(request):
    team_search = request.GET.get('team_search', '')
    team_member = request.GET.get('team_member')
    jd_status = request.GET.get('jd_status')
    customer = request.GET.get('customer')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    conn = get_db_conn()
    cursor = conn.cursor(dictionary=True)

    # Team Overview
    cursor.execute("SELECT * FROM teams WHERE team_name LIKE %s", (f"%{team_search}%",))
    teams = cursor.fetchall()
    team_ids = [t['team_id'] for t in teams]
    team_overview = []
    for t in teams:
        cursor.execute("SELECT first_name, last_name FROM hr_team_members WHERE emp_id IN (SELECT emp_id FROM team_members WHERE team_id=%s AND role LIKE 'lead%%')", (t['team_id'],))
        lead = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as cnt FROM team_members WHERE team_id=%s", (t['team_id'],))
        members = cursor.fetchone()['cnt']
        team_overview.append({
            'team_name': t['team_name'],
            'team_lead': f"{lead['first_name']} {lead['last_name']}" if lead else '',
            'members': members
        })

    # Recruitment Metrics
    jd_query = "SELECT * FROM recruitment_jds WHERE team_id IN (%s)" % (",".join(str(tid) for tid in team_ids) if team_ids else "0")
    jd_params = []
    if jd_status:
        jd_query += " AND jd_status=%s"
        jd_params.append(jd_status)
    if customer:
        jd_query += " AND company_id=%s"
        jd_params.append(customer)
    if start_date:
        jd_query += " AND created_at >= %s"
        jd_params.append(start_date)
    if end_date:
        jd_query += " AND created_at <= %s"
        jd_params.append(end_date)
    cursor.execute(jd_query, jd_params)
    jds = cursor.fetchall()
    total_jds = len(jds)
    in_progress = sum(1 for jd in jds if jd['jd_status'] == 'active')
    closed = sum(1 for jd in jds if jd['jd_status'] == 'closed')
    closure_times = []
    for jd in jds:
        if jd['jd_status'] == 'closed' and jd['closure_date'] and jd['created_at']:
            closure_times.append((jd['closure_date'] - jd['created_at'].date()).days)
    avg_closure_time = round(sum(closure_times) / len(closure_times), 2) if closure_times else 0

    # Candidate Pipeline
    cand_query = "SELECT * FROM candidates WHERE team_id IN (%s)" % (",".join(str(tid) for tid in team_ids) if team_ids else "0")
    cand_params = []
    if team_member:
        cand_query += " AND hr_member_id=%s"
        cand_params.append(team_member)
    cursor.execute(cand_query, cand_params)
    candidates = cursor.fetchall()
    sourced = len(candidates)
    l1 = sum(1 for c in candidates if c['l1_result'] == 'selected')
    l2 = sum(1 for c in candidates if c['l2_result'] == 'selected')
    l3 = sum(1 for c in candidates if c['l3_result'] == 'selected')
    offered = sum(1 for c in candidates if c['screen_status'] == 'selected')
    accepted = sum(1 for c in candidates if c['screen_status'] == 'selected' and c['l3_result'] == 'selected')
    rejected = sum(1 for c in candidates if c['screen_status'] == 'rejected')

    # Performance Analytics
    conversion_rate = round((offered / sourced) * 100, 2) if sourced else 0
    success_rate = round((accepted / offered) * 100, 2) if offered else 0
    monthly_trends = {'labels': [], 'values': []}
    for i in range(6, 0, -1):
        month_start = (datetime.now().replace(day=1) - timedelta(days=30 * i))
        month_end = (datetime.now().replace(day=1) - timedelta(days=30 * (i - 1)))
        cursor.execute("SELECT COUNT(*) as cnt FROM recruitment_jds WHERE jd_status='closed' AND closure_date >= %s AND closure_date < %s", (month_start.date(), month_end.date()))
        count = cursor.fetchone()['cnt']
        monthly_trends['labels'].append(month_start.strftime('%b %Y'))
        monthly_trends['values'].append(count)

    # Member Contribution
    member_contribution = []
    cursor.execute("SELECT * FROM hr_team_members WHERE emp_id IN (SELECT emp_id FROM team_members WHERE team_id IN (%s))" % (",".join(str(tid) for tid in team_ids) if team_ids else "0"))
    members = cursor.fetchall()
    for m in members:
        # Python
        team_ids_str = ",".join(str(tid) for tid in team_ids) if team_ids else "0"
        cursor.execute(
            f"SELECT COUNT(*) as cnt FROM recruitment_jds WHERE team_id IN ({team_ids_str}) AND created_by=%s",
            (m['emp_id'],)
        )
        jds_handled = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) as cnt FROM candidates WHERE hr_member_id=%s", (m['emp_id'],))
        candidates_processed = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) as cnt FROM candidates WHERE hr_member_id=%s AND screen_status='selected'", (m['emp_id'],))
        offers_made = cursor.fetchone()['cnt']
        top_performer = 'Yes' if offers_made > 5 else ''
        member_contribution.append({
            'name': f"{m['first_name']} {m['last_name']}",
            'jds_handled': jds_handled,
            'candidates_processed': candidates_processed,
            'offers_made': offers_made,
            'top_performer': top_performer
        })

    # Customer Distribution
    cursor.execute("SELECT * FROM customers")
    customers = cursor.fetchall()
    customer_distribution = []
    for c in customers:
        # Python
        team_ids_str = ",".join(str(tid) for tid in team_ids) if team_ids else "0"
        cursor.execute(
            f"SELECT COUNT(*) as cnt FROM recruitment_jds WHERE company_id={c['company_id']} AND team_id IN ({team_ids_str})"
        )
        jds_handled = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) as cnt FROM candidates WHERE jd_id IN (SELECT jd_id FROM recruitment_jds WHERE company_id=%s) AND screen_status='selected'", (c['company_id'],))
        candidates_placed = cursor.fetchone()['cnt']
        customer_distribution.append({
            'customer': c['company_name'],
            'jds_handled': jds_handled,
            'candidates_placed': candidates_placed
        })

    cursor.close()
    conn.close()
    return JsonResponse({
        'team_overview': team_overview,
        'recruitment_metrics': {
            'total_jds': total_jds,
            'in_progress': in_progress,
            'closed': closed,
            'avg_closure_time': avg_closure_time
        },
        'candidate_pipeline': {
            'sourced': sourced,
            'l1': l1,
            'l2': l2,
            'l3': l3,
            'offered': offered,
            'accepted': accepted,
            'rejected': rejected
        },
        'performance_analytics': {
            'conversion_rate': conversion_rate,
            'success_rate': success_rate,
            'monthly_trends': monthly_trends
        },
        'member_contribution': member_contribution,
        'customer_distribution': customer_distribution
    })

def team_reports_export(request):
    team_search = request.GET.get('team_search', '')
    conn = get_db_conn()
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
    name = request.session.get('name', 'Guest')
    return render(request, "task_progress_reports.html", {"name": name})

def team_report_filters(request):
    conn = mysql.connector.connect(host="localhost", user="root", password="root", database="ats")
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT team_id, team_name FROM teams")
    teams = cursor.fetchall()
    cursor.close()
    conn.close()
    return JsonResponse({"teams": teams})

def team_reports_api(request):
    team_id = request.GET.get("team_id")
    jd_status = request.GET.get("jd_status")
    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")
    conn = mysql.connector.connect(host="localhost", user="root", password="root", database="ats")
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

    # Profile Status Breakdown (Pie)
    status_counts = {"toBeScreened": 0, "selected": 0, "rejected": 0, "onHold": 0}
    cursor.execute("SELECT screen_status, COUNT(*) as cnt FROM candidates GROUP BY screen_status")
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
    conn = mysql.connector.connect(host="localhost", user="root", password="root", database="ats")
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
    team_id = request.GET.get("team_id")
    jd_status = request.GET.get("jd_status")
    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")
    conn = mysql.connector.connect(host="localhost", user="root", password="root", database="ats")
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
    conn = mysql.connector.connect(host="localhost", user="root", password="root", database="ats")
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT jd_id, jd_summary FROM recruitment_jds")
    jds = cursor.fetchall()
    cursor.execute("SELECT team_id, team_name FROM teams")
    teams = cursor.fetchall()
    cursor.close()
    conn.close()
    return JsonResponse({"jds": jds, "teams": teams})

def ccr_reports_api(request):
    jd_id = request.GET.get("jd_id")
    team_id = request.GET.get("team_id")
    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")
    conn = mysql.connector.connect(host="localhost", user="root", password="root", database="ats")
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
    stage_data.append(round((row["l1"] / total_screened) * 100, 2))
    stage_data.append(round((row["l2"] / total_l1) * 100, 2))
    stage_data.append(round((row["l3"] / total_l2) * 100, 2))
    stage_data.append(round((row["final_selected"] / total_l3) * 100, 2))

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
        conversion_pct = round((r["final_selected"] / total) * 100, 2) if total else 0
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
    jd_id = request.GET.get("jd_id")
    team_id = request.GET.get("team_id")
    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")
    conn = mysql.connector.connect(host="localhost", user="root", password="root", database="ats")
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