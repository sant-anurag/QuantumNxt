// Fetch JDs for dropdown
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
        // Load resumes for first JD
        if (select.value) loadResumes(select.value);
        select.onchange = () => loadResumes(select.value);
    });

function loadResumes(jdId) {
    document.getElementById('jd-id').textContent = jdId;
    fetch(`/view_parse_resumes/?jd_id=${jdId}`)
        .then(res => res.json())
        .then(data => {
            const tbody = document.querySelector('#resume-table tbody');
            tbody.innerHTML = '';
            if (!data.success) return;
            data.resumes.forEach(r => {
                tbody.innerHTML += `
                    <tr>
                        <td><a href="${r.file_url}" download="${r.file_name}">${r.file_name}</a></td>
                        <td>${r.name || ''}</td>
                        <td>${r.email || ''}</td>
                        <td>${r.phone || ''}</td>
                        <td>${r.experience || ''}</td>
                        <td>${r.summary || ''}</td>
                        <td>
                            <span class="${r.status}">${r.status}</span>
                        </td>
                        <td>
                            <button onclick="updateStatus(${r.resume_id}, 'selected')">Select</button>
                            <button onclick="updateStatus(${r.resume_id}, 'rejected')">Reject</button>
                        </td>
                    </tr>
                `;
            });
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
            // Reload resumes for current JD
            const select = document.getElementById('jd-select');
            loadResumes(select.value);
        } else {
            alert(data.error);
        }
    });
}