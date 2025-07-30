// Fetch JDs for dropdown and initialize page
fetch('/assign_jd_data/')
    .then(res => res.json())
    .then(data => {
        const select = document.getElementById('jd-select');
        data.jds.forEach(jd => {
            const option = document.createElement('option');
            option.value = jd.jd_id;
            option.textContent = `${jd.jd_id} - ${jd.jd_summary}`;
            select.appendChild(option);
        });
        if (select.value) loadResumes(select.value);
        select.onchange = () => loadResumes(select.value);
    });

function loadResumes(jdId) {
    document.getElementById('jd-id').textContent = jdId;
    fetch(`/view_parse_resumes/?jd_id=${jdId}`)
        .then(res => res.json())
        .then(data => {
            renderTable(data.resumes || []);
        });
}

function renderTable(resumes) {
    const tbody = document.querySelector('#resume-table tbody');
    tbody.innerHTML = '';
    resumes.forEach(r => {
        tbody.innerHTML += `
            <tr>
                <td><a href="${r.file_url}" download="${r.file_name}">${r.file_name}</a></td>
                <td>
                    <span class="${r.status}">${r.status}</span>
                </td>
                <td>
                    <button class="icon-btn select-btn" onclick="updateStatus(${r.resume_id}, 'selected')">&#x2714;</button>
                    <button class="icon-btn reject-btn" onclick="updateStatus(${r.resume_id}, 'rejected')">&#x2716;</button>
                </td>
            </tr>
        `;
    });
}

function updateStatus(resumeId, status) {
    fetch('/update_resume_status/', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `resume_id=${resumeId}&status=${status}`
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const select = document.getElementById('jd-select');
            loadResumes(select.value);
        } else {
            alert(data.error);
        }
    });
}

// Parsing button logic
let parsing = false;
document.getElementById('parse-btn').onclick = function() {
    if (!parsing) {
        parsing = true;
        this.textContent = 'Stop Parsing';
        this.title = 'Stop Parsing';
        startParsing();
    } else {
        parsing = false;
        this.textContent = 'Start Parsing';
        this.title = 'Start Parsing';
    }
};

function startParsing() {
    const jdId = document.getElementById('jd-select').value;
    if (!jdId) return;
    fetch(`/start_parse_resumes/?jd_id=${jdId}`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                alert(data.error || 'Parsing failed');
                parsing = false;
                document.getElementById('parse-btn').textContent = 'Start Parsing';
                document.getElementById('parse-btn').title = 'Start Parsing';
                return;
            }
            // Use parsed data to update table
            renderTable(data.resumes || []);
        });
}