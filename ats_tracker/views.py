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
from django.utils.html import escape

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
    search = request.GET.get("search", "")
    page = int(request.GET.get("page", 1))
    limit = 10
    offset = (page - 1) * limit
    conn = get_db()
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
            conn = get_db()
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
            conn = get_db()
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
    conn = get_db()
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
                conn = get_db_connection_ats()
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
