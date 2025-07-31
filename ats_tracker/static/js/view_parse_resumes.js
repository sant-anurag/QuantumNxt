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
                <td class="file-name-col"><a href="${r.file_url}" download="${r.file_name}">${r.file_name}</a></td>
                <td>${r.name || ''}</td>
                <td>${r.phone || ''}</td>
                <td>${r.email || ''}</td>
                <td>${r.experience || ''}</td>
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

document.getElementById('export-btn').onclick = function() {
    const jdId = document.getElementById('jd-select').value;
    if (!jdId) return;
    window.location.href = `/export_resumes_excel/?jd_id=${jdId}`;
};


const startBtn = document.getElementById('start-parse-btn');
const exportBtn = document.getElementById('export-btn');
let parsingInProgress = false;

startBtn.onclick = function() {
    if (parsingInProgress) return; // Prevent double click
    parsingInProgress = true;
    startBtn.innerHTML = `<span class="spinner"></span> Stop Parsing`;
    startBtn.disabled = true;
    exportBtn.disabled = true;

    const jdId = document.getElementById('jd-select').value;
    if (!jdId) return;

    fetch(`/parse_resumes/?jd_id=${jdId}`)
        .then(res => res.json())
        .then(data => {
            renderTable(data.resumes || []);
        })
        .finally(() => {
            parsingInProgress = false;
            startBtn.innerHTML = `&#128269; Start Parsing`;
            startBtn.disabled = false;
            exportBtn.disabled = false;
        });
};