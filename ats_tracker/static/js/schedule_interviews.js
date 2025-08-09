document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const jdSelect = document.getElementById('jd-select');
    const candidatesTable = document.getElementById('candidates-table').querySelector('tbody');
    const scheduleModal = document.getElementById('schedule-modal');
    const scheduleForm = document.getElementById('schedule-form');
    const closeModalBtn = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const scheduleBtn = document.getElementById('schedule-btn');
    const modalMessage = document.getElementById('modal-message');
    const schedule_btn = document.getElementById('schedule-btn');
        const meetingLinkSent = document.getElementById('meeting-link-sent');
    schedule_btn.disabled = true;

    // State variables
    let currentJdId = null;
    let candidates = [];

    // Load JDs for dropdown
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

    // Load candidates for selected JD
    function loadCandidates(jdId) {
        candidatesTable.innerHTML = '<tr><td colspan="9" class="text-center">Loading candidates...</td></tr>';

        fetch(`/get_candidates_for_jd/?jd_id=${jdId}`)
            .then(response => response.json())
            .then(data => {
                candidates = data.candidates;

                // Check if we have a message to display
                if (data.message) {
                    candidatesTable.innerHTML = `<tr><td colspan="9" class="text-center">${data.message}</td></tr>`;
                    return;
                }

                if (candidates.length === 0) {
                    candidatesTable.innerHTML = '<tr><td colspan="9" class="text-center">No selected candidates found for this JD</td></tr>';
                    return;
                }

                candidatesTable.innerHTML = '';
                candidates.forEach(candidate => {
                    const tr = document.createElement('tr');

                    // Name column
                    const nameTd = document.createElement('td');
                    nameTd.textContent = candidate.name || '-';
                    tr.appendChild(nameTd);

                    // Email column
                    const emailTd = document.createElement('td');
                    emailTd.textContent = candidate.email || '-';
                    tr.appendChild(emailTd);

                    // Phone column
                    const phoneTd = document.createElement('td');
                    phoneTd.textContent = candidate.phone || '-';
                    tr.appendChild(phoneTd);

                    // Experience column
                    const expTd = document.createElement('td');
                    expTd.textContent = candidate.experience || '-';
                    tr.appendChild(expTd);

                    // Screen Status column
                    const screenTd = document.createElement('td');
                    let screenStatus = candidate.screen_status;
                    if (screenStatus === 'toBeScreened') screenStatus = 'To Be Screened';
                    else if (screenStatus === 'selected') screenStatus = 'Selected';
                    else if (screenStatus === 'rejected') screenStatus = 'Rejected';
                    else if (screenStatus === 'onHold') screenStatus = 'On Hold';
                    screenTd.textContent = screenStatus || '-';
                    tr.appendChild(screenTd);

                    // L1 Status column
                    const l1Td = document.createElement('td');
                    let l1Status = candidate.l1_result;
                    if (l1Status === 'toBeScreened') l1Status = 'To Be Screened';
                    else if (l1Status === 'selected') l1Status = 'Selected';
                    else if (l1Status === 'rejected') l1Status = 'Rejected';
                    else if (l1Status === 'onHold') l1Status = 'On Hold';
                    l1Td.textContent = l1Status || '-';
                    if (candidate.l1_date) {
                        l1Td.textContent += ` (${new Date(candidate.l1_date).toLocaleDateString()})`;
                    }
                    tr.appendChild(l1Td);

                    // L2 Status column
                    const l2Td = document.createElement('td');
                    let l2Status = candidate.l2_result;
                    if (l2Status === 'toBeScreened') l2Status = 'To Be Screened';
                    else if (l2Status === 'selected') l2Status = 'Selected';
                    else if (l2Status === 'rejected') l2Status = 'Rejected';
                    else if (l2Status === 'onHold') l2Status = 'On Hold';
                    l2Td.textContent = l2Status || '-';
                    if (candidate.l2_date) {
                        l2Td.textContent += ` (${new Date(candidate.l2_date).toLocaleDateString()})`;
                    }
                    tr.appendChild(l2Td);

                    // L3 Status column
                    const l3Td = document.createElement('td');
                    let l3Status = candidate.l3_result;
                    if (l3Status === 'toBeScreened') l3Status = 'To Be Screened';
                    else if (l3Status === 'selected') l3Status = 'Selected';
                    else if (l3Status === 'rejected') l3Status = 'Rejected';
                    else if (l3Status === 'onHold') l3Status = 'On Hold';
                    l3Td.textContent = l3Status || '-';
                    if (candidate.l3_date) {
                        l3Td.textContent += ` (${new Date(candidate.l3_date).toLocaleDateString()})`;
                    }
                    tr.appendChild(l3Td);

                    // Actions column
                    const actionsTd = document.createElement('td');
                    const scheduleBtn = document.createElement('button');
                    scheduleBtn.className = 'btn schedule-btn';
                    scheduleBtn.textContent = 'Schedule';
                    scheduleBtn.dataset.candidateId = candidate.candidate_id;
                    scheduleBtn.dataset.resumeId = candidate.resume_id;
                    scheduleBtn.addEventListener('click', function() {
                        openScheduleModal(candidate);
                    });
                    actionsTd.appendChild(scheduleBtn);
                    tr.appendChild(actionsTd);

                    candidatesTable.appendChild(tr);
                });
            })
            .catch(error => {
                console.error('Error loading candidates:', error);
                candidatesTable.innerHTML = '<tr><td colspan="9" class="text-center">Error loading candidates</td></tr>';
            });
    }

    // Open schedule modal
    function openScheduleModal(candidate) {
        // Set candidate details in modal
        document.getElementById('candidate-id').value = candidate.candidate_id;
        document.getElementById('resume-id').value = candidate.resume_id;
        document.getElementById('candidate-name').value = candidate.name || '';
        document.getElementById('candidate-email').value = candidate.email || '';

        // Clear form fields
        document.getElementById('interview-level').value = '';
        document.getElementById('interview-date').value = '';
        document.getElementById('interview-time').value = '';
        document.getElementById('interviewer-name').value = '';
        document.getElementById('interviewer-email').value = '';
        modalMessage.textContent = '';
        modalMessage.className = 'modal-message';

        // Default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('interview-date').value = tomorrow.toISOString().split('T')[0];

        // Default time to 10:00 AM
        document.getElementById('interview-time').value = '10:00';

        // Show modal
        scheduleModal.style.display = 'flex';
    }

    // Close modal
    function closeModal() {
        scheduleModal.style.display = 'none';
    }

    // Schedule interview
    function scheduleInterview(event) {
        event.preventDefault();

        // Get form data
        const candidateId = document.getElementById('candidate-id').value;
        const resumeId = document.getElementById('resume-id').value;
        const interviewLevel = document.getElementById('interview-level').value;
        const interviewDate = document.getElementById('interview-date').value;
        const interviewTime = document.getElementById('interview-time').value;
        const interviewerName = document.getElementById('interviewer-name').value;
        const interviewerEmail = document.getElementById('interviewer-email').value;

        // Validate form data
        if (!interviewLevel || !interviewDate || !interviewTime || !interviewerName || !interviewerEmail) {
            modalMessage.textContent = 'Please fill all required fields.';
            modalMessage.className = 'modal-message error';
            return;
        }
        if (!meetingLinkSent.checked) {
            modalMessage.textContent = 'Please confirm that the interview link has been sent.';
            modalMessage.className = 'modal-message error';
            return;
        }
        // Prepare data for API
        const interviewData = {
            candidate_id: candidateId,
            resume_id: resumeId,
            level: interviewLevel,
            date: interviewDate,
            time: interviewTime,
            interviewer_name: interviewerName,
            interviewer_email: interviewerEmail
        };

        // Disable schedule button
        scheduleBtn.disabled = true;

        // Send request to API
        fetch('/schedule_interview/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(interviewData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                modalMessage.textContent = 'Interview scheduled successfully!';
                modalMessage.className = 'modal-message success';
                // Reload candidates after successful scheduling
                setTimeout(() => {
                    closeModal();
                    loadCandidates(currentJdId);
                }, 2000);
            } else {
                modalMessage.textContent = 'Error: ' + data.error;
                modalMessage.className = 'modal-message error';
                scheduleBtn.disabled = false;
                scheduleBtn.textContent = 'Schedule';
            }
        })
        .catch(error => {
            console.error('Error scheduling interview:', error);
            modalMessage.textContent = 'An error occurred while scheduling the interview.';
            modalMessage.className = 'modal-message error';
            scheduleBtn.disabled = false;
            scheduleBtn.textContent = 'Schedule';
        });
    }

    // Event listeners
    jdSelect.addEventListener('change', function() {
        currentJdId = this.value;
        if (currentJdId) {
            loadCandidates(currentJdId);
        } else {
            candidatesTable.innerHTML = '<tr><td colspan="9" class="text-center">Select a JD to view candidates</td></tr>';
        }
    });

    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    scheduleForm.addEventListener('submit', scheduleInterview);

    // Close modal if clicked outside
    window.addEventListener('click', function(event) {
        if (event.target === scheduleModal) {
            closeModal();
        }
    });
    meetingLinkSent.addEventListener('change', function() {
        if (this.checked) {
            schedule_btn.disabled = false;
        } else {
            schedule_btn.disabled = true;
        }
    });
    // Load JDs on page load
    loadJDs();
});