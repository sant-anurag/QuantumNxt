// Modular JS for rendering candidate tables per JD/company
// Assumes data is available as a JS object (from AJAX response)

function renderCandidateTables(listOfCandidates) {
    const container = document.getElementById('candidateTablesContainer');
    container.innerHTML = '';
    if (!listOfCandidates || listOfCandidates.length === 0) {
        container.innerHTML = '<div class="sr-msg">No candidate data found.</div>';
        return;
    }
    listOfCandidates.forEach((entry, idx) => {
        // Create a wrapper for metadata and table
        const blockDiv = document.createElement('div');
        blockDiv.className = 'candidate-block';

        // Metadata block
        const meta = entry.metadata || {};
        const metaDiv = document.createElement('div');
        metaDiv.className = 'candidate-meta';
        metaDiv.innerHTML = `
            <div class="meta-block">
                <div><strong>Date/Range:</strong> ${meta.date_or_date_range || ''}</div>
                <div><strong>Company:</strong> ${meta.company_name || ''}</div>
                <div><strong>JD:</strong> ${meta.jd_summary || ''}</div>
            </div>
        `;
        blockDiv.appendChild(metaDiv);

        // Candidate table
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'candidate-table-wrapper';
        const table = document.createElement('table');
        table.className = 'candidate-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Sr.No</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Experience</th>
                    <th>Current CTC</th>
                    <th>Expected CTC</th>
                    <th>Notice Period</th>
                    <th>Profile</th>
                    <th>Location</th>
                    <th>Shared On</th>
                    <th>Recruiter Comments</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        const candidates = entry.candidates || [];
        if (candidates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No candidates found.</td></tr>';
        } else {
            candidates.forEach((cand, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${i + 1}</td>
                    <td>${cand.name || ''}</td>
                    <td>${cand.email || ''}</td>
                    <td>${cand.phone || ''}</td>
                    <td>${cand.experience || ''}</td>
                    <td>${cand.current_ctc !== null ? cand.current_ctc : ''}</td>
                    <td>${cand.expected_ctc !== null ? cand.expected_ctc : ''}</td>
                    <td>${cand.notice_period !== null ? cand.notice_period : ''}</td>
                    <td>${cand.profile || ''}</td>
                    <td>${cand.location || ''}</td>
                    <td>${cand.shared_on || ''}</td>
                    <td>${cand.recruiter_comments || ''}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        tableWrapper.appendChild(table);
        blockDiv.appendChild(tableWrapper);
        container.appendChild(blockDiv);
    });
}

// Example usage: after AJAX response
// renderCandidateTables(data.list_of_candidates);

// Optionally, you can call this from your main AJAX handler
// and add a <div id="candidateTablesContainer"></div> to your HTML
