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
        self.conn.commit()
        print("Database, HR team members, and teams tables created.")

    def close(self):
        self.cursor.close()
        self.conn.close()

# Usage
# initializer = ATSDatabaseInitializer()
# initializer.initialize()
# initializer.close()
