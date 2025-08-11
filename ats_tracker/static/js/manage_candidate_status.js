document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('candidate-search');
    const searchBtn = document.getElementById('search-btn');
    const tableBody = document.querySelector('#candidate-table tbody');
    const paginationDiv = document.getElementById('pagination');
    const statusMessage = document.getElementById('status-message');

    let currentPage = 1;
    let currentSearch = '';

    function loadCandidates(page = 1, search = '') {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
        fetch(`/manage_candidate_status_data/?page=${page}&search=${encodeURIComponent(search)}`)
            .then(res => res.json())
            .then(data => {
                tableBody.innerHTML = '';
                if (data.candidates.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No candidates found.</td></tr>';
                } else {
                    data.candidates.forEach(candidate => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${candidate.name || '-'}</td>
                            <td>${candidate.email || '-'}</td>
                            <td>${candidate.jd_summary || '-'}</td>
                            <td>
                                <select class="status-dropdown" data-candidate="${candidate.candidate_id}" data-level="l1">
                                    ${statusOptions(candidate.l1_result)}
                                </select>
                                ${candidate.l1_date ? `<br><small>${formatDate(candidate.l1_date)}</small>` : ''}
                            </td>
                            <td>
                                <select class="status-dropdown" data-candidate="${candidate.candidate_id}" data-level="l2">
                                    ${statusOptions(candidate.l2_result)}
                                </select>
                                ${candidate.l2_date ? `<br><small>${formatDate(candidate.l2_date)}</small>` : ''}
                            </td>
                            <td>
                                <select class="status-dropdown" data-candidate="${candidate.candidate_id}" data-level="l3">
                                    ${statusOptions(candidate.l3_result)}
                                </select>
                                ${candidate.l3_date ? `<br><small>${formatDate(candidate.l3_date)}</small>` : ''}
                            </td>
                            <td>
                                <button class="btn update-btn" data-candidate="${candidate.candidate_id}">Update</button>
                            </td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }
                renderPagination(data.page, data.num_pages);
            });
    }

    function statusOptions(selected) {
        const statuses = [
            { value: '', label: 'Select' },
            { value: 'toBeScreened', label: 'To Be Screened' },
            { value: 'selected', label: 'Selected' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'onHold', label: 'On Hold' }
        ];
        return statuses.map(s =>
            `<option value="${s.value}" ${selected === s.value ? 'selected' : ''}>${s.label}</option>`
        ).join('');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString();
    }

    function renderPagination(page, numPages) {
        paginationDiv.innerHTML = '';
        for (let i = 1; i <= numPages; i++) {
            const link = document.createElement('span');
            link.className = 'page-link' + (i === page ? ' active' : '');
            link.textContent = i;
            link.addEventListener('click', () => {
                currentPage = i;
                loadCandidates(currentPage, currentSearch);
            });
            paginationDiv.appendChild(link);
        }
    }

    searchBtn.addEventListener('click', function() {
        currentSearch = searchInput.value.trim();
        currentPage = 1;
        loadCandidates(currentPage, currentSearch);
    });

    tableBody.addEventListener('click', function(e) {
        if (e.target.classList.contains('update-btn')) {
            const candidateId = e.target.dataset.candidate;
            const l1Status = tableBody.querySelector(`select[data-candidate="${candidateId}"][data-level="l1"]`).value;
            const l2Status = tableBody.querySelector(`select[data-candidate="${candidateId}"][data-level="l2"]`).value;
            const l3Status = tableBody.querySelector(`select[data-candidate="${candidateId}"][data-level="l3"]`).value;
            statusMessage.textContent = 'Updating...';
            fetch('/update_candidate_status/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidate_id: candidateId,
                    l1_result: l1Status,
                    l2_result: l2Status,
                    l3_result: l3Status
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    statusMessage.textContent = 'Status updated successfully!';
                    loadCandidates(currentPage, currentSearch);
                } else {
                    statusMessage.textContent = 'Error: ' + data.error;
                }
            });
        }
    });

    // Initial load
    loadCandidates();
});