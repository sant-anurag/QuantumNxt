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
                `<option value="${jd.jd_id}">${jd.jd_id} - ${jd.jd_summary}</option>`
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
                    renderCandidateDetails(data.details);
                    modal.style.display = 'flex';
                });
        }
    });

    function renderCandidateDetails(details) {
        candidateDetailsDiv.innerHTML = '';
        
        // Organize data into logical sections
        const sections = [
            {
                title: 'General Information',
                icon: 'info',
                fields: ['allocated_to', 'team_name', 'jd_id', 'candidate_id']
            },
            {
                title: 'Personal Information',
                icon: 'user',
                fields: [ 'name', 'email', 'phone', 'location']
            },
            {
                title: 'Professional Details',
                icon: 'briefcase',
                fields: [ 'previous_job_profile', 'notice_period']
            },
            {
                title: 'Skills & Qualifications',
                icon: 'code',
                fields: ['experience', 'relevant_experience', 'skills', 'education']
            },
            {
                title: "Salary Information",
                icon: "dollar-sign",
                fields: ['current_ctc', 'current_ctc_basis', 'expected_ctc', 'expected_ctc_basis']
            },
            {
                title: 'Application Status',
                icon: 'clipboard-check',
                fields: ['screen_status', 'l1_result', 'l2_result', 'l3_result', 'offer_status', 'joining_status']
            },
            {
                title: 'Comments & Feedback',
                icon: 'comments',
                fields: ['screened_remarks', 'l1_comments', 'l2_comments', 'l3_comments', 'joining_comments', 'recruiter_comments']
            },
            {
                title: 'Timeline Information',
                icon: 'clock',
                fields: ['created_at', 'updated_at', 'shared_on', 'screened_on', 'l1_date', 'l2_date', 'l3_date', 'joining_date']
            }
        ];

        sections.forEach(section => {
            // Check if section has any non-empty fields
            const sectionFields = section.fields.filter(field => 
                details[field] && details[field] !== null && details[field].toString().trim() !== ''
            );
            
            if (sectionFields.length > 0) {
                const sectionDiv = document.createElement('div');
                sectionDiv.className = 'candidate-info-section';
                
                sectionDiv.innerHTML = `
                    <div class="section-header">
                        <h4 class="section-title">${section.title}</h4>
                    </div>
                    <div class="section-content">
                        <div class="details-grid">
                            ${sectionFields.map(field => createDetailGroup(field, details[field])).join('')}
                        </div>
                    </div>
                `;
                
                candidateDetailsDiv.appendChild(sectionDiv);
            }
        });

        // Add any remaining fields that weren't categorized
        const categorizedFields = sections.flatMap(s => s.fields);
        const remainingFields = Object.keys(details).filter(key => !categorizedFields.includes(key));
        
        if (remainingFields.length > 0) {
            const otherSection = document.createElement('div');
            otherSection.className = 'candidate-info-section';
            
            otherSection.innerHTML = `
                <div class="section-header">
                    <h4 class="section-title">Additional Information</h4>
                </div>
                <div class="section-content">
                    <div class="details-grid">
                        ${remainingFields.map(field => createDetailGroup(field, details[field])).join('')}
                    </div>
                </div>
            `;
            
            candidateDetailsDiv.appendChild(otherSection);
        }
    }

    function createDetailGroup(key, value) {
        const formattedValue = formatValue(key, value);
        const isEmpty = !value || value.toString().trim() === '';
        
        return `
            <div class="detail-group">
                <div class="detail-label">${formatLabel(key)}</div>
                <div class="detail-value ${isEmpty ? 'empty' : ''}">${formattedValue}</div>
            </div>
        `;
    }

    function formatValue(key, value) {
        if (!value || value.toString().trim() === '') {
            return 'Not specified';
        }
        
        // Handle candidate_id specifically - don't format as date
        if (key === 'candidate_id') {
            return value.toString();
        }
        
        // Format status fields with appropriate styling
        if (key.includes('status') || key.includes('result')) {
            const statusClass = getStatusClass(value);
            return `<span class="${statusClass}">${value}</span>`;
        }
        
        // Format dates (but exclude candidate_id and other ID fields)
        if ((key.includes('date') || key.includes('_at')) && !key.includes('_id')) {
            try {
                const date = new Date(value);
                // Check if it's a valid date
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                } else {
                    return value;
                }
            } catch (e) {
                return value;
            }
        }
        
        // Format long text fields
        if (key.includes('comments') || key.includes('remarks')) {
            return value.length > 100 ? value.substring(0, 100) + '...' : value;
        }
        
        return value;
    }

    function getStatusClass(value) {
        if (!value) return '';
        
        const val = value.toString().toLowerCase();
        if (val.includes('selected') || val.includes('approved') || val.includes('passed')) {
            return 'status-approved';
        } else if (val.includes('rejected') || val.includes('failed')) {
            return 'status-rejected';
        } else {
            return 'status-pending';
        }
    }

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