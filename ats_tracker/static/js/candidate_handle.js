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
        const cardDiv = document.createElement('div');
        cardDiv.className = 'candidate-card';
        
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
                <button class="action-btn view-resume" onclick="viewResume(${candidate.candidate_id})">View Resume</button>
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
            </div>

            <div class="current-stage-status">
                <span class="status-label">${currentStageInfo.stage}:</span>
                <span class="status-value ${currentStageInfo.statusClass}">${currentStageInfo.statusText}</span>
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
        offer: 'upcoming'
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
    
    // Calculate progress percentage
    const progressPercentage = Math.round((completedStages / 5) * 100);
    
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
    
    // If all interviews are selected, show offer status
    return {
        stage: 'Offer',
        statusText: getOfferStatusDisplayText(candidate.offer_status),
        statusClass: getOfferStatusClass(candidate.offer_status)
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

function getStageTooltipText(stage, status) {
    if (!status || status === 'toBeScreened') {
        return stage === 'offer' ? 'Offer not initiated' : 'Pending';
    }
    
    if (stage === 'offer') {
        return getOfferStatusDisplayText(status);
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
function viewResume(candidateId) {
    console.log('View resume for candidate:', candidateId);
    // TODO: Implement resume viewing functionality
}

function addNote(candidateId) {
    openAddNoteModal(candidateId);
}

function takeAction(candidateId) {
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
    currentCandidateId = candidateId;
    
    // Find candidate data from the current candidates list
    const candidateData = findCandidateData(candidateId);
    if (candidateData) {
        currentCandidateData = candidateData;
        populateTakeActionModal(candidateData);
    }
    
    const modal = document.getElementById('takeActionModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
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
    document.getElementById('rejectionReasonGroup').style.display = 'none';
    document.getElementById('holdReasonGroup').style.display = 'none';
    document.getElementById('interviewDetailsGroup').style.display = 'none';
}

// Helper function to find candidate data
function findCandidateData(candidateId) {
    // This would typically come from your data source
    // For now, we'll create a mock function
    // In a real implementation, you'd maintain the candidates array or fetch from API
    
    // Try to extract from DOM first
    const candidateCards = document.querySelectorAll('.candidate-card');
    for (let card of candidateCards) {
        const viewResumeBtn = card.querySelector('.view-resume');
        if (viewResumeBtn && viewResumeBtn.onclick && viewResumeBtn.onclick.toString().includes(candidateId)) {
            return {
                candidate_id: candidateId,
                name: card.querySelector('.candidate-name').textContent,
                jd_id: card.querySelector('.role-title').textContent.split(' - ')[0],
                job_summary: card.querySelector('.role-title').textContent.split(' - ')[1] || card.querySelector('.role-title').textContent,
                initials: card.querySelector('.initials-circle').textContent,
                screen_status: 'toBeScreened', // Default values - should be fetched from API
                l1_result: 'toBeScreened',
                l2_result: 'toBeScreened', 
                l3_result: 'toBeScreened',
                offer_status: 'not_initiated'
            };
        }
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
        offer_status: 'not_initiated'
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
        note_type: formData.get('noteType'),
        title: formData.get('noteTitle'),
        content: formData.get('noteContent'),
        priority: formData.get('notePriority'),

    };
    
    console.log('Adding note:', noteData);
    
    // TODO: Send to backend
    // fetch('/api/add_note/', {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'X-CSRFToken': getCsrfToken()
    //     },
    //     body: JSON.stringify(noteData)
    // })
    // .then(response => response.json())
    // .then(data => {
    //     if (data.success) {
    //         showNotification('Note added successfully!', 'success');
    //         closeAddNoteModal();
    //     } else {
    //         showNotification('Failed to add note: ' + data.error, 'error');
    //     }
    // })
    // .catch(error => {
    //     console.error('Error:', error);
    //     showNotification('An error occurred while adding the note', 'error');
    // });
    
    // For demo purposes
    alert('Note added successfully!\n\nNote: ' + noteData.title + '\nContent: ' + noteData.content);
    closeAddNoteModal();
}

function handleTakeAction() {
    const formData = new FormData(document.getElementById('takeActionForm'));
    const actionData = {
        candidate_id: currentCandidateId,
        action_type: formData.get('actionType'),
        comments: formData.get('actionComments'),
        notify_candidate: formData.get('notifyCandidate') === 'on'
    };
    
    // Add specific fields based on action type
    const actionType = formData.get('actionType');
    if (actionType === 'reject') {
        actionData.rejection_reason = formData.get('rejectionReason');
    } else if (actionType === 'put_on_hold') {
        actionData.hold_reason = formData.get('holdReason');
    } else if (actionType === 'schedule_interview') {
        actionData.interview_date = formData.get('interviewDate');
        actionData.interview_type = formData.get('interviewType');
        actionData.interviewer = formData.get('interviewer');
    }
    
    console.log('Taking action:', actionData);
    
    // TODO: Send to backend
    // fetch('/api/take_action/', {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'X-CSRFToken': getCsrfToken()
    //     },
    //     body: JSON.stringify(actionData)
    // })
    // .then(response => response.json())
    // .then(data => {
    //     if (data.success) {
    //         showNotification('Action executed successfully!', 'success');
    //         closeTakeActionModal();
    //         // Refresh candidates list
    //         filterCandidates();
    //     } else {
    //         showNotification('Failed to execute action: ' + data.error, 'error');
    //     }
    // })
    // .catch(error => {
    //     console.error('Error:', error);
    //     showNotification('An error occurred while executing the action', 'error');
    // });
    
    // For demo purposes
    alert('Action executed successfully!\n\nAction: ' + actionData.action_type + '\nComments: ' + actionData.comments);
    closeTakeActionModal();
    
    // Simulate refresh
    setTimeout(() => {
        filterCandidates();
    }, 500);
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
            break;
    }
}

// Utility functions
function getCsrfToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') {
            return value;
        }
    }
    return '';
}

function showNotification(message, type = 'info') {
    // TODO: Implement notification system
    console.log(`${type.toUpperCase()}: ${message}`);
}