document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('resume-upload-form');
    const messageDiv = document.getElementById('upload-message');
    const tableContainer = document.getElementById('resume-table-container');
    let resumes = [];
    let currentPage = 1;
    const pageSize = 10;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        messageDiv.textContent = '';
        const formData = new FormData(form);
        fetch('/api/upload_resume/', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                messageDiv.textContent = 'Resume uploaded successfully!';
                form.reset();
                loadResumes();
            } else {
                messageDiv.textContent = 'Upload failed. Please try again.';
            }
        })
        .catch(() => {
            messageDiv.textContent = 'Error uploading resume.';
        });
    });

    function loadResumes() {
        fetch('/api/recent_resumes/')
        .then(res => res.json())
        .then(data => {
            resumes = data.resumes || [];
            currentPage = 1;
            renderTable();
        });
    }

    function renderTable() {
        if (resumes.length === 0) {
            tableContainer.innerHTML = '<div>No resumes uploaded yet.</div>';
            return;
        }
        let start = (currentPage - 1) * pageSize;
        let end = start + pageSize;
        let pageResumes = resumes.slice(start, end);

        let html = `<table class="resume-table">
            <thead>
                <tr>
                    <th>Resume Name</th>
                    <th>JD ID</th>
                    <th>JD Summary</th>
                    <th>Uploaded On</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Open</th>
                </tr>
            </thead>
            <tbody>`;
        pageResumes.forEach(r => {
            html += `<tr>
                <td>${r.file_name}</td>
                <td>${r.jd_id}</td>
                <td>${r.jd_summary}</td>
                <td>${r.uploaded_on}</td>
                <td>${r.customer}</td>
                <td class="status-${r.status}">${r.status}</td>
                <td><a href="${r.file_url}" target="_blank"><i class="fas fa-file-alt"></i> View</a></td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Pagination
        let totalPages = Math.ceil(resumes.length / pageSize);
        html += `<div class="pagination">`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button ${i === currentPage ? 'class="active"' : ''} onclick="window.changeResumePage(${i})">${i}</button>`;
        }
        html += `</div>`;

        tableContainer.innerHTML = html;
        window.changeResumePage = function(page) {
            currentPage = page;
            renderTable();
        };
    }

    loadResumes();
});