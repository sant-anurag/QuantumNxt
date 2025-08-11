document.addEventListener('DOMContentLoaded', function() {
    const jdSelect = document.getElementById('jd-select');
    const tableBody = document.querySelector('#finalized-table tbody');
    const modal = document.getElementById('candidate-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const candidateDetailsDiv = document.getElementById('candidate-details');

    // Load JDs for dropdown
    fetch('/api/jds/')
        .then(res => res.json())
        .then(data => {
            jdSelect.innerHTML = data.jds.map(jd =>
                `<option value="${jd.jd_id}">${jd.jd_summary}</option>`
            ).join('');
            if (data.jds.length) {
                loadFinalizedCandidates(data.jds[0].jd_id);
            }
        });

    jdSelect.addEventListener('change', function() {
        loadFinalizedCandidates(jdSelect.value);
    });

    function loadFinalizedCandidates(jdId) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
        fetch(`/api/finalized_candidates/?jd_id=${jdId}`)
            .then(res => res.json())
            .then(data => {
                tableBody.innerHTML = '';
                if (data.candidates.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No finalized candidates found.</td></tr>';
                } else {
                    data.candidates.forEach(candidate => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${candidate.name || '-'}</td>
                            <td>${candidate.email || '-'}</td>
                            <td>${candidate.phone || '-'}</td>
                            <td>${candidate.experience || '-'}</td>
                            <td>
                                <button class="view-details-link" data-id="${candidate.candidate_id}">View Details</button>
                            </td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }
            });
    }

    tableBody.addEventListener('click', function(e) {
        if (e.target.classList.contains('view-details-link')) {
            const candidateId = e.target.dataset.id;
            fetch(`/api/candidate_details/?candidate_id=${candidateId}`)
                .then(res => res.json())
                .then(data => {
                    candidateDetailsDiv.innerHTML = '';
                    Object.entries(data.details).forEach(([key, value]) => {
                        candidateDetailsDiv.innerHTML += `
                        <div class="detail-group">
                            <div class="detail-label">${formatLabel(key)}</div>
                            <div class="detail-value">${value || '-'}</div>
                        </div>
                        `;
                    });
                    modal.style.display = 'flex';
                });
        }
    });

    closeModalBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    function formatLabel(key) {
        // Converts snake_case to Title Case
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
});