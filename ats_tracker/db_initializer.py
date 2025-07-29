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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                jd_id VARCHAR(8) PRIMARY KEY,
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
        self.conn.commit()
        print("Database, HR team members, and teams tables created.")

    def close(self):
        self.cursor.close()
        self.conn.close()

# Usage
# initializer = ATSDatabaseInitializer()
# initializer.initialize()
# initializer.close()
