import mysql.connector
from ats_tracker.utils import DataOperations

class ATSDatabaseInitializer:
    def __init__(self):
        self.conn = DataOperations.get_db_connection()
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
                        role ENUM('SuperUser', 'Admin', 'User', 'Team_Lead') NOT NULL DEFAULT 'User',
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            session_id VARCHAR(128) PRIMARY KEY,
            user_id INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
        """)


        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                notifications_enabled BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE(user_id)
            );
        """)

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                email_smtp_host VARCHAR(255) NOT NULL,
                email_smtp_port INT DEFAULT 587,
                email_host_password VARCHAR(255) NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
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

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                notification_id INT AUTO_INCREMENT PRIMARY KEY,
                notification_type ENUM('Candidate', 'Job', 'Team', 'General', 'system', 'Interview Result') NOT NULL,
                created_by VARCHAR(100) NOT NULL DEFAULT 'system',
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );
        """)
       # Add this before recruitment_jds table creation
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                company_id INT AUTO_INCREMENT PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL UNIQUE,
                contact_person_name VARCHAR(100) NOT NULL,
                contact_email VARCHAR(100) NOT NULL,
                contact_phone VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                note TEXT
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
                budget_ctc VARCHAR(50) DEFAULT 'Market Standard',
                experience_required VARCHAR(255),
                education_required VARCHAR(255),
                location VARCHAR(255),
                total_profiles INT DEFAULT 0,
                profiles_in_progress INT DEFAULT 0,
                profiles_completed INT DEFAULT 0,
                profiles_selected INT DEFAULT 0,
                profiles_rejected INT DEFAULT 0,
                profiles_on_hold INT DEFAULT 0,
                jd_status ENUM('active', 'closed', 'on hold') DEFAULT 'active',
                company_id INT NOT NULL,
                team_id INT,
                created_by INT,
                closure_date DATE NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES customers(company_id) ON DELETE CASCADE,
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
                FOREIGN KEY (jd_id) REFERENCES recruitment_jds(jd_id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES customers(company_id) ON DELETE CASCADE
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
                education VARCHAR(255),
                experience VARCHAR(20),
                current_ctc DECIMAL(10, 2),
                expected_ctc DECIMAL(10, 2),
                notice_period INT,
                previous_job_profile VARCHAR(255),
                location VARCHAR(255),
                recruiter_comments TEXT,
                shared_on DATE,
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
                offer_status ENUM('in_progress', 'released', 'not_initiated', 'accepted', 'declined') DEFAULT 'in_progress',
                candidate_note TEXT,
                team_id INT,
                hr_member_id INT,
                UNIQUE KEY unique_jd_phone (jd_id, phone),
                UNIQUE KEY unique_jd_email (jd_id, email),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (jd_id) REFERENCES recruitment_jds(jd_id) ON DELETE CASCADE,
                FOREIGN KEY (resume_id) REFERENCES resumes(resume_id) ON DELETE CASCADE,
                FOREIGN KEY (hr_member_id) REFERENCES hr_team_members(emp_id),
                FOREIGN KEY (team_id) REFERENCES teams(team_id)
            );
        """)

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS candidate_activities (
            activity_id INT AUTO_INCREMENT PRIMARY KEY,
                candidate_id INT NOT NULL,
                emp_id INT NOT NULL,
                activity_type ENUM('screening', 'interview', 'offer', 'rejection', 'onboarding', 'other') DEFAULT 'other',
                activity_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE,
                FOREIGN KEY (emp_id) REFERENCES hr_team_members(emp_id) ON DELETE CASCADE
            );
        """)
        # Need to work on views for this table
        self.cursor.execute("""
                            CREATE TABLE IF NOT EXISTS interviews (
                                interview_id INT AUTO_INCREMENT PRIMARY KEY,
                                candidate_id INT NOT NULL,
                                jd_id VARCHAR(20) NOT NULL,
                                interview_level ENUM('L1', 'L2', 'L3') NOT NULL,
                                interviewer_name VARCHAR(100),
                                interviewer_email VARCHAR(100),
                                scheduled_date DATETIME,
                                status ENUM('scheduled', 'completed', 'canceled') DEFAULT 'scheduled',
                                feedback TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE,
                                FOREIGN KEY (jd_id) REFERENCES recruitment_jds(jd_id) ON DELETE CASCADE
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
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE
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
