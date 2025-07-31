import os
import re
from datetime import datetime
import spacy
import pdfplumber
from docx import Document

class ResumeParser:
    def __init__(self):
        self.nlp = spacy.load('en_core_web_sm')
        self.PHONE_REGEX = r'(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?(\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{0,4})'
        self.EMAIL_REGEX = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        self.SKILL_HEADERS = [
            'skills', 'technical skills', 'core competencies', 'highlights', 'technologies',
            'expertise', 'toolbox', 'proficiencies', 'skill set', 'programming languages',
            'it skills', 'areas of strength', 'abilities', 'capabilities', 'qualifications'
        ]
        self.EXP_HEADERS = [
            'experience', 'professional experience', 'employment history', 'work history',
            'career', 'relevant experience', 'project experience', 'professional background',
            'industry experience', 'work experience', 'job history', 'positions held'
        ]
        self.EXPERIENCE_REGEX = re.compile(
            r'(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?'
            r'((?:19|20)\d{2})'
            r'\s*[-–to]+\s*'
            r'(Present|present|'
            r'(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?'
            r'((?:19|20)\d{2}))'
        )

    def extract_text_from_pdf(self, pdf_path):
        text = ''
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                if page.extract_text():
                    text += page.extract_text() + '\n'
        return text

    def extract_text_from_docx(self, docx_path):
        doc = Document(docx_path)
        return '\n'.join([para.text for para in doc.paragraphs])

    def extract_name(self, text):
        lines = text.splitlines()
        filtered_lines = [
            line.strip() for line in lines
            if not re.search(self.EMAIL_REGEX, line)
            and not re.search(self.PHONE_REGEX, line)
            and not re.search(r'address|email|phone|contact|mobile|linkedin|github', line, re.I)
            and 2 < len(line.strip()) < 50
        ]

        filtered_text = "\n".join(filtered_lines[:15])
        doc = self.nlp(filtered_text)

        names = [
            ent.text.strip() for ent in doc.ents
            if ent.label_ == "PERSON"
            and 2 <= len(ent.text.split()) <= 4
            and not any(word.lower() in ent.text.lower() for word in ['language', 'engineer', 'developer', 'technologies'])
        ]

        if not names:
            for line in filtered_lines[:10]:
                if line.isupper() and 1 < len(line.split()) <= 3:
                    names.append(line.title())

        return max(names, key=len) if names else ""

    def extract_contact(self, text):
        matches = re.findall(self.PHONE_REGEX, text)
        all_numbers = [''.join([g for g in match if g]) for match in matches if any(g for g in match)]
        for number in all_numbers:
            if 9 < len(re.sub(r'\D', '', number)) < 15:
                return number
        return ""

    def extract_email(self, text):
        match = re.search(self.EMAIL_REGEX, text)
        return match.group() if match else ""

    def extract_skills(self, text):
        lines = text.lower().split('\n')
        for i, line in enumerate(lines):
            for header in self.SKILL_HEADERS:
                if header in line:
                    section = []
                    for j in range(1, 5):
                        if i + j < len(lines):
                            if any(h in lines[i+j] for h in self.SKILL_HEADERS + self.EXP_HEADERS): break
                            section.append(lines[i+j])
                    if section:
                        doc = self.nlp(' '.join(section))
                        skills = set(chunk.text.strip() for chunk in doc.noun_chunks if len(chunk.text.strip()) > 1)
                        return ', '.join(skills)
        return ""

    def extract_experience_years(self, text):
        current_year = datetime.now().year
        total_experience = 0
        matches = self.EXPERIENCE_REGEX.findall(text)
        for match in matches:
            start_month = match[0]
            start_year = match[1]
            if match[2].lower() == 'present':
                end_year = str(current_year)
            else:
                if len(match) > 4 and match[4].isdigit():
                    end_year = match[4]
                else:
                    end_year = match[2]
            try:
                sy = int(start_year)
                ey = int(end_year)
                if 1960 < sy <= current_year and 1960 < ey <= current_year and ey >= sy:
                    total_experience += (ey - sy)
            except Exception:
                continue
        if total_experience == 0:
            match = re.search(r'(\d+)\+?\s*(years|yrs)', text, re.IGNORECASE)
            if match:
                try:
                    total_experience = int(match.group(1))
                except:
                    pass
        return total_experience

    def parse_resume(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            text = self.extract_text_from_pdf(file_path)
        elif ext in ['.doc', '.docx']:
            text = self.extract_text_from_docx(file_path)
        else:
            return None
        return {
            'Name': self.extract_name(text),
            'Contact Number': self.extract_contact(text),
            'Email': self.extract_email(text),
            'Work Experience (Years)': self.extract_experience_years(text)
        }

