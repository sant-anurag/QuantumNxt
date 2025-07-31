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
            renderTable(data.resumes || [], jdId); // Pass jdId as argument
        });
}

function renderTable(resumes, jdId) {
    console.log('Rendering table with resumes:', resumes);
    const tbody = document.querySelector('#resume-table tbody');
    tbody.innerHTML = '';
    resumes.forEach(r => {
        const resumeJdId = r.jd_id || jdId; // Use jdId if missing
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

                   <button class="icon-btn record-btn"
                        onclick="handleRecordBtnClick(
                            ${r.resume_id},
                            '${resumeJdId}',
                            '${escapeHtml(r.name)}',
                            '${escapeHtml(r.phone).replace(/\n/g, '')}',
                            '${escapeHtml(r.email)}',
                            '${escapeHtml(r.experience)}'
                        )"
                        title="Record Details">&#x1F4DD;
                    </button>
                    </button>
                 </td>
            </tr>
        `;
    });
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/["'<>]/g, function(c) {
        return {'"':'&quot;', "'":'&#39;', '<':'&lt;', '>':'&gt;'}[c];
    });
}

// Modal logic
function openCandidateModal(resumeId, jdId, name, phone, email, experience) {
    const modal = document.getElementById('candidate-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-resume-id').value = resumeId || '';
    document.getElementById('modal-jd-id').value = jdId || '';
    document.getElementById('modal-name').value = name || '';
    document.getElementById('modal-phone').value = phone || '';
    document.getElementById('modal-email').value = email || '';
    document.getElementById('modal-experience').value = experience || '';
    // Clear other fields
    document.getElementById('modal-skills').value = '';
    document.getElementById('modal-screened-on').value = '';
    document.getElementById('modal-screen-status').value = 'toBeScreened';
    document.getElementById('modal-screened-remarks').value = '';
    document.getElementById('modal-l1-date').value = '';
    document.getElementById('modal-l1-result').value = '';
    document.getElementById('modal-l1-comments').value = '';
    document.getElementById('modal-l2-date').value = '';
    document.getElementById('modal-l2-result').value = '';
    document.getElementById('modal-l2-comments').value = '';
    document.getElementById('modal-l3-date').value = '';
    document.getElementById('modal-l3-result').value = '';
    document.getElementById('modal-l3-comments').value = '';
    document.getElementById('modal-screening-team').value = '';
    document.getElementById('modal-hr-member-id').value = '';
}

document.getElementById('modal-close-btn').onclick = function() {
    document.getElementById('candidate-modal').style.display = 'none';
};

document.getElementById('modal-save-btn').onclick = function() {
    const payload = {
        resume_id: document.getElementById('modal-resume-id').value,
        jd_id: document.getElementById('modal-jd-id').value,
        name: document.getElementById('modal-name').value,
        phone: document.getElementById('modal-phone').value,
        email: document.getElementById('modal-email').value,
        skills: document.getElementById('modal-skills').value,
        experience: document.getElementById('modal-experience').value,
        screened_on: document.getElementById('modal-screened-on').value,
        screen_status: document.getElementById('modal-screen-status').value,
        screened_remarks: document.getElementById('modal-screened-remarks').value,
        l1_date: document.getElementById('modal-l1-date').value,
        l1_result: document.getElementById('modal-l1-result').value,
        l1_comments: document.getElementById('modal-l1-comments').value,
        l2_date: document.getElementById('modal-l2-date').value,
        l2_result: document.getElementById('modal-l2-result').value,
        l2_comments: document.getElementById('modal-l2-comments').value,
        l3_date: document.getElementById('modal-l3-date').value,
        l3_result: document.getElementById('modal-l3-result').value,
        l3_comments: document.getElementById('modal-l3-comments').value,
        screening_team: document.getElementById('modal-screening-team').value,
        hr_member_id: document.getElementById('modal-hr-member-id').value
    };
    fetch('/save_candidate_details/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('candidate-modal').style.display = 'none';
            const select = document.getElementById('jd-select');
            loadResumes(select.value);
        } else {
            alert(data.error || 'Failed to save candidate details.');
        }
    });
};

function updateStatus(resumeId, status) {
    fetch('/update_resume_status/', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `resume_id=${resumeId}&status=${status}`
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Update candidate screen status as well
            fetch('/update_candidate_screen_status/', {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: `resume_id=${resumeId}&status=${status}`
            }).then(() => {
                const select = document.getElementById('jd-select');
                loadResumes(select.value);
            });
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
    if (parsingInProgress) return;
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

function handleRecordBtnClick(resume_id, jd_id, name, phone, email, experience) {
    console.log('Open Modal:', {
        resume_id,
        jd_id,
        name,
        phone,
        email,
        experience
    });
    openCandidateModal(resume_id, jd_id, name, phone, email, experience);
}
window.handleRecordBtnClick = handleRecordBtnClick;
window.updateStatus = updateStatus;