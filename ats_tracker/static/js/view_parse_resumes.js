document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const jdSelect = document.getElementById('jd-select');
    const jdIdSpan = document.getElementById('jd-id');
    const startParseBtn = document.getElementById('start-parse-btn');
    const exportBtn = document.getElementById('export-btn');
    const resumeTable = document.getElementById('resume-table').querySelector('tbody');
    const candidateModal = document.getElementById('candidate-modal');
    const candidateForm = document.getElementById('candidate-form');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // State variables
    let currentJdId = null;
    let resumeData = [];
    let isParsing = false;

    // Limit 'Screened On' date to today and restrict 'Shared On' date
    function setupScreenedAndSharedDateLimits() {
        var screenedOnInput = document.getElementById('modal-screened-on');
        var sharedOnInput = document.getElementById('modal-shared-on');
        if (screenedOnInput) {
            var today = new Date().toISOString().split('T')[0];
            screenedOnInput.setAttribute('max', today);
            screenedOnInput.addEventListener('change', function() {
                if (sharedOnInput) {
                    if (screenedOnInput.value) {
                        sharedOnInput.setAttribute('min', screenedOnInput.value);
                    } else {
                        sharedOnInput.removeAttribute('min');
                    }
                }
            });
        }
        // Also set min for shared date on modal open (in case screened date is pre-filled)
        if (sharedOnInput && screenedOnInput && screenedOnInput.value) {
            sharedOnInput.setAttribute('min', screenedOnInput.value);
        }
    }

    // Call setupScreenedAndSharedDateLimits when modal is opened
    if (candidateModal) {
        candidateModal.addEventListener('transitionend', function(e) {
            if (candidateModal.style.display === 'flex') {
                setupScreenedAndSharedDateLimits();
            }
        });
    }
        // Also call after DOMContentLoaded in case modal is already open
    setupScreenedAndSharedDateLimits();


    // Initialize - Load JDs for dropdown
    function loadJDs() {
        fetch('/assign_jd_data/')
            .then(response => response.json())
            .then(data => {
                jdSelect.innerHTML = '<option value="">Select JD</option>';
                data.jds.forEach(jd => {
                    const option = document.createElement('option');
                    option.value = jd.jd_id;
                    option.textContent = `${jd.jd_id} - ${jd.jd_summary}`;
                    jdSelect.appendChild(option);
                });
            })
            .catch(error => console.error('Error loading JDs:', error));
    }

    // Event Listeners
    jdSelect.addEventListener('change', function() {
        currentJdId = this.value;
        jdIdSpan.textContent = currentJdId;
        if (currentJdId) {
            loadResumes(currentJdId);
        } else {
            resumeTable.innerHTML = '';
            resumeData = [];
        }
    });

    startParseBtn.addEventListener('click', function() {
        if (!currentJdId) {
            alert('Please select a JD first');
            return;
        }
        if (isParsing) return;

        isParsing = true;
        startParseBtn.innerHTML = '<span class="spinner"></span> Parsing...';

        fetch(`/parse_resumes/?jd_id=${currentJdId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    resumeData = data.resumes;
                    displayResumes(resumeData);
                } else {
                    alert('Error: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error parsing resumes:', error);
                alert('Failed to parse resumes. See console for details.');
            })
            .finally(() => {
                isParsing = false;
                startParseBtn.innerHTML = '&#128269; Start Parsing';
            });
    });

    exportBtn.addEventListener('click', function() {
        if (!currentJdId) {
            alert('Please select a JD first');
            return;
        }
        window.location.href = `/export_resumes_excel/?jd_id=${currentJdId}`;
    });

    modalCloseBtn.addEventListener('click', function() {
        candidateModal.style.display = 'none';
    });

    modalSaveBtn.addEventListener('click', function() {
        saveCandidateDetails();
    });

    // Load and display resumes for selected JD
    function loadResumes(jdId) {
        resumeTable.innerHTML = '<tr><td colspan="7">Loading resumes...</td></tr>';

        fetch(`/view_parse_resumes/?jd_id=${jdId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    resumeData = data.resumes;
                    displayResumes(resumeData);
                } else {
                    resumeTable.innerHTML = `<tr><td colspan="7">Error: ${data.error}</td></tr>`;
                }
            })
            .catch(error => {
                console.error('Error loading resumes:', error);
                resumeTable.innerHTML = '<tr><td colspan="7">Failed to load resumes</td></tr>';
            });
    }

    // Display resumes in table
    function displayResumes(resumes) {
        if (!resumes || resumes.length === 0) {
            resumeTable.innerHTML = '<tr><td colspan="7">No resumes found for this JD</td></tr>';
            return;
        }

        resumeTable.innerHTML = '';

        resumes.forEach(resume => {
            const tr = document.createElement('tr');

            // File Name column
            const fileNameTd = document.createElement('td');
            fileNameTd.className = 'file-name-col';
            const fileLink = document.createElement('a');
            fileLink.href = resume.file_url;
            fileLink.textContent = resume.file_name;
            fileLink.target = '_blank';
            fileNameTd.appendChild(fileLink);
            tr.appendChild(fileNameTd);

            // Name column
            const nameTd = document.createElement('td');
            nameTd.className = 'name-col';
            nameTd.textContent = resume.name || '-';
            tr.appendChild(nameTd);

            // Contact column
            const contactTd = document.createElement('td');
            contactTd.textContent = resume.phone || '-';
            tr.appendChild(contactTd);

            // Email column
            const emailTd = document.createElement('td');
            emailTd.textContent = resume.email || '-';
            tr.appendChild(emailTd);

            // Experience column
            const expTd = document.createElement('td');
            expTd.textContent = resume.experience || '-';
            tr.appendChild(expTd);

            // Status column
            const statusTd = document.createElement('td');
            let statusText = resume.status;
            if (statusText === 'toBeScreened') statusText = 'To Be Screened';
            else if (statusText === 'selected') statusText = 'Selected';
            else if (statusText === 'rejected') statusText = 'Rejected';
            else if (statusText === 'onHold') statusText = 'On Hold';
            statusTd.textContent = statusText;
            tr.appendChild(statusTd);

            // Actions column
            const actionsTd = document.createElement('td');

            // Record details button
            const recordBtn = document.createElement('button');
            recordBtn.innerHTML = '&#9998;';
            recordBtn.className = 'icon-btn record-btn';
            recordBtn.title = 'Record Details';
            recordBtn.dataset.resumeId = resume.resume_id;
            recordBtn.addEventListener('click', function() {
                openCandidateModal(resume);
            });
            actionsTd.appendChild(recordBtn);

            tr.appendChild(actionsTd);
            resumeTable.appendChild(tr);
        });
    }

    // Update resume status (select/reject)
    function updateResumeStatus(resumeId, status) {
        const formData = new FormData();
        formData.append('resume_id', resumeId);
        formData.append('status', status);

        fetch('/update_resume_status/', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update local data and UI
                const resume = resumeData.find(r => r.resume_id == resumeId);
                if (resume) {
                    resume.status = status;
                    loadResumes(currentJdId); // Reload to reflect changes
                }
            } else {
                alert('Error: ' + data.error);
            }
        })
        .catch(error => {
            console.error('Error updating status:', error);
        });
    }

    // Open candidate modal for recording details
    function openCandidateModal(resume) {
        // Fetch team members for the current JD
        fetch(`/get_jd_team_members/?jd_id=${currentJdId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Populate HR member dropdown
                    const hrMemberSelect = document.getElementById('modal-hr-member-id');
                    hrMemberSelect.innerHTML = '<option value="">Select HR Member</option>';
                    data.members.forEach(member => {
                        const option = document.createElement('option');
                        option.value = member.emp_id;
                        option.textContent = `${member.first_name} ${member.last_name}`;
                        hrMemberSelect.appendChild(option);
                    });

                    // Set team info
                    document.getElementById('modal-screening-team').value = data.team_id || '';

                    // Check if candidate details already exist
                    fetch(`/get_candidate_details/?resume_id=${resume.resume_id}`)
                        .then(response => response.json())
                        .then(candidateData => {
                            // Set form fields
                            document.getElementById('modal-resume-id').value = resume.resume_id;
                            document.getElementById('modal-jd-id').value = currentJdId;
                            document.getElementById('modal-team-id').value = data.team_id || '';

                            // Fill in form with existing data or resume data
                            if (candidateData.success && candidateData.candidate) {
                                const c = candidateData.candidate;
                                document.getElementById('modal-name').value = c.name || resume.name || '';
                                document.getElementById('modal-phone').value = c.phone || resume.phone || '';
                                document.getElementById('modal-email').value = c.email || resume.email || '';
                                document.getElementById('modal-skills').value = c.skills || '';
                                document.getElementById('modal-experience').value = c.experience || resume.experience || '';
                                document.getElementById('modal-screened-on').value = c.screened_on || '';
                                document.getElementById('modal-screen-status').value = c.screen_status || 'toBeScreened';
                                document.getElementById('modal-screened-remarks').value = c.screened_remarks || '';
                                document.getElementById('modal-shared-on').value = c.shared_on || '';

                                if (c.hr_member_id) {
                                    document.getElementById('modal-hr-member-id').value = c.hr_member_id;
                                }
                            } else {
                                // No existing data, use parsed resume data
                                document.getElementById('modal-name').value = resume.name || '';
                                document.getElementById('modal-phone').value = resume.phone || '';
                                document.getElementById('modal-email').value = resume.email || '';
                                document.getElementById('modal-skills').value = '';
                                document.getElementById('modal-experience').value = resume.experience || '';
                                document.getElementById('modal-screened-on').value = '';
                                document.getElementById('modal-screen-status').value = 'toBeScreened';
                                document.getElementById('modal-screened-remarks').value = '';
                                document.getElementById('modal-hr-member-id').value = '';
                            }

                            // Display modal
                            candidateModal.style.display = 'flex';
                        });
                }
            })
            .catch(error => {
                console.error('Error fetching team members:', error);
            });
    }

    // Save candidate details from modal
    function saveCandidateDetails() {
        const candidateData = {
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
            screening_team: document.getElementById('modal-team-id').value,
            hr_member_id: document.getElementById('modal-hr-member-id').value,
            shared_on: document.getElementById('modal-shared-on').value
        };

        fetch('/save_candidate_details/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(candidateData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                candidateModal.style.display = 'none';
                // Update resume status to match screen status
                updateResumeStatus(candidateData.resume_id, candidateData.screen_status);
                // Reload resumes to reflect changes
                loadResumes(currentJdId);
            } else {
                alert('Error: ' + data.error);
            }
        })
        .catch(error => {
            console.error('Error saving candidate details:', error);
            alert('Failed to save candidate details');
        });
    }

    // Initialize
    loadJDs();

    // Close modal if clicked outside
    window.addEventListener('click', function(event) {
        if (event.target === candidateModal) {
            candidateModal.style.display = 'none';
        }
    });
});