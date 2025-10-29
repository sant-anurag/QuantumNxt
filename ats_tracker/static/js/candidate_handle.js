document.addEventListener('DOMContentLoaded', function() {
    let selectedJdId = 'all';
    let allJds = [];
    
    // JD Dropdown functionality
    const jdDropdownBtn = document.getElementById('jd-dropdown-btn');
    const jdDropdownContent = document.getElementById('jd-dropdown-content');
    const jdSearchInput = document.getElementById('jd-search-input');
    const jdOptions = document.getElementById('jd-options');
    const jdSelectedText = document.querySelector('.jd-selected-text');
    
    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    // Load JDs on page load
    loadJDs();
    
    // JD Dropdown toggle
    jdDropdownBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleJdDropdown();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!jdDropdownBtn.contains(e.target) && !jdDropdownContent.contains(e.target)) {
            closeJdDropdown();
        }
    });
    
    // JD Search functionality with dynamic backend search
    let searchTimeout;
    jdSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim();
        
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // If search term is less than 3 characters, load default JDs
        if (searchTerm.length < 3) {
            loadJDs();
            return;
        }
        
        // Set timeout to avoid too many API calls while typing
        searchTimeout = setTimeout(() => {
            loadJDs(searchTerm);
        }, 300);
    });
    
    // Search button functionality
    searchButton.addEventListener('click', function() {
        performSearch();
    });
    
    // Search on Enter key
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    function loadJDs(searchTerm = '') {
        // Build URL with search parameter if provided
        let url = '/search_jds/';
        if (searchTerm && searchTerm.length >= 3) {
            url += `?search=${encodeURIComponent(searchTerm)}`;
        }
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    allJds = data.jds;
                    populateJdOptions(allJds);
                } else {
                    console.error('Failed to load JDs');
                }
            })
            .catch(error => {
                console.error('Error loading JDs:', error);
            });
    }
    
    function populateJdOptions(jds) {
        // Clear existing options except "All Job Descriptions"
        jdOptions.innerHTML = `
            <div class="jd-option ${selectedJdId === 'all' ? 'selected' : ''}" data-jd-id="all">
                <span class="jd-option-text">All Job Descriptions</span>
            </div>
        `;
        
        // Add JD options
        jds.forEach(jd => {
            const option = document.createElement('div');
            option.className = `jd-option ${selectedJdId == jd.jd_id ? 'selected' : ''}`;
            option.setAttribute('data-jd-id', jd.jd_id);
            
            option.innerHTML = `
                <span class="jd-option-text">JD-${jd.jd_id}: ${jd.jd_summary}</span>
                <div class="jd-company">${jd.company_name || 'No Company'}</div>
            `;
            
            option.addEventListener('click', function() {
                selectJdOption(jd.jd_id, `JD-${jd.jd_id}: ${jd.jd_summary}`);
            });
            
            jdOptions.appendChild(option);
        });
        
        // Add click event for "All Job Descriptions"
        const allOption = jdOptions.querySelector('[data-jd-id="all"]');
        allOption.addEventListener('click', function() {
            selectJdOption('all', 'All Job Descriptions');
        });
    }
    
    function selectJdOption(jdId, jdText) {
        selectedJdId = jdId;
        jdSelectedText.textContent = jdText;
        
        // Update selected state
        document.querySelectorAll('.jd-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector(`[data-jd-id="${jdId}"]`).classList.add('selected');
        
        closeJdDropdown();
        
        // Trigger filter update
        filterCandidates();
    }
    
    function toggleJdDropdown() {
        const isOpen = jdDropdownContent.classList.contains('show');
        if (isOpen) {
            closeJdDropdown();
        } else {
            openJdDropdown();
        }
    }
    
    function openJdDropdown() {
        jdDropdownContent.classList.add('show');
        jdDropdownBtn.classList.add('active');
        jdSearchInput.value = '';
        
        // Load default JDs when opening dropdown
        loadJDs();
        
        // Focus on search input
        setTimeout(() => {
            jdSearchInput.focus();
        }, 100);
    }
    
    function closeJdDropdown() {
        jdDropdownContent.classList.remove('show');
        jdDropdownBtn.classList.remove('active');
    }
    
    function performSearch() {
        const searchTerm = searchInput.value.trim();
        filterCandidates(searchTerm);
    }
    
    function filterCandidates(searchTerm = '') {
        const params = new URLSearchParams();
        
        if (selectedJdId !== 'all') {
            params.append('jd_id', selectedJdId);
        }
        
        const finalSearchTerm = searchTerm || searchInput.value.trim();
        if (finalSearchTerm) {
            params.append('search', finalSearchTerm);
        }
        
        // Show loading state
        showLoadingState();
        
        fetch(`/api/candidate_pipeline/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                console.log("checked data:", data);
                if (data.success) {
                    updateCandidatesList(data.candidates);
                } else {
                    console.error('Failed to load candidates:', data.error);
                    showErrorState(data.error);
                }
            })
            .catch(error => {
                console.error('Error loading candidates:', error);
                showErrorState('Failed to load candidates');
            });
    }
    
    // Make filterCandidates available globally for modal actions
    window.filterCandidates = filterCandidates;
    
    function updateCandidatesList(candidates) {
        const candidatesContainer = document.getElementById('candidates-cards-list');
        
        if (!candidates || candidates.length === 0) {
            candidatesContainer.innerHTML = '<p>No candidates found.</p>';
            return;
        }
        
        candidatesContainer.innerHTML = '';
        
        candidates.forEach(candidate => {
            const candidateCard = createCandidateCard(candidate);
            candidatesContainer.appendChild(candidateCard);
        });
    }
    
    function createCandidateCard(candidate) {
        console.log('Creating card for candidate:', candidate);
        const cardDiv = document.createElement('div');
        cardDiv.className = 'candidate-card';
        cardDiv.setAttribute('data-candidate-id', candidate.candidate_id);
        
        // Generate background color class for initials
        const bgClasses = ['bg-blue', 'bg-purple', 'bg-brown', 'bg-green', 'bg-red'];
        const bgClass = bgClasses[candidate.candidate_id % bgClasses.length];
        
        // Get stage tracking classes and current stage info
        const stageTracker = getStageTracker(candidate);
        const currentStageInfo = getCurrentStageInfo(candidate);
        
        cardDiv.innerHTML = `
            <div class="card-header">
                <div class="initials-circle ${bgClass}">${candidate.initials}</div>
                <div class="profile-info">
                    <h3 class="candidate-name">${candidate.name}</h3>
                    <div class="tooltip-container">
                        <p class="role-title">${candidate.jd_id} - ${candidate.job_summary}</p>
                        <span class="tooltip-text">${candidate.job_summary}</span>
                    </div>
                </div>
                <button class="action-btn view-resume" onclick="viewResume(${candidate.candidate_id}, ${candidate.resume_id})">View Resume</button>
            </div>
            
            <div class="profile-progress-bar">
                <span class="progress-label">${stageTracker.progressPercentage}% Profile Complete</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${stageTracker.progressPercentage}%;"></div>
                </div>
            </div>

            <div class="stage-tracker">
                <div class="stage ${stageTracker.screening}" title="Screening: ${getStageTooltipText('screening', candidate.screen_status)}"></div>
                <div class="stage ${stageTracker.l1}" title="L1 Interview: ${getStageTooltipText('l1', candidate.l1_result)}"></div>
                <div class="stage ${stageTracker.l2}" title="L2 Interview: ${getStageTooltipText('l2', candidate.l2_result)}"></div>
                <div class="stage ${stageTracker.l3}" title="L3 Interview: ${getStageTooltipText('l3', candidate.l3_result)}"></div>
                <div class="stage ${stageTracker.offer}" title="Offer: ${getStageTooltipText('offer', candidate.offer_status)}"></div>
                <div class="stage ${stageTracker.joining}" title="Joining: ${getStageTooltipText('joining', candidate.joining_status)}"></div>
            </div>
            
            <div class="current-stage-info">
                <div class="current-stage-status">
                    <span class="status-label">${currentStageInfo.stage}:</span>
                    <span class="status-value ${currentStageInfo.statusClass}">${currentStageInfo.statusText}</span>
                </div>
                <div class="recruiter-comments tooltip-container">
                    <span class="comments-text">💬 ${candidate.recruiter_comments || "No comments"}</span>
                    <span class="tooltip-text">Recruiter Comments: [${candidate.updated_at || ''}] ${candidate.recruiter_comments || "No comments available."}</span>
                </div>
            </div>
            
            <div class="candidate_actions">
                <button class="action-btn primary add-note" onclick="addNote(${candidate.candidate_id})">Add Note</button>
                <button class="action-btn primary" onclick="takeAction(${candidate.candidate_id})">Take Action</button>
            </div>
        `;
        
        return cardDiv;
    }
    
    function showLoadingState() {
        const candidatesContainer = document.getElementById('candidates-cards-list');
        candidatesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; grid-column: 1 / -1;">
                <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #e2e8f0; border-left-color: #4e54c8; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 16px; color: #64748b;">Loading candidates...</p>
            </div>
        `;
    }
    
    function showErrorState(error) {
        const candidatesContainer = document.getElementById('candidates-cards-list');
        candidatesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; grid-column: 1 / -1;">
                <p style="color: #dc2626; font-weight: 500;">Error: ${error}</p>
                <button onclick="filterCandidates()" style="margin-top: 16px; padding: 8px 16px; background: #4e54c8; color: white; border: none; border-radius: 6px; cursor: pointer;">Retry</button>
            </div>
        `;
    }
    
    // Load candidates on page load
    filterCandidates();
    
    // Modal Event Listeners Setup
    setupModalEventListeners();
});

// Stage Tracking Functions (Global scope for modal access)
function getStageTracker(candidate) {
    const stages = {
        screening: 'upcoming',
        l1: 'upcoming',
        l2: 'upcoming',
        l3: 'upcoming',
        offer: 'upcoming',
        joining: 'upcoming'
    };
    
    let completedStages = 0;
    let currentStageFound = false;
    
    // Screening stage
    if (candidate.screen_status === 'selected') {
        stages.screening = 'completed';
        completedStages++;
    } else if (candidate.screen_status === 'rejected') {
        stages.screening = 'rejected';
        currentStageFound = true;
    } else if (candidate.screen_status === 'onHold') {
        stages.screening = 'on-hold';
        currentStageFound = true;
    } else if (candidate.screen_status === 'toBeScreened') {
        stages.screening = 'active';
        currentStageFound = true;
    }
    
    // L1 stage
    if (!currentStageFound && candidate.screen_status === 'selected') {
        if (candidate.l1_result === 'selected') {
            stages.l1 = 'completed';
            completedStages++;
        } else if (candidate.l1_result === 'rejected') {
            stages.l1 = 'rejected';
            currentStageFound = true;
        } else if (candidate.l1_result === 'onHold') {
            stages.l1 = 'on-hold';
            currentStageFound = true;
        } else if (candidate.l1_result === 'toBeScreened') {
            stages.l1 = 'active';
            currentStageFound = true;
        }
    }
    
    // L2 stage
    if (!currentStageFound && candidate.l1_result === 'selected') {
        if (candidate.l2_result === 'selected') {
            stages.l2 = 'completed';
            completedStages++;
        } else if (candidate.l2_result === 'rejected') {
            stages.l2 = 'rejected';
            currentStageFound = true;
        } else if (candidate.l2_result === 'onHold') {
            stages.l2 = 'on-hold';
            currentStageFound = true;
        } else if (candidate.l2_result === 'toBeScreened') {
            stages.l2 = 'active';
            currentStageFound = true;
        }
    }
    
    // L3 stage
    if (!currentStageFound && candidate.l2_result === 'selected') {
        if (candidate.l3_result === 'selected') {
            stages.l3 = 'completed';
            completedStages++;
        } else if (candidate.l3_result === 'rejected') {
            stages.l3 = 'rejected';
            currentStageFound = true;
        } else if (candidate.l3_result === 'onHold') {
            stages.l3 = 'on-hold';
            currentStageFound = true;
        } else if (candidate.l3_result === 'toBeScreened') {
            stages.l3 = 'active';
            currentStageFound = true;
        }
    }
    
    // Offer stage
    if (!currentStageFound && candidate.l3_result === 'selected') {
        if (candidate.offer_status === 'accepted') {
            stages.offer = 'completed';
            completedStages++;
        } else if (candidate.offer_status === 'declined') {
            stages.offer = 'rejected';
            currentStageFound = true;
        } else if (candidate.offer_status === 'released') {
            stages.offer = 'active';
            currentStageFound = true;
        } else if (candidate.offer_status === 'in_progress') {
            stages.offer = 'active';
            currentStageFound = true;
        } else if (candidate.offer_status === 'not_initiated') {
            stages.offer = 'active';
            currentStageFound = true;
        }
    }
    
    // Joining stage
    if (!currentStageFound && candidate.offer_status === 'accepted') {
        if (candidate.joining_status === 'joined') {
            stages.joining = 'completed';
            completedStages++;
        } else if (candidate.joining_status === 'withdrawn' || candidate.joining_status === 'resigned') {
            stages.joining = 'rejected';
            currentStageFound = true;
        } else if (candidate.joining_status === 'onHold') {
            stages.joining = 'on-hold';
            currentStageFound = true;
        } else if (candidate.joining_status === 'in_progress' || !candidate.joining_status) {
            // Set as active if in_progress or if joining_status is not set yet
            stages.joining = 'active';
            currentStageFound = true;
        }
    }
    
    // Calculate progress percentage
    const progressPercentage = Math.round((completedStages / 6) * 100);
    
    return {
        ...stages,
        progressPercentage
    };
}

function getCurrentStageInfo(candidate) {
    // Determine current stage and status
    if (candidate.screen_status !== 'selected') {
        return {
            stage: 'Screening',
            statusText: getStatusDisplayText(candidate.screen_status),
            statusClass: getStatusClass(candidate.screen_status)
        };
    }
    
    if (candidate.l1_result !== 'selected') {
        return {
            stage: 'L1 Interview',
            statusText: getStatusDisplayText(candidate.l1_result),
            statusClass: getStatusClass(candidate.l1_result)
        };
    }
    
    if (candidate.l2_result !== 'selected') {
        return {
            stage: 'L2 Interview',
            statusText: getStatusDisplayText(candidate.l2_result),
            statusClass: getStatusClass(candidate.l2_result)
        };
    }
    
    if (candidate.l3_result !== 'selected') {
        return {
            stage: 'L3 Interview',
            statusText: getStatusDisplayText(candidate.l3_result),
            statusClass: getStatusClass(candidate.l3_result)
        };
    }
    
    // If all interviews are selected, check offer status
    if (candidate.offer_status !== 'accepted') {
        return {
            stage: 'Offer',
            statusText: getOfferStatusDisplayText(candidate.offer_status),
            statusClass: getOfferStatusClass(candidate.offer_status)
        };
    }
    
    // If offer is accepted, show joining status
    return {
        stage: 'Joining',
        statusText: getJoiningStatusDisplayText(candidate.joining_status),
        statusClass: getJoiningStatusClass(candidate.joining_status)
    };
}

function getStatusDisplayText(status) {
    switch (status) {
        case 'toBeScreened': return 'Pending Review';
        case 'selected': return 'Selected';
        case 'rejected': return 'Rejected';
        case 'onHold': return 'On Hold';
        default: return 'Unknown';
    }
}

function getOfferStatusDisplayText(offerStatus) {
    switch (offerStatus) {
        case 'not_initiated': return 'Offer Pending';
        case 'in_progress': return 'Offer In Progress';
        case 'released': return 'Offer Released';
        case 'accepted': return 'Offer Accepted';
        case 'declined': return 'Offer Declined';
        default: return 'Unknown';
    }
}

function getOfferStatusClass(offerStatus) {
    switch (offerStatus) {
        case 'accepted': return 'highlight-green';
        case 'declined': return 'highlight-red';
        case 'released': return 'highlight-blue';
        case 'in_progress': return 'highlight-orange';
        case 'not_initiated': return 'highlight-orange';
        default: return 'highlight-blue';
    }
}

function getJoiningStatusDisplayText(joiningStatus) {
    switch (joiningStatus) {
        case 'in_progress': return 'Joining In Progress';
        case 'joined': return 'Joined';
        case 'onHold': return 'Joining On Hold';
        case 'withdrawn': return 'Joining Withdrawn';
        case 'resigned': return 'Resigned';
        default: return 'Joining Pending';
    }
}

function getJoiningStatusClass(joiningStatus) {
    switch (joiningStatus) {
        case 'joined': return 'highlight-green';
        case 'resigned': return 'highlight-red';
        case 'withdrawn': return 'highlight-red';
        case 'onHold': return 'highlight-orange';
        case 'in_progress': return 'highlight-blue';
        default: return 'highlight-blue';
    }
}

function getStageTooltipText(stage, status) {
    if (!status || status === 'toBeScreened') {
        if (stage === 'offer') return 'Offer not initiated';
        if (stage === 'joining') return 'Joining pending';
        return 'Pending';
    }
    
    if (stage === 'offer') {
        return getOfferStatusDisplayText(status);
    }
    
    if (stage === 'joining') {
        return getJoiningStatusDisplayText(status);
    }
    
    return getStatusDisplayText(status);
}

function getStatusClass(status) {
    switch (status) {
        case 'selected': return 'highlight-green';
        case 'rejected': return 'highlight-red';
        case 'onHold': return 'highlight-orange';
        case 'toBeScreened': return 'highlight-blue';
        default: return 'highlight-blue';
    }
}

// Global functions for candidate actions
function viewResume(candidateId, resume_id) {
    console.log('Downloading resume for candidate:', candidateId, 'Resume ID:', resume_id);
    
    if (!resume_id) {
        showNotification('Resume ID not found for this candidate', 'error');
        return;
    }
    
    // Create download URL
    const downloadUrl = `/download_resume/${resume_id}/`;
    
    // Create a temporary link element and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.style.display = 'none';
    link.download = ''; // This will use the filename from the server
    
    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Resume download started', 'success');
}

function addNote(candidateId) {
    console.log('Adding note for candidate:', candidateId);
    openAddNoteModal(candidateId);
}

function takeAction(candidateId) {
    console.log('Taking action for candidate:', candidateId);
    openTakeActionModal(candidateId);
}

// Modal Management
let currentCandidateId = null;
let currentCandidateData = null;

// Add Note Modal Functions
function openAddNoteModal(candidateId) {
    currentCandidateId = candidateId;
    
    // Find candidate data from the current candidates list
    const candidateData = findCandidateData(candidateId);
    if (candidateData) {
        populateAddNoteModal(candidateData);
    }
    
    const modal = document.getElementById('addNoteModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeAddNoteModal() {
    const modal = document.getElementById('addNoteModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    resetAddNoteForm();
}

function populateAddNoteModal(candidateData) {
    const initials = candidateData.initials || candidateData.name.split(' ').map(n => n[0]).join('').toUpperCase();
    
    document.getElementById('noteModalInitials').textContent = initials;
    document.getElementById('noteModalCandidateName').textContent = candidateData.name;
    document.getElementById('noteModalJobTitle').textContent = candidateData.jd_id + ' - ' + candidateData.job_summary;
}

function resetAddNoteForm() {
    document.getElementById('addNoteForm').reset();
}

// Take Action Modal Functions  
function openTakeActionModal(candidateId) {
    if (!candidateId) {
        showNotification('Error: No candidate ID provided', 'error');
        return;
    }
    
    currentCandidateId = candidateId;
    
    // Find candidate data from the current candidates list
    const candidateData = findCandidateData(candidateId);
    if (candidateData) {
        currentCandidateData = candidateData;
        populateTakeActionModal(candidateData);
    } else {
        showNotification('Warning: Candidate data not found. Some features may not work correctly.', 'warning');
        // Set fallback data
        currentCandidateData = {
            candidate_id: candidateId,
            name: 'Unknown Candidate',
            jd_id: 'Unknown',
            job_summary: 'Position'
        };
        populateTakeActionModal(currentCandidateData);
    }
    
    const modal = document.getElementById('takeActionModal');
    if (!modal) {
        showNotification('Error: Take Action modal not found', 'error');
        return;
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Reset form to clean state
    resetTakeActionForm();
}

function closeTakeActionModal() {
    const modal = document.getElementById('takeActionModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    resetTakeActionForm();
}

function populateTakeActionModal(candidateData) {
    const initials = candidateData.initials || candidateData.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const currentStageInfo = getCurrentStageInfo(candidateData);
    
    document.getElementById('actionModalInitials').textContent = initials;
    document.getElementById('actionModalCandidateName').textContent = candidateData.name;
    document.getElementById('actionModalJobTitle').textContent = candidateData.jd_id + ' - ' + candidateData.job_summary;
    document.getElementById('actionModalCurrentStage').textContent = currentStageInfo.stage;
}

function resetTakeActionForm() {
    document.getElementById('takeActionForm').reset();
    hideAllActionGroups();
}

function hideAllActionGroups() {
    // Remove required attributes from all form fields that might be hidden
    removeRequiredAttributes();
    
    document.getElementById('rejectionReasonGroup').style.display = 'none';
    document.getElementById('holdReasonGroup').style.display = 'none';
    document.getElementById('interviewDetailsGroup').style.display = 'none';
    document.getElementById('offerDetailsGroup').style.display = 'none';
    document.getElementById('offerStatusManageGroup').style.display = 'none';
    document.getElementById('hiringStatusManageGroup').style.display = 'none';
}

function removeRequiredAttributes() {
    // Remove required attributes from all form fields that might be hidden
    const allRequiredFields = document.querySelectorAll('#takeActionForm [required]');
    allRequiredFields.forEach(field => {
        field.removeAttribute('required');
    });
}

function setOfferRequiredFields() {
    const basicSalaryField = document.getElementById('basicSalary');
    const hraField = document.getElementById('hra');
    const pfField = document.getElementById('pf');
    const joiningDateField = document.getElementById('joiningDate');
    
    if (basicSalaryField) basicSalaryField.setAttribute('required', 'required');
    if (hraField) hraField.setAttribute('required', 'required');
    if (pfField) pfField.setAttribute('required', 'required');
    if (joiningDateField) joiningDateField.setAttribute('required', 'required');
}

function setInterviewRequiredFields() {
    const interviewRequiredFields = ['interviewDate', 'interviewLevel', 'interviewer', 'interviewerEmail'];
    interviewRequiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.setAttribute('required', 'required');
        }
    });
}

function setOfferStatusRequiredFields() {
    const offerStatusField = document.getElementById('offerStatus');
    if (offerStatusField) {
        offerStatusField.setAttribute('required', 'required');
    }
}

function setHiringStatusRequiredFields() {
    const hiringStatusField = document.getElementById('hiringStatus');
    if (hiringStatusField) {
        hiringStatusField.setAttribute('required', 'required');
    }
}

// Helper function to find candidate data
function findCandidateData(candidateId) {
    // This would typically come from your data source
    // For now, we'll create a mock function
    // In a real implementation, you'd maintain the candidates array or fetch from API
    
    // Try to extract from DOM using data-candidate-id attribute
    const candidateCard = document.querySelector(`.candidate-card[data-candidate-id="${candidateId}"]`);
    if (candidateCard) {
        return {
            candidate_id: candidateId,
            name: candidateCard.querySelector('.candidate-name').textContent,
            jd_id: candidateCard.querySelector('.role-title').textContent.split(' - ')[0],
            job_summary: candidateCard.querySelector('.role-title').textContent.split(' - ')[1] || candidateCard.querySelector('.role-title').textContent,
            initials: candidateCard.querySelector('.initials-circle').textContent,
            screen_status: 'toBeScreened', // Default values - should be fetched from API
            l1_result: 'toBeScreened',
            l2_result: 'toBeScreened', 
            l3_result: 'toBeScreened',
            offer_status: 'not_initiated',
            joining_status: 'in_progress'
        };
    }
    
    // Fallback mock data
    return {
        candidate_id: candidateId,
        name: 'Unknown Candidate',
        jd_id: 'JD-XX',
        job_summary: 'Position',
        initials: 'UC',
        screen_status: 'toBeScreened',
        l1_result: 'toBeScreened',
        l2_result: 'toBeScreened',
        l3_result: 'toBeScreened', 
        offer_status: 'not_initiated',
        joining_status: 'in_progress'
    };
}

// Modal Event Listeners Setup
function setupModalEventListeners() {
    // Add Note Modal Events
    const addNoteModal = document.getElementById('addNoteModal');
    const closeAddNoteBtn = document.getElementById('closeAddNoteModal');
    const cancelAddNoteBtn = document.getElementById('cancelAddNote');
    const addNoteForm = document.getElementById('addNoteForm');
    
    if (closeAddNoteBtn) {
        closeAddNoteBtn.addEventListener('click', closeAddNoteModal);
    }
    
    if (cancelAddNoteBtn) {
        cancelAddNoteBtn.addEventListener('click', closeAddNoteModal);
    }
    
    if (addNoteForm) {
        addNoteForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleAddNote();
        });
    }
    
    // Take Action Modal Events
    const takeActionModal = document.getElementById('takeActionModal');
    const closeTakeActionBtn = document.getElementById('closeTakeActionModal');
    const cancelTakeActionBtn = document.getElementById('cancelTakeAction');
    const takeActionForm = document.getElementById('takeActionForm');
    const actionTypeSelect = document.getElementById('actionType');
    
    if (closeTakeActionBtn) {
        closeTakeActionBtn.addEventListener('click', closeTakeActionModal);
    }
    
    if (cancelTakeActionBtn) {
        cancelTakeActionBtn.addEventListener('click', closeTakeActionModal);
    }
    
    if (takeActionForm) {
        takeActionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleTakeAction();
        });
    }
    
    if (actionTypeSelect) {
        actionTypeSelect.addEventListener('change', function() {
            handleActionTypeChange(this.value);
        });
    }
    
    // Setup salary calculation for offer details
    setupSalaryCalculation();
    
    // Close modals when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === addNoteModal) {
            closeAddNoteModal();
        }
        if (e.target === takeActionModal) {
            closeTakeActionModal();
        }
    });
    
    // Close modals with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (addNoteModal && addNoteModal.classList.contains('show')) {
                closeAddNoteModal();
            }
            if (takeActionModal && takeActionModal.classList.contains('show')) {
                closeTakeActionModal();
            }
        }
    });
}

// Form Handlers
function handleAddNote() {
    const formData = new FormData(document.getElementById('addNoteForm'));
    const noteData = {
        candidate_id: currentCandidateId,
        activity_type: formData.get('noteType'),
        activity_title: formData.get('noteTitle'),
        notes: formData.get('noteContent'),
        priority: formData.get('notePriority'),

    };
    
    console.log('Adding note:', noteData);

    // TODO: Send to backend
    fetch('/api/candidate_musters/add_note/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify(noteData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Note added successfully!\n\nNote: ' + noteData.activity_title + '\nContent: ' + noteData.notes);
            closeAddNoteModal();
        } else {
            showNotification('Failed to add note: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred while adding the note', 'error');
    });
    
    closeAddNoteModal();
}

function handleTakeAction() {
    const form = document.getElementById('takeActionForm');
    const formData = new FormData(form);
    
    // Validate required fields before sending
    if (!currentCandidateId) {
        showNotification('Error: No candidate selected', 'error');
        return;
    }
    
    const actionType = formData.get('actionType');
    if (!actionType) {
        showNotification('Please select an action type', 'error');
        return;
    }
    
    // Validate action-specific required fields
    if (actionType === 'reject') {
        const rejectionReason = formData.get('rejectionReason');
        if (!rejectionReason) {
            showNotification('Please select a rejection reason', 'error');
            return;
        }
    }
    
    if (actionType === 'put_on_hold') {
        const holdReason = formData.get('holdReason');
        if (!holdReason) {
            showNotification('Please select a hold reason', 'error');
            return;
        }
    }
    
    if (actionType === 'schedule_interview') {
        const interviewDate = formData.get('interviewDate');
        const interviewType = formData.get('interviewType');
        const interviewLevel = formData.get('interviewLevel');
        const interviewer = formData.get('interviewer');
        const interviewerEmail = formData.get('interviewerEmail');
        
        if (!interviewDate) {
            showNotification('Please select interview date and time', 'error');
            return;
        }
        if (!interviewType) {
            showNotification('Please select interview type', 'error');
            return;
        }
        if (!interviewLevel) {
            showNotification('Please select interview level', 'error');
            return;
        }
        if (!interviewer || interviewer.trim() === '') {
            showNotification('Please enter interviewer name', 'error');
            return;
        }
        if (!interviewerEmail || interviewerEmail.trim() === '') {
            showNotification('Please enter interviewer email', 'error');
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(interviewerEmail)) {
            showNotification('Please enter a valid interviewer email address', 'error');
            return;
        }
    }
    
    if (actionType === 'send_offer') {
        const basicSalary = formData.get('basicSalary');
        const totalSalary = formData.get('totalSalary');
        const joiningDate = formData.get('joiningDate');
        
        if (!basicSalary || parseFloat(basicSalary) <= 0) {
            showNotification('Please enter a valid basic salary', 'error');
            return;
        }
        
        if (!totalSalary || parseFloat(totalSalary) <= 0) {
            showNotification('Total salary must be greater than 0', 'error');
            return;
        }
        
        if (!joiningDate) {
            showNotification('Please select a joining date', 'error');
            return;
        }
        
        // Validate joining date is not in the past
        const selectedDate = new Date(joiningDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
        
        if (selectedDate < today) {
            showNotification('Joining date cannot be in the past', 'error');
            return;
        }
    }
    
    if (actionType === 'manage_offer_status') {
        const offerStatus = formData.get('offerStatus');
        if (!offerStatus) {
            showNotification('Please select an offer status', 'error');
            return;
        }
    }
    
    if (actionType === 'manage_hiring_status') {
        const hiringStatus = formData.get('hiringStatus');
        if (!hiringStatus) {
            showNotification('Please select a hiring status', 'error');
            return;
        }
    }
    
    const actionData = {
        candidate_id: currentCandidateId,
        actionType: actionType,
        actionComments: formData.get('actionComments'),
        notifyCandidate: formData.get('notifyCandidate') === 'on'
    };
    
    // Add specific fields based on action type
    if (actionType === 'reject') {
        actionData.rejectionReason = formData.get('rejectionReason');
    } else if (actionType === 'put_on_hold') {
        actionData.holdReason = formData.get('holdReason');
    } else if (actionType === 'schedule_interview') {
        actionData.interviewDate = formData.get('interviewDate');
        actionData.interviewType = formData.get('interviewType');
        actionData.interviewLevel = formData.get('interviewLevel');
        actionData.interviewer = formData.get('interviewer');
        actionData.interviewerEmail = formData.get('interviewerEmail');
        actionData.interviewLink = formData.get('interviewLink');
    } else if (actionType === 'send_offer') {
        actionData.basicSalary = formData.get('basicSalary');
        actionData.hra = formData.get('hra');
        actionData.specialAllowance = formData.get('specialAllowance');
        actionData.pf = formData.get('pf');
        actionData.gratuity = formData.get('gratuity');
        actionData.bonus = formData.get('bonus');
        actionData.other = formData.get('other');
        actionData.totalSalary = formData.get('totalSalary');
        actionData.joiningDate = formData.get('joiningDate');
    } else if (actionType === 'manage_offer_status') {
        actionData.offerStatus = formData.get('offerStatus');
    } else if (actionType === 'manage_hiring_status') {
        actionData.hiringStatus = formData.get('hiringStatus');
    }
    
    console.log('Taking action:', actionData);
    
    // Show loading state - find the submit button properly
    const submitButton = form.querySelector('button[type="submit"]') || 
                        document.querySelector('button[form="takeActionForm"][type="submit"]') ||
                        document.querySelector('.modal-footer .btn-primary');
    
    let originalButtonText = 'Execute Action';
    if (submitButton) {
        originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';
    }
    
    // Send to backend
    fetch('/api/candidate_action/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify(actionData)
    })
    .then(async response => {
        // Check if the response is ok
        if (!response.ok) {
            // Always try to get the exact backend error message first
            try {
                const data = await response.json();
                // Use the exact backend error message
                const backendError = data.error || data.message;
                if (backendError) {
                    throw new Error(backendError);
                }

                // Only use generic message if absolutely no backend message available
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            } catch (jsonError) {
                // If JSON parsing fails, still try to use status text or minimal fallback
                if (jsonError) {
                    throw new Error(`HTTP ${response.status}: ${jsonError}`); // Use the JSON parsing error if available
                }
            }
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Always show the backend message if available, otherwise use generic success message
            const message = data.message || 'Action executed successfully!';
            showNotification(message, 'success');
            closeTakeActionModal();
            // Refresh candidates list
            if (typeof window.filterCandidates === 'function') {
                window.filterCandidates();
            } else {
                // Fallback: reload the page if filterCandidates is not available
                window.location.reload();
            }
        } else {
            // Always show the backend error message if available
            const errorMessage = data.error || data.message || 'Unknown error occurred';
            showNotification(errorMessage, 'error');
        }
    })
    .catch(error => {
        console.error('Error executing action:', error);
        
        // Handle different types of errors
        let errorMessage = 'An error occurred while executing the action';
        
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            errorMessage = 'Network error. Please check your connection and try again';
        } else if (error.name === 'SyntaxError') {
            errorMessage = 'Invalid response from server. Please try again';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    })
    .finally(() => {
        // Restore button state
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
}

function handleActionTypeChange(actionType) {
    hideAllActionGroups();
    
    switch (actionType) {
        case 'reject':
            document.getElementById('rejectionReasonGroup').style.display = 'block';
            break;
        case 'put_on_hold':
            document.getElementById('holdReasonGroup').style.display = 'block';
            break;
        case 'schedule_interview':
            document.getElementById('interviewDetailsGroup').style.display = 'block';
            // Add required attributes for interview fields
            setInterviewRequiredFields();
            break;
        case 'send_offer':
            document.getElementById('offerDetailsGroup').style.display = 'block';
            // Add required attributes for offer fields
            setOfferRequiredFields();
            // Set default joining date to 30 days from today
            setDefaultJoiningDate();
            break;
        case 'manage_offer_status':
            document.getElementById('offerStatusManageGroup').style.display = 'block';
            // Add required attributes for offer status fields
            setOfferStatusRequiredFields();
            break;
        case 'manage_hiring_status':
            document.getElementById('hiringStatusManageGroup').style.display = 'block';
            // Add required attributes for hiring status fields
            setHiringStatusRequiredFields();
            break;
    }
}

// Utility functions
function getCsrfToken() {
    // First try to get from cookies
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') {
            return decodeURIComponent(value);
        }
    }
    
    // Try to get from meta tag (Django's recommended approach)
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }
    
    // Try to get from hidden form input
    const hiddenInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (hiddenInput) {
        return hiddenInput.value;
    }
    
    // Log warning if no CSRF token found
    console.warn('CSRF token not found. This may cause authentication issues.');
    return '';
}

function showNotification(message, type = 'info') {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `custom-notification custom-notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#10b981';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
    }
    
    // Add close button
    const closeButton = document.createElement('span');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        float: right;
        margin-left: 10px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
    `;
    closeButton.onclick = () => notification.remove();
    
    // Add message
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    
    notification.appendChild(messageSpan);
    notification.appendChild(closeButton);
    
    // Add animation styles if not already present
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to document
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds (longer for errors)
    const duration = type === 'error' ? 8000 : 5000;
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
    
    // Also log to console for debugging
    console.log(`${type.toUpperCase()}: ${message}`);
}

// Salary calculation functionality
function setupSalaryCalculation() {
    const salaryInputs = ['basicSalary', 'hra', 'specialAllowance', 'pf', 'gratuity', 'bonus', 'other'];
    const totalSalaryInput = document.getElementById('totalSalary');
    
    salaryInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', calculateTotalSalary);
            input.addEventListener('change', calculateTotalSalary);
        }
    });
    
    function calculateTotalSalary() {
        let total = 0;
        
        salaryInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input && input.value) {
                const value = parseFloat(input.value) || 0;
                // convert it to annual salary
                total += value * 12;
            }
        });
        
        if (totalSalaryInput) {
            totalSalaryInput.value = total.toFixed(2);
        }
    }
}

// Set default joining date
function setDefaultJoiningDate() {
    const joiningDateInput = document.getElementById('joiningDate');
    if (joiningDateInput && !joiningDateInput.value) {
        // Set default to 30 days from today
        const today = new Date();
        const defaultDate = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
        
        // Format date as YYYY-MM-DD for date input
        const year = defaultDate.getFullYear();
        const month = String(defaultDate.getMonth() + 1).padStart(2, '0');
        const day = String(defaultDate.getDate()).padStart(2, '0');
        
        joiningDateInput.value = `${year}-${month}-${day}`;
    }
}