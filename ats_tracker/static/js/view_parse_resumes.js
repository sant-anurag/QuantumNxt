document.addEventListener('DOMContentLoaded', function() {

    // fill jd-select dropdown
    jdselect_dropdown = document.getElementById('jd-select');
    resume_table = document.getElementById('resumes-table');
    resume_table_body = document.getElementById('resumes-tbody');
    save_candidate_button = document.getElementById('modal-save-btn');
    export_button = document.getElementById('export-btn');
    upload_button = document.getElementById('upload-btn');
    
    // candidate modal elements


    function loadJDs() {
        fetch('/assign_jd_data/')
            .then(response => response.json())
            .then(data => {
                jdselect_dropdown.innerHTML = '<option value="">Select JD</option>';
                data.jds.forEach(jd => {
                    const option = document.createElement('option');
                    option.value = jd.jd_id;
                    option.textContent = `${jd.jd_id} - ${jd.jd_summary}`;
                    jdselect_dropdown.appendChild(option);
                });
            })
            .catch(error => console.error('Error loading JDs:', error));
    }

    function displayResumes(resumes) {
        // Implement the logic to display resumes in the UI
        if(resumes.length === 0) {
            resume_table_body.innerHTML = '<tr><td colspan="11">No resumes found for the selected JD.</td></tr>';
            return;
        }
        resume_table_body.innerHTML = '';
        resumes.forEach(resume => {
            const row = document.createElement('tr');
            row.setAttribute('data-resume-id', resume.resume_id);
            // Format status text
            let statusText = resume.status;
            if (statusText === 'toBeScreened') statusText = 'To Be Screened';
            else if (statusText === 'selected') statusText = 'Selected';
            else if (statusText === 'rejected') statusText = 'Rejected';
            else if (statusText === 'onHold') statusText = 'On Hold';
            row.innerHTML = `
                <td class="file-name-col" title="${resume.file_name || 'N/A'}"><a href="${resume.file_url}">${resume.file_name || 'N/A'}</a></td>
                <td class="name-col" title="${resume.candidate_name || '-'}">${resume.candidate_name || '-'}</td>
                <td class="phone-col" title="${resume.phone || '-'}">${resume.phone || '-'}</td>
                <td class="email-col" title="${resume.email || '-'}">${resume.email || '-'}</td>
                <td class="exp-col" title="${resume.experience || '-'}">${resume.experience || '-'}</td>
                <td class="status-col" title="${statusText || '-'}">${statusText || '-'}</td>
                <td class="actions-col">
                    <button class="icon-btn parse-btn" data-resume-id="${resume.resume_id}" title="Parse Resume"><i class="fas fa-upload"></i></button>
                    <button class="icon-btn edit-btn" data-resume-id="${resume.resume_id}" title="Edit Resume"><i class="fas fa-edit"></i></button>
                </td>
                <td style="display:none;" class="hidden-education">${resume.education || ''}</td>
                <td style="display:none;" class="hidden-skills">${resume.skills || ''}</td>
                <td style="display:none;" class="hidden-location">${resume.location || ''}</td>
                <td style="display:none;" class="hidden-prev-job">${resume.previous_job_title || ''}</td>

            `
            resume_table_body.appendChild(row);
        });

        // Add event listeners for edit buttons
        document.querySelectorAll('.icon-btn.edit-btn').forEach(button => {
            button.addEventListener('click', function() {
                const resumeId = this.getAttribute('data-resume-id');
                const candidateModal = document.getElementById('candidate-modal');
                if (candidateModal) {
                    candidateModal.style.display = 'flex';
                    fillCandidateModalData(resumeId);
                }
            });
        });

        // Add event listeners for parse buttons
        document.querySelectorAll('.icon-btn.parse-btn').forEach(button => {
            button.addEventListener('click', function() {
                const resumeId = this.getAttribute('data-resume-id');
                const jdId = jdselect_dropdown.value;
                if (jdId && resumeId) {
                    parse_resume(jdId, resumeId, this);
                } else {
                    alert('Please select a JD first');
                }
            });
        });
    }

    function parse_resume(jd_id, resumeId, buttonElement) {
        // Store original button content
        const originalHtml = buttonElement.innerHTML;
        
        // Update button to show parsing state
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        buttonElement.disabled = true;
        buttonElement.title = 'Parsing...';

        fetch(`/parse_individual_resume/?jd_id=${jd_id}&resume_id=${resumeId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Find the row using data-resume-id attribute
                    const row = document.querySelector(`tr[data-resume-id="${resumeId}"]`);
                    if (row && data.resume) {
                        // Update Name column (2nd column)
                        const nameCell = row.cells[1];
                        if (nameCell && data.resume.name) {
                            nameCell.textContent = data.resume.name;
                            nameCell.setAttribute('title', data.resume.name);
                        }
                        
                        // Update Contact column (3rd column)
                        const contactCell = row.cells[2];
                        if (contactCell && data.resume.phone) {
                            contactCell.textContent = data.resume.phone;
                            contactCell.setAttribute('title', data.resume.phone);
                        }
                        
                        // Update Email column (4th column)
                        const emailCell = row.cells[3];
                        if (emailCell && data.resume.email) {
                            emailCell.textContent = data.resume.email;
                            emailCell.setAttribute('title', data.resume.email);
                        }
                        
                        // Update Experience column (5th column)
                        const expCell = row.cells[4];
                        // experience could be 0
                        if (expCell && data.resume.experience !== undefined) {
                            expCell.textContent = data.resume.experience;
                            expCell.setAttribute('title', data.resume.experience);
                        }
                        
                        // Update hidden columns with parsed data
                        // Education column (8th column - hidden)
                        const educationCell = row.cells[7];
                        if (educationCell && data.resume.education) {
                            educationCell.textContent = data.resume.education;
                        }
                        
                        // Skills column (9th column - hidden)
                        const skillsCell = row.cells[8];
                        if (skillsCell && data.resume.skills) {
                            skillsCell.textContent = data.resume.skills;
                        }
                        
                        // Location column (10th column - hidden)
                        const locationCell = row.cells[9];
                        if (locationCell && data.resume.location) {
                            locationCell.textContent = data.resume.location;
                        }
                        
                        // Previous Job Title column (11th column - hidden)
                        const prevJobCell = row.cells[10];
                        if (prevJobCell && data.resume.previous_job_title) {
                            prevJobCell.textContent = data.resume.previous_job_title;
                        }
                    }
                    
                    // Show success message
                    alert('Resume parsed successfully!');
                } else {
                    alert('Error parsing resume: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error parsing resume:', error);
                alert('Failed to parse resume. Please try again.');
            })
            .finally(() => {
                // Restore button state
                buttonElement.innerHTML = originalHtml;
                buttonElement.disabled = false;
                buttonElement.title = 'Parse Resume';
            });
    }

    function fetchAndDisplayResumes(jdId) {
        let url = `/view_parse_resumes/?jd_id=${jdId}`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                // Process and display the resumes data
                displayResumes(data.resumes);
            })
            .catch(error => {
                console.error('Error fetching resumes:', error)
            });
    }

    function clearCandidateModalData() {
        // Hide loading overlay
        showModalLoading(false);
        
        // Clear all form fields
        document.getElementById('modal-resume-id').value = '';
        document.getElementById('modal-jd-id').value = '';
        document.getElementById('modal-team-id').value = '';
        document.getElementById('modal-name').value = '';
        document.getElementById('modal-phone').value = '';
        document.getElementById('modal-email').value = '';
        document.getElementById('modal-skills').value = '';
        document.getElementById('modal-education').value = '';
        document.getElementById('modal-experience').value = '';
        document.getElementById('modal-prev-job-profile').value = '';
        document.getElementById('modal-current-ctc').value = '';
        document.getElementById('modal-current-ctc-basis').value = 'annual';
        document.getElementById('modal-expected-ctc').value = '';
        document.getElementById('modal-expected-ctc-basis').value = 'annual';
        document.getElementById('modal-notice-period').value = '';
        document.getElementById('modal-location').value = '';
        document.getElementById('modal-screened-on').value = '';
        document.getElementById('modal-shared-on').value = '';
        document.getElementById('modal-screened-remarks').value = '';
        document.getElementById('modal-recruiter-comments').value = '';
        document.getElementById('modal-relevant-experience').value = '';
        
        // Clear screening team display field and attributes
        const screeningTeamField = document.getElementById('modal-screening-team');
        if (screeningTeamField) {
            screeningTeamField.value = '';
            screeningTeamField.removeAttribute('data-team-id');
            screeningTeamField.removeAttribute('title');
            screeningTeamField.removeAttribute('placeholder');
        }
        
        // Reset select fields to default values
        document.getElementById('modal-screen-status').value = 'toBeScreened';
        document.getElementById('modal-hr-member-id').value = '';
    }

    function setAssignmentMembers(jd_id) {
        fetch(`/get_jd_team_members/?jd_id=${jd_id}`)
            .then(response => response.json())
            .then(data => {
                const modalScreeningTeam = document.getElementById('modal-screening-team');
                const modalTeamId = document.getElementById('modal-team-id');
                const hrMemberSelect = document.getElementById('modal-hr-member-id');
                
                // Set the screening team field with team_name for display but store team_id
                if (modalScreeningTeam && data.team_id) {
                    // Set the actual team_id in the hidden field
                    if (modalTeamId) {
                        modalTeamId.value = data.team_id;
                    }
                    
                    // Display team name in the screening team field
                    if (data.team_name) {
                        modalScreeningTeam.value = data.team_name;
                        modalScreeningTeam.setAttribute('data-team-id', data.team_id);
                        modalScreeningTeam.setAttribute('title', `Team: ${data.team_name} (ID: ${data.team_id})`);
                    } else {
                        // Fallback to team_id if team_name is not available
                        modalScreeningTeam.value = data.team_id;
                        modalScreeningTeam.setAttribute('data-team-id', data.team_id);
                    }
                    modalScreeningTeam.style.color = '#333';
                }
                
                // Populate HR member dropdown
                hrMemberSelect.innerHTML = '<option value="">Select HR Member</option>';
                data.members.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.emp_id;
                    option.textContent = member.first_name + (member.last_name ? ' ' + member.last_name : '') + ` (${member.email})`;
                    hrMemberSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error fetching HR members:', error);
            });
    }

    function fillHiddenFields(resumeId, teamId = null) {
        // Fill essential hidden fields for new candidates
        const selectedJD = jdselect_dropdown.value;
        
        document.getElementById('modal-resume-id').value = resumeId;
        if (selectedJD) {
            document.getElementById('modal-jd-id').value = selectedJD;
        }
        
        // Set team_id if provided, otherwise try to get from screening team field
        if (teamId) {
            document.getElementById('modal-team-id').value = teamId;
        } else {
            // Try to get team_id from the data-team-id attribute of screening team field
            const screeningTeamField = document.getElementById('modal-screening-team');
            if (screeningTeamField) {
                const dataTeamId = screeningTeamField.getAttribute('data-team-id');
                if (dataTeamId) {
                    document.getElementById('modal-team-id').value = dataTeamId;
                }
            }
        }
    }

    function fillParsedResumeData(resumeId) {
        // Show loading overlay when filling from table data
        showModalLoading(true, 'Filling data from table, please wait...');
        
        // Add a small delay to show the loading message
        setTimeout(() => {
            // Fill data from parsed resume displayed in the table
            const row = document.querySelector(`tr[data-resume-id="${resumeId}"]`);
            if (row) {
                const nameCell = row.cells[1];
                if (nameCell && nameCell.textContent && nameCell.textContent !== '-') {
                    const currentName = document.getElementById('modal-name').value;
                    if (!currentName || currentName.trim() === '') {
                        document.getElementById('modal-name').value = nameCell.textContent;
                    }
                }
                
                const phoneCell = row.cells[2];
                if (phoneCell && phoneCell.textContent && phoneCell.textContent !== '-') {
                    const currentPhone = document.getElementById('modal-phone').value;
                    if (!currentPhone || currentPhone.trim() === '') {
                        document.getElementById('modal-phone').value = phoneCell.textContent;
                    }
                }
                
                const emailCell = row.cells[3];
                if (emailCell && emailCell.textContent && emailCell.textContent !== '-') {
                    const currentEmail = document.getElementById('modal-email').value;
                    if (!currentEmail || currentEmail.trim() === '') {
                        document.getElementById('modal-email').value = emailCell.textContent;
                    }
                }
                
                const expCell = row.cells[4];
                if (expCell && expCell.textContent && expCell.textContent !== '-') {
                    const currentExp = document.getElementById('modal-experience').value;
                    if (!currentExp || currentExp.trim() === '') {
                        document.getElementById('modal-experience').value = expCell.textContent;
                    }
                }
                
                // Fill data from hidden columns
                // Education from hidden column (8th column - index 7)
                const educationCell = row.cells[7];
                if (educationCell && educationCell.textContent && educationCell.textContent.trim() !== '') {
                    const currentEducation = document.getElementById('modal-education').value;
                    if (!currentEducation || currentEducation.trim() === '') {
                        document.getElementById('modal-education').value = educationCell.textContent;
                    }
                }
                
                // Skills from hidden column (9th column - index 8)
                const skillsCell = row.cells[8];
                if (skillsCell && skillsCell.textContent && skillsCell.textContent.trim() !== '') {
                    const currentSkills = document.getElementById('modal-skills').value;
                    if (!currentSkills || currentSkills.trim() === '') {
                        document.getElementById('modal-skills').value = skillsCell.textContent;
                    }
                }
                
                // Location from hidden column (10th column - index 9)
                const locationCell = row.cells[9];
                if (locationCell && locationCell.textContent && locationCell.textContent.trim() !== '') {
                    const currentLocation = document.getElementById('modal-location').value;
                    if (!currentLocation || currentLocation.trim() === '') {
                        document.getElementById('modal-location').value = locationCell.textContent;
                    }
                }
                
                // Previous Job Title from hidden column (11th column - index 10)
                const prevJobCell = row.cells[10];
                if (prevJobCell && prevJobCell.textContent && prevJobCell.textContent.trim() !== '') {
                    const currentPrevJob = document.getElementById('modal-prev-job-profile').value;
                    if (!currentPrevJob || currentPrevJob.trim() === '') {
                        document.getElementById('modal-prev-job-profile').value = prevJobCell.textContent;
                    }
                }
            }
            
            // Hide loading overlay after filling data
            showModalLoading(false);
        }, 300); // 300ms delay to show loading message
    }

    function fillCandidateModalData(resumeId) {
        
        // Show loading overlay
        showModalLoading(true, 'Loading candidate data from backend...');
        
        // First, get the JD and team information to ensure we have team_id
        const selectedJD = jdselect_dropdown.value;
        
        if (selectedJD) {
            // Get team information first, then proceed with candidate data
            fetch(`/get_jd_team_members/?jd_id=${selectedJD}`)
                .then(response => response.json())
                .then(teamData => {
                    
                    // Fill hidden fields with team_id from team data
                    fillHiddenFields(resumeId, teamData.team_id);
                    
                    // Update screening team display
                    const modalScreeningTeam = document.getElementById('modal-screening-team');
                    if (modalScreeningTeam && teamData.team_id) {
                        if (teamData.team_name) {
                            modalScreeningTeam.value = teamData.team_name;
                            modalScreeningTeam.setAttribute('data-team-id', teamData.team_id);
                            modalScreeningTeam.setAttribute('title', `Team: ${teamData.team_name} (ID: ${teamData.team_id})`);
                        } else {
                            modalScreeningTeam.value = teamData.team_id;
                            modalScreeningTeam.setAttribute('data-team-id', teamData.team_id);
                        }
                    }
                    
                    // Now try to get existing candidate details
                    return fetch(`/get_candidate_details/?resume_id=${resumeId}`);
                })
                .then(response => response.json())
                .then(data => {
                    // Hide loading overlay
                    showModalLoading(false);
                    
                    if(data.success && data.candidate) {
                        const candidate = data.candidate;
                        
                        // Populate modal fields with existing candidate data
                        document.getElementById('modal-resume-id').value = candidate.resume_id || resumeId;
                        document.getElementById('modal-jd-id').value = candidate.jd_id || document.getElementById('modal-jd-id').value;
                        document.getElementById('modal-team-id').value = candidate.team_id || document.getElementById('modal-team-id').value;
                        document.getElementById('modal-name').value = candidate.name || '';
                        document.getElementById('modal-phone').value = candidate.phone || '';
                        document.getElementById('modal-email').value = candidate.email || '';
                        document.getElementById('modal-skills').value = candidate.skills || '';
                        document.getElementById('modal-education').value = candidate.education || '';
                        document.getElementById('modal-experience').value = candidate.experience || '';
                        document.getElementById('modal-prev-job-profile').value = candidate.previous_job_profile || '';
                        document.getElementById('modal-current-ctc').value = candidate.current_ctc || '';
                        document.getElementById('modal-current-ctc-basis').value = candidate.current_ctc_basis || 'annual';
                        document.getElementById('modal-expected-ctc').value = candidate.expected_ctc || '';
                        document.getElementById('modal-expected-ctc-basis').value = candidate.expected_ctc_basis || 'annual';
                        document.getElementById('modal-notice-period').value = candidate.notice_period || '';
                        document.getElementById('modal-location').value = candidate.location || '';
                        document.getElementById('modal-screened-on').value = candidate.screened_on || '';
                        document.getElementById('modal-shared-on').value = candidate.shared_on || '';
                        document.getElementById('modal-screened-remarks').value = candidate.screened_remarks || '';
                        document.getElementById('modal-recruiter-comments').value = candidate.recruiter_comments || '';
                        document.getElementById('modal-relevant-experience').value = candidate.relevant_experience || '';
                        
                        // For existing candidates, update screening team display if we have team info
                        if (candidate.team_id) {
                            document.getElementById('modal-team-id').value = candidate.team_id;
                            // You might want to fetch team name for existing candidates too
                        }
                        
                        document.getElementById('modal-hr-member-id').value = candidate.hr_member_id || '';
                        document.getElementById('modal-screen-status').value = candidate.screen_status || 'toBeScreened';
                        
                        // Fill parsed data for any empty fields
                        fillParsedResumeData(resumeId);
                    }
                    else {
                        // No existing candidate data - fill from parsed resume data
                        fillParsedResumeData(resumeId);
                    }
                })
                .catch(error => {
                    // Hide loading overlay on error
                    showModalLoading(false);
                    console.error('Error in fillCandidateModalData:', error);
                    // On error, still try to fill basic fields and parsed data
                    fillHiddenFields(resumeId);
                    fillParsedResumeData(resumeId);
                });
        } else {
            // Hide loading overlay and fill basic fields
            showModalLoading(false);
            // No JD selected, just fill basic fields
            fillHiddenFields(resumeId);
            fillParsedResumeData(resumeId);
        }
    }

    function closeCandidateModal() {
        const candidateModal = document.getElementById('candidate-modal');
        if (candidateModal) {
            // Hide loading overlay
            showModalLoading(false);
            candidateModal.style.display = 'none';
            clearCandidateModalData();
        }
    }

    function openUploadModal() {
        const selectedJD = jdselect_dropdown.value;
        if (!selectedJD) {
            alert('Please select a JD first before uploading resumes.');
            return;
        }
        
        const uploadModal = document.getElementById('resume-upload-modal');
        if (uploadModal) {
            // Set the JD ID in the upload form
            document.getElementById('upload-jd-id').value = selectedJD;        
            uploadModal.style.display = 'flex';
            clearUploadMessage();
        }
    }

    function closeUploadModal() {
        const uploadModal = document.getElementById('resume-upload-modal');
        if (uploadModal) {
            uploadModal.style.display = 'none';
            clearUploadForm();
        }
    }

    function clearUploadForm() {
        const uploadForm = document.getElementById('resume-upload-form');
        if (uploadForm) {
            uploadForm.reset();
        }
        
        // Clear hidden fields
        document.getElementById('upload-jd-id').value = '';
        document.getElementById('upload-team-id').value = '';
        
        // Hide file selection indicator and progress bar
        const fileIndicator = document.querySelector('.file-selected-indicator');
        if (fileIndicator) {
            fileIndicator.classList.remove('show');
        }
        
        const progressBar = document.querySelector('.upload-progress');
        if (progressBar) {
            progressBar.classList.remove('show');
            const progressBarFill = document.querySelector('.upload-progress-bar');
            if (progressBarFill) {
                progressBarFill.style.width = '0%';
            }
        }
        
        clearUploadMessage();
    }

    function clearUploadMessage() {
        const uploadMessage = document.getElementById('upload-message');
        if (uploadMessage) {
            uploadMessage.textContent = '';
            uploadMessage.className = '';
            uploadMessage.style.display = 'none';
        }
    }

    function showUploadMessage(message, type = 'info') {
        const uploadMessage = document.getElementById('upload-message');
        if (uploadMessage) {
            uploadMessage.textContent = message;
            uploadMessage.className = type;
            uploadMessage.style.display = 'block';
        }
    }

    function showModalLoading(isLoading, message = 'Loading candidate data, please wait...') {
        const loadingOverlay = document.getElementById('modal-loading-overlay');
        const loadingText = document.querySelector('.modal-loading-text');
        
        if (loadingOverlay) {
            if (isLoading) {
                if (loadingText) {
                    loadingText.textContent = message;
                }
                loadingOverlay.style.display = 'flex';
            } else {
                loadingOverlay.style.display = 'none';
            }
        }
    }

    function handleFileSelection() {
        const fileInput = document.getElementById('resume-file');
        const fileIndicator = document.querySelector('.file-selected-indicator');
        
        if (fileInput && fileInput.files.length > 0) {
            const fileCount = fileInput.files.length;
            const fileNames = Array.from(fileInput.files).map(file => file.name).join(', ');
            
            if (fileIndicator) {
                fileIndicator.textContent = `${fileCount} file(s) selected: ${fileNames}`;
                fileIndicator.classList.add('show');
            }
            
            clearUploadMessage();
        } else {
            if (fileIndicator) {
                fileIndicator.classList.remove('show');
            }
        }
    }

    // Add event listeners for modal close functionality
    function setupModalCloseListeners() {
        // Close button click for candidate modal
        const modalCloseBtn = document.getElementById('modal-close-btn');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeCandidateModal);
        }

        // Click on candidate modal overlay to close
        const candidateModal = document.getElementById('candidate-modal');
        if (candidateModal) {
            candidateModal.addEventListener('click', function(event) {
                // Only close if clicking on the overlay (not the modal content)
                if (event.target === candidateModal) {
                    closeCandidateModal();
                }
            });
        }

        // Close button click for upload modal
        const uploadCloseBtn = document.getElementById('upload-close-btn');
        if (uploadCloseBtn) {
            uploadCloseBtn.addEventListener('click', closeUploadModal);
        }

        // Click on upload modal overlay to close
        const uploadModal = document.getElementById('resume-upload-modal');
        if (uploadModal) {
            uploadModal.addEventListener('click', function(event) {
                // Only close if clicking on the overlay (not the modal content)
                if (event.target === uploadModal) {
                    closeUploadModal();
                }
            });
        }

        // ESC key to close modals
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                // Close candidate modal if open
                if (candidateModal && candidateModal.style.display === 'flex') {
                    closeCandidateModal();
                }
                // Close upload modal if open
                if (uploadModal && uploadModal.style.display === 'flex') {
                    closeUploadModal();
                }
            }
        });
    }

    function save_candidate_data(){
        // Implement save candidate data functionality
        const candidateData = {
            resume_id: document.getElementById('modal-resume-id').value,
            jd_id: document.getElementById('modal-jd-id').value,
            team_id: document.getElementById('modal-team-id').value, // Use hidden field for team_id
            name: document.getElementById('modal-name').value,
            phone: document.getElementById('modal-phone').value,
            email: document.getElementById('modal-email').value,
            skills: document.getElementById('modal-skills').value,
            education: document.getElementById('modal-education') ? document.getElementById('modal-education').value : '',
            experience: document.getElementById('modal-experience').value,
            prev_job_profile: document.getElementById('modal-prev-job-profile').value,
            current_ctc: document.getElementById('modal-current-ctc').value,
            current_ctc_basis: document.getElementById('modal-current-ctc-basis').value,
            expected_ctc: document.getElementById('modal-expected-ctc').value,
            expected_ctc_basis: document.getElementById('modal-expected-ctc-basis').value,
            notice_period: document.getElementById('modal-notice-period').value,
            location: document.getElementById('modal-location').value,
            screen_status: document.getElementById('modal-screen-status').value,
            screening_team: document.getElementById('modal-team-id').value, // Use team_id for screening_team
            hr_member_id: document.getElementById('modal-hr-member-id').value,
            screened_on: document.getElementById('modal-screened-on').value,
            shared_on: document.getElementById('modal-shared-on').value,
            screened_remarks: document.getElementById('modal-screened-remarks').value,
            recruiter_comments: document.getElementById('modal-recruiter-comments').value,
            relevant_experience: document.getElementById('modal-relevant-experience').value
        };

        fetch('/save_candidate_details/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(candidateData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Candidate details saved successfully!');
                closeCandidateModal();
                // Refresh the resumes display to reflect any changes
                const selectedJD = jdselect_dropdown.value;
                if (selectedJD) {
                    fetchAndDisplayResumes(selectedJD);
                }
            } else {
                alert('Error saving candidate details: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error saving candidate details:', error);
            alert('Failed to save candidate details. Please try again.');
        });
    }

    function exportToExcel() {
        // Check if there's data to export
        const table = document.getElementById('resume-table');
        const tbody = document.getElementById('resumes-tbody');
        
        if (!tbody || tbody.children.length === 0) {
            alert('No data to export. Please select a JD with resumes first.');
            return;
        }
        
        // Get the selected JD for filename
        const selectedJD = jdselect_dropdown.value;
        const selectedJDText = jdselect_dropdown.options[jdselect_dropdown.selectedIndex]?.text || 'Unknown_JD';
        
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        
        // Prepare data array for export
        const exportData = [];
        
        // Add header row
        const headers = ['File Name', 'Name', 'Contact No', 'Email', 'Total Experience (years)', 'Status'];
        exportData.push(headers);
        
        // Add data rows
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            if (row.children.length >= 6) { // Ensure row has enough columns
                const rowData = [];
                // Extract text content from each cell (excluding Actions column)
                for (let i = 0; i < 6; i++) {
                    const cell = row.children[i];
                    if (i === 0) {
                        // For file name, extract just the text without the link
                        const link = cell.querySelector('a');
                        rowData.push(link ? link.textContent : cell.textContent);
                    } else {
                        rowData.push(cell.textContent.trim());
                    }
                }
                exportData.push(rowData);
            }
        });
        
        // Create worksheet from data
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        
        // Set column widths for better formatting
        const colWidths = [
            { wch: 25 }, // File Name
            { wch: 20 }, // Name
            { wch: 15 }, // Contact No
            { wch: 25 }, // Email
            { wch: 15 }, // Experience
            { wch: 15 }  // Status
        ];
        ws['!cols'] = colWidths;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Resumes');
        
        // Generate filename with current date and JD info
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `Resumes_${selectedJDText.replace(/[^a-zA-Z0-9-_]/g, '_')}_${currentDate}.xlsx`;
        
        // Save the file
        XLSX.writeFile(wb, filename);
        
        // Show success message
        alert(`Excel file "${filename}" has been downloaded successfully!`);
    }

    
    function handleUploadFormSubmission(event) {
        event.preventDefault(); // Prevent default form submission
        const form = document.getElementById('resume-upload-form');
        const formData = new FormData(form);
        const files = formData.getAll('resume-file');
        
        if (files.length === 0) {
            showUploadMessage('Please select at least one resume file', 'error');
            return;
        }

        // Get JD ID from hidden field
        const jdId = document.getElementById('upload-jd-id').value;
        if (!jdId) {
            showUploadMessage('JD ID is missing. Please close and reopen the upload modal.', 'error');
            return;
        }

        // Create FormData for multiple file upload
        const uploadFormData = new FormData();
        uploadFormData.append('jd_id', jdId);
        
        // Append all files with the correct key name expected by backend
        files.forEach(file => {
            uploadFormData.append('resume_file', file);
        });

        // Show upload progress
        const progressBar = document.querySelector('.upload-progress');
        const progressBarFill = document.querySelector('.upload-progress-bar');
        if (progressBar && progressBarFill) {
            progressBar.style.display = 'block';
            progressBarFill.style.width = '0%';
        }

        // Disable upload button during upload
        const uploadBtn = document.getElementById('upload-save-btn');
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
        }

        // Clear any previous messages
        clearUploadMessage();

        // Upload files
        fetch('/api/upload_multiple_resumes/', {
            method: 'POST',
            body: uploadFormData,
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showUploadMessage(`Successfully uploaded ${files.length} file(s)`, 'success');
                
                // Refresh the resumes table
                const selectedJD = jdselect_dropdown.value;
                if (selectedJD) {
                    fetchAndDisplayResumes(selectedJD);
                }
                
                // Close modal after a short delay
                setTimeout(() => {
                    closeUploadModal();
                }, 1500);
            } else {
                showUploadMessage(`Upload failed: ${data.error}`, 'error');
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            showUploadMessage('Upload failed due to network error', 'error');
        })
        .finally(() => {
            // Hide progress bar and re-enable button
            if (progressBar) {
                progressBar.style.display = 'none';
            }
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload';
            }
        });
    }

    // url = '/api/upload_resume/';

    if (save_candidate_button) {
        save_candidate_button.addEventListener('click', save_candidate_data);
    }

    if (export_button) {
        export_button.addEventListener('click', exportToExcel);
    }

    if (upload_button) {
        upload_button.addEventListener('click', openUploadModal);
    }

    // JD dropdown change listener - this was missing!
    if (jdselect_dropdown) {
        jdselect_dropdown.addEventListener('change', function() {
            const selectedJD = jdselect_dropdown.value;
            if (selectedJD) {
                fetchAndDisplayResumes(selectedJD);
                setAssignmentMembers(selectedJD);
            } else {
                // Clear resumes display if no JD is selected
                resume_table_body.innerHTML = '<tr><td colspan="7">Please select a JD to view resumes.</td></tr>';
            }
        });
    }

    // File input change listener for upload modal
    const resumeFileInput = document.getElementById('resume-file');
    if (resumeFileInput) {
        resumeFileInput.addEventListener('change', handleFileSelection);
    }

    // Upload form submission listener
    const uploadForm = document.getElementById('resume-upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUploadFormSubmission);
    }

    function getCSRFToken() {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith('csrftoken=')) {
                return cookie.substring('csrftoken='.length, cookie.length);
            }
        }
        return null;
    }

    loadJDs();
    setupModalCloseListeners();

});
