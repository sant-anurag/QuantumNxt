import mysql.connector

class ATSDatabaseInitializer:
    def __init__(self):
        self.conn = mysql.connector.connect(
            host="localhost",
            user="root",
            password="root"
        )
        self.cursor = self.conn.cursor()

    # python
    def initialize(self):
        self.cursor.execute("CREATE DATABASE IF NOT EXISTS ats")
        self.cursor.execute("USE ats")
        self.cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        user_id INT AUTO_INCREMENT PRIMARY KEY,
                        username VARCHAR(50) NOT NULL UNIQUE,
                        email VARCHAR(100) NOT NULL UNIQUE,
                        password_hash VARCHAR(255) NOT NULL,
                        role ENUM('Admin', 'User') NOT NULL DEFAULT 'User',
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS hr_team_members (
                emp_id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(50) NOT NULL,
                last_name VARCHAR(50) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                phone VARCHAR(20) NOT NULL UNIQUE,
                role VARCHAR(100),
                date_joined DATE NOT NULL,
                status ENUM('active', 'inactive', 'on_leave') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS teams (
                team_id INT AUTO_INCREMENT PRIMARY KEY,
                team_name VARCHAR(100) NOT NULL UNIQUE,
                lead_emp_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_emp_id) REFERENCES hr_team_members(emp_id)
            );
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS team_members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                team_id INT NOT NULL,
                emp_id INT NOT NULL,
                FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
                FOREIGN KEY (emp_id) REFERENCES hr_team_members(emp_id) ON DELETE CASCADE,
                UNIQUE(team_id, emp_id)
            );
        """)

       # Add this before recruitment_jds table creation
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                company_id INT AUTO_INCREMENT PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL UNIQUE,
                contact_person_name VARCHAR(100) NOT NULL,
                contact_email VARCHAR(100) NOT NULL,
                contact_phone VARCHAR(20) NOT NULL
            );
        """)

        # Update recruitment_jds table creation
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS recruitment_jds (
                jd_id VARCHAR(20) PRIMARY KEY,
                jd_summary VARCHAR(255) NOT NULL,
                jd_description TEXT NOT NULL,
                must_have_skills TEXT,
                good_to_have_skills TEXT,
                no_of_positions INT DEFAULT 0,
                total_profiles INT DEFAULT 0,
                profiles_in_progress INT DEFAULT 0,
                profiles_completed INT DEFAULT 0,
                profiles_selected INT DEFAULT 0,
                profiles_rejected INT DEFAULT 0,
                profiles_on_hold INT DEFAULT 0,
                jd_status ENUM('active', 'closed', 'on hold') DEFAULT 'active',
                company_id INT,
                team_id INT,
                created_by INT,
                closure_date DATE NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES customers(company_id),
                FOREIGN KEY (team_id) REFERENCES teams(team_id),
                FOREIGN KEY (created_by) REFERENCES users(user_id)
            );
        """)
        # Add this to ATSDatabaseInitializer.initialize() after recruitment_jds table creation
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS resumes (
                resume_id INT AUTO_INCREMENT PRIMARY KEY,
                jd_id VARCHAR(8) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                status ENUM('toBeScreened', 'selected', 'rejected', 'onHold') DEFAULT 'toBeScreened',
                uploaded_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                customer_id INT,
                FOREIGN KEY (jd_id) REFERENCES recruitment_jds(jd_id),
                FOREIGN KEY (customer_id) REFERENCES customers(company_id)
            );
        """)

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS candidates (
                candidate_id INT AUTO_INCREMENT PRIMARY KEY,
                jd_id VARCHAR(20) NOT NULL,
                resume_id INT NOT NULL,
                name VARCHAR(100),
                phone VARCHAR(20),
                email VARCHAR(100),
                skills TEXT,
                experience VARCHAR(20),
                screened_on DATE,
                screen_status ENUM('toBeScreened', 'selected', 'rejected', 'onHold') DEFAULT 'toBeScreened',
                screened_remarks TEXT,
                l1_date DATE,
                l1_result ENUM('toBeScreened', 'selected', 'rejected', 'onHold') DEFAULT 'toBeScreened',
                l1_comments TEXT,
                l1_interviewer_name VARCHAR(100),
                l1_interviewer_email VARCHAR(100),
                l2_date DATE,
                l2_result ENUM('toBeScreened', 'selected', 'rejected', 'onHold') DEFAULT 'toBeScreened',
                l2_comments TEXT,
                l2_interviewer_name VARCHAR(100),
                l2_interviewer_email VARCHAR(100),
                l3_date DATE,
                l3_result ENUM('toBeScreened', 'selected', 'rejected', 'onHold') DEFAULT 'toBeScreened',
                l3_comments TEXT,
                l3_interviewer_name VARCHAR(100),
                l3_interviewer_email VARCHAR(100),
                offer_status ENUM('in_progress', 'released', 'not_initiated') DEFAULT 'in_progress',
                team_id INT,
                hr_member_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (jd_id) REFERENCES recruitment_jds(jd_id),
                FOREIGN KEY (resume_id) REFERENCES resumes(resume_id),
                FOREIGN KEY (hr_member_id) REFERENCES hr_team_members(emp_id),
                FOREIGN KEY (team_id) REFERENCES teams(team_id)
            );
        """)
        self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS offer_letters (
                    offer_id INT AUTO_INCREMENT PRIMARY KEY,
                    candidate_id INT,
                    basic DECIMAL(10,2),
                    hra DECIMAL(10,2),
                    special_allowance DECIMAL(10,2),
                    pf DECIMAL(10,2),
                    gratuity DECIMAL(10,2),
                    bonus DECIMAL(10,2),
                    other DECIMAL(10,2),
                    total_ctc DECIMAL(10,2),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
        self.conn.commit()

        print("Database, HR team members, and teams tables created.")

    def close(self):
        self.cursor.close()
        self.conn.close()

# Usage
# initializer = ATSDatabaseInitializer()
# initializer.initialize()
# initializer.close()
