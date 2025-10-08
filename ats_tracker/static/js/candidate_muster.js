// candidate_muster.js
document.addEventListener('DOMContentLoaded', function() {
	// Candidate table logic
    const candidateTableSection = document.getElementById('candidate-table-section');
    const userRole = candidateTableSection.dataset.userRole;
	const candidateTableContainer = document.getElementById('candidate-table-container');
	const candidatePagination = document.getElementById('candidate-pagination');
	const filterBtn = document.getElementById('filterBtn');

	
	const teamSelect = document.getElementById('teamSelect');
	const memberSelect = document.getElementById('memberSelect');
	const jdSelect = document.getElementById('jdSelect');
	const candidateSearchInput = document.getElementById('candidateSearchInput');
	const candidateSuggestions = document.getElementById('candidateSuggestions');

    console.log("User role:", userRole);

	function renderCandidateTable(candidates) {
		if (!candidates || candidates.length === 0) {
			candidateTableContainer.innerHTML = '<div class="text-gray-500 text-center py-8">No candidates found.</div>';
			return;
		}
		let html = `<table class="min-w-full bg-white rounded-lg shadow-md">
			<thead class="bg-blue-50">
				<tr>
					<th class="px-4 py-2 text-left">Name</th>
					<th class="px-4 py-2 text-left">Email</th>
					<th class="px-4 py-2 text-left">Phone</th>
					<th class="px-4 py-2 text-left">Experience</th>
					<th class="px-4 py-2 text-left">JD</th>
					<th class="px-4 py-2 text-center">Actions</th>
				</tr>
			</thead>
			<tbody>`;
		candidates.forEach(candidate => {
			html += `<tr class="hover:bg-blue-50">
				<td class="px-4 py-2">${candidate.name}</td>
				<td class="px-4 py-2">${candidate.email}</td>
				<td class="px-4 py-2">${candidate.phone || ''}</td>
				<td class="px-4 py-2">${candidate.experience || ''}</td>
				<td class="px-4 py-2">${candidate.jd_summary || ''}</td>
				<td class="px-4 py-2 text-center">
                    <button class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition activities-btn" data-candidate-id="${candidate.candidate_id}">Activities</button>
				</td>
			</tr>`;
		});
		html += '</tbody></table>';
		candidateTableContainer.innerHTML = html;
		// Attach activities button click events
		const activitiesBtns = candidateTableContainer.querySelectorAll('.activities-btn');
		activitiesBtns.forEach(btn => {
			btn.addEventListener('click', function(e) {
				const candidateId = btn.dataset.candidateId;
				candidateActivityModal.dataset.candidateId = candidateId;
				const fromDate = document.getElementById('fromDate') ? document.getElementById('fromDate').value : '';
				const toDate = document.getElementById('toDate') ? document.getElementById('toDate').value : '';
				url = `/api/candidate_musters/${candidateId}/?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`
				fetch(url)
					.then(response => response.json())
					.then(data => {
						if (data.success && Array.isArray(data.activity_records)) {
							let modalHtml = `
								<div class="modal-header">
									<h3 class='font-bold text-xl text-blue-900'>Candidate Activities</h3>
								</div>
								<div class="activities-section">
							`;
							
							if (data.activity_records.length === 0) {
								modalHtml += `<div class='no-activities-message'>No activities found for this candidate.</div>`;
							} else {
								modalHtml += `<div class='activities-container'>`;
								data.activity_records.forEach(activity => {
									modalHtml += `
										<div class='activity-card'>
											<div class='activity-header'>
												<div class='activity-title-section'>
													<h5 class='activity-title'>${activity.note_title || 'Untitled Activity'}</h5>
													<div class='activity-meta'>
														<span class='activity-type-badge activity-type-${activity.activity_type.toLowerCase().replace(/_/g, '-')}'>${activity.activity_type.replace(/_/g, ' ')}</span>
														<span class='activity-date'>${activity.activity_date}</span>
													</div>
												</div>
												<div class='activity-author'>
													<span class='author-label'>By:</span>
													<span class='author-name'>${activity.hr_member_name}</span>
												</div>
											</div>
											
											<div class='activity-body'>
												<div class='jd-info'>
													<span class='jd-label'>Job Description:</span>
													<span class='jd-summary'>${activity.jd_summary}</span>
												</div>
												<div class='note-section'>
													<label class='note-label'>Notes:</label>
													<textarea class='activity-note-input' data-activity-id='${activity.activity_id}' disabled rows='3'>${activity.notes || ''}</textarea>
												</div>
											</div>
											
											${userRole === "Admin" ? `
											<div class='activity-actions'>
												<button class='action-btn edit-btn edit-note-btn' data-activity-id='${activity.activity_id}'>
													<i class='fa fa-edit'></i> Edit
												</button>
												<button class='action-btn save-btn save-note-btn' data-activity-id='${activity.activity_id}' style='display:none;'>
													<i class='fa fa-save'></i> Save
												</button>
												<button class='action-btn delete-btn delete-note-btn' data-activity-id='${activity.activity_id}' style='display:none;'>
													<i class='fa fa-trash'></i> Delete
												</button>
												<button class='action-btn cancel-btn cancel-note-btn' data-activity-id='${activity.activity_id}' style='display:none;'>
													<i class='fa fa-times'></i> Cancel
												</button>
											</div>
											` : ''}
										</div>
									`;
								});
								modalHtml += `</div>`;
							}
							
							modalHtml += `</div>`;
							
							// Add footer with add note section
							modalHtml += `
								<div class="modal-footer">
									<div class="add-note-section">
										<div class="mb-6">
											<h4 class="font-bold text-xl text-blue-900 flex items-center gap-3">
												<div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
													<i class="fa fa-plus text-white text-sm" aria-hidden="true"></i>
												</div>
												Add New Activity Note
											</h4>
											<p class="text-blue-600 text-sm mt-1 ml-11">Record important candidate interactions and feedback</p>
										</div>
										
										<form class="space-y-5" onsubmit="return false;">
											<!-- Activity Type Selection -->
											<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div class="form-group">
													<label for="activityTypeSelect" class="block text-sm font-semibold text-gray-700 mb-2">
														Activity Type <span class="text-red-500">*</span>
													</label>
													<select id="activityTypeSelect" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm transition-all duration-200">
														<option value="">Select activity type...</option>
														<option value="interview_feedback">📋 Interview Feedback</option>
														<option value="screening_notes">🔍 Screening Notes</option>
														<option value="hr_notes">👥 HR Notes</option>
														<option value="technical_assessment">💻 Technical Assessment</option>
														<option value="offer_details">💼 Offer Details</option>
														<option value="onboarding">🎯 Onboarding</option>
														<option value="rejection">❌ Rejection</option>
														<option value="general">📝 General</option>
														<option value="other">🔗 Other</option>
													</select>
												</div>
												
												<!-- Priority Selection -->
												<div class="form-group">
													<label for="prioritySelect" class="block text-sm font-semibold text-gray-700 mb-2">
														Priority Level <span class="text-red-500">*</span>
													</label>
													<select id="prioritySelect" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm transition-all duration-200">
														<option value="medium">🟡 Medium Priority</option>
														<option value="high">🔴 High Priority</option>
														<option value="low">🟢 Low Priority</option>
													</select>
												</div>
											</div>
											
											<!-- Note Title -->
											<div class="form-group">
												<label for="noteTitleInput" class="block text-sm font-semibold text-gray-700 mb-2">
													Note Title <span class="text-red-500">*</span>
												</label>
												<input type="text" id="noteTitleInput" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200" placeholder="Enter a descriptive title for this note..." maxlength="100">
											</div>
											
											<!-- Note Content -->
											<div class="form-group">
												<label for="newNoteInput" class="block text-sm font-semibold text-gray-700 mb-2">
													Note Content <span class="text-red-500">*</span>
												</label>
												<textarea id="newNoteInput" rows="4" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200 resize-none" placeholder="Enter detailed notes about this activity..." maxlength="500"></textarea>
												<div class="text-right text-xs text-gray-500 mt-1">
													<span id="charCount">0</span>/500 characters
												</div>
											</div>
											
											<!-- Action Buttons -->
											<div class="flex flex-col sm:flex-row gap-3 pt-4">
												<button id="addNoteBtn" class="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 transform hover:scale-[1.02]">
													<i class="fa fa-save text-sm" aria-hidden="true"></i>
													Save Activity Note
												</button>
												<button type="button" onclick="document.getElementById('newNoteInput').value=''; document.getElementById('noteTitleInput').value=''; document.getElementById('activityTypeSelect').value=''; document.getElementById('prioritySelect').value='medium';" class="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-200 flex items-center justify-center gap-2">
													<i class="fa fa-eraser text-sm" aria-hidden="true"></i>
													Clear Form
												</button>
											</div>
										</form>
										
										<div id="addNoteError" class="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hidden">
											<div class="flex items-center gap-2">
												<i class="fa fa-exclamation-circle" aria-hidden="true"></i>
												<span class="error-message"></span>
											</div>
										</div>
										
										<div id="addNoteSuccess" class="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium hidden">
											<div class="flex items-center gap-2">
												<i class="fa fa-check-circle" aria-hidden="true"></i>
												<span>Note added successfully!</span>
											</div>
										</div>
									</div>
									<button class="close-modal-btn">Close</button>
								</div>
							`;
							
							// Add character counter functionality after modal is shown
							setTimeout(() => {
								const textarea = document.getElementById('newNoteInput');
								const charCount = document.getElementById('charCount');
								if (textarea && charCount) {
									textarea.addEventListener('input', function() {
										charCount.textContent = this.value.length;
										if (this.value.length > 450) {
											charCount.classList.add('text-red-500');
											charCount.classList.remove('text-gray-500');
										} else {
											charCount.classList.add('text-gray-500');
											charCount.classList.remove('text-red-500');
										}
									});
								}
							}, 100);
							showModal(modalHtml);
						} else {
							showModal(`<div class='text-red-500'>Failed to load activities.</div>`);
						}
					})
					.catch(() => {
						showModal(`<div class='text-red-500'>Error loading activities.</div>`);
					});
			});
		});
	}

	function renderPagination(page, numPages) {
		candidatePagination.innerHTML = '';
		if (numPages <= 1) return;
		for (let i = 1; i <= numPages; i++) {
			const btn = document.createElement('button');
			btn.textContent = i;
			btn.className = `px-3 py-1 rounded border ${i === page ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'} hover:bg-blue-100`;
			btn.addEventListener('click', () => fetchCandidates(i));
			candidatePagination.appendChild(btn);
		}
	}

	function fetchCandidates(page = 1) {
		const teamId = teamSelect ? teamSelect.value : 'all';
		const jdId = jdSelect ? jdSelect.value : 'all';
		const memberId = memberSelect ? memberSelect.value : 'all';
		const searchQuery = candidateSearchInput ? candidateSearchInput.value.trim() : '';
        const fromDate = document.getElementById('fromDate') ? document.getElementById('fromDate').value : '';
        const toDate = document.getElementById('toDate') ? document.getElementById('toDate').value : '';
		const url = `/get_search_candidates/?team_id=${teamId}&jd_id=${jdId}&member_id=${memberId}&query=${encodeURIComponent(searchQuery)}&from_date=${fromDate}&to_date=${toDate}&page=${page}`;
		candidateTableContainer.innerHTML = '<div class="text-gray-400 text-center py-8">Loading...</div>';
		fetch(url)
			.then(response => response.json())
			.then(data => {
				renderCandidateTable(data.candidates);
				renderPagination(data.page, data.num_pages);
			})
			.catch(() => {
				candidateTableContainer.innerHTML = '<div class="text-red-500 text-center py-8">Failed to load candidates.</div>';
			});
	}

	// Initial load
	fetchCandidates(1);

	// Filter button click
	filterBtn.addEventListener('click', function() {
		fetchCandidates(1);
	});

	function fetchMembers(teamId) {
		fetch(`/get_team_members/${teamId}/`)
			.then(response => response.json())
			.then(data => {
				memberSelect.innerHTML = '<option value="all">All Members</option>';
				if (data.success && Array.isArray(data.members)) {
					data.members.forEach(member => {
						const option = document.createElement('option');
						option.value = member.emp_id;
						option.textContent = `${member.first_name} ${member.last_name} (${member.email})`;
						memberSelect.appendChild(option);
					});
				}
			})
			.catch(err => {
				memberSelect.innerHTML = '<option value="all">All Members</option>';
			});
	}

	// Initial fetch for all teams
	fetchMembers('all');

	// Refetch members on team change
	teamSelect.addEventListener('change', function() {
		const selectedTeam = teamSelect.value;
		fetchMembers(selectedTeam);
	});

	// Candidate search suggestions
	let suggestionTimeout = null;
	candidateSearchInput.addEventListener('input', function() {
		const query = candidateSearchInput.value.trim();
		if (suggestionTimeout) clearTimeout(suggestionTimeout);
		if (query.length < 2) {
			candidateSuggestions.style.display = 'none';
			candidateSuggestions.innerHTML = '';
			return;
		}
		suggestionTimeout = setTimeout(() => {
			const teamId = teamSelect.value;
			const jdId = jdSelect ? jdSelect.value : 'all';
			const memberId = memberSelect.value;
			fetch(`/get_candidate_suggestions/${encodeURIComponent(query)}/?team_id=${teamId}&jd_id=${jdId}&member_id=${memberId}`)
				.then(response => response.json())
				.then(data => {
					candidateSuggestions.innerHTML = '';
					if (data.success && Array.isArray(data.candidates) && data.candidates.length > 0) {
						data.candidates.forEach(candidate => {
							const li = document.createElement('li');
							li.textContent = `${candidate.name} (${candidate.email})`;
							li.dataset.candidateId = candidate.candidate_id;
							li.addEventListener('mousedown', function(e) {
								candidateSearchInput.value = candidate.name;
								candidateSuggestions.style.display = 'none';
								candidateSuggestions.innerHTML = '';
								// Optionally, trigger filter or load candidate info here
							});
							candidateSuggestions.appendChild(li);
						});
						candidateSuggestions.style.display = 'block';
					} else {
						candidateSuggestions.style.display = 'none';
					}
				})
				.catch(() => {
					candidateSuggestions.style.display = 'none';
				});
		}, 250);
	});

	// Hide suggestions on blur
	candidateSearchInput.addEventListener('blur', function() {
		setTimeout(() => {
			candidateSuggestions.style.display = 'none';
		}, 150);
	});
    // Modal logic
    const candidateActivityModal = document.getElementById('candidate-activity-modal');

    function showModal(contentHtml) {
        candidateActivityModal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                ${contentHtml}
            </div>
        `;
        candidateActivityModal.style.display = 'block';
        attachCloseModal();
    }

    function hideModal() {
        candidateActivityModal.style.display = 'none';
    }

    function attachCloseModal() {
        const closeBtn = candidateActivityModal.querySelector('.close-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', hideModal);
        }
        const overlay = candidateActivityModal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', hideModal);
        }
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideModal();
        }
    });

    // Example usage: showModal('<div>Modal Content Here</div>');

	// Handle adding new note
	candidateActivityModal.addEventListener('click', function(e) {
		if (e.target && e.target.id === 'addNoteBtn') {
			const noteInput = document.getElementById('newNoteInput');
			const noteTitleInput = document.getElementById('noteTitleInput');
			const activityTypeSelect = document.getElementById('activityTypeSelect');
			const prioritySelect = document.getElementById('prioritySelect');
			
			const noteText = noteInput ? noteInput.value.trim() : '';
			const noteTitle = noteTitleInput ? noteTitleInput.value.trim() : '';
			const activityType = activityTypeSelect ? activityTypeSelect.value : '';
			const priority = prioritySelect ? prioritySelect.value : 'medium';
			
			const errorDiv = document.getElementById('addNoteError');
			const successDiv = document.getElementById('addNoteSuccess');
			const errorMessage = errorDiv ? errorDiv.querySelector('.error-message') : null;
			
			// Hide previous messages
			if (errorDiv) errorDiv.classList.add('hidden');
			if (successDiv) successDiv.classList.add('hidden');
			
			// Validation
			if (!noteText) {
				if (errorMessage) errorMessage.textContent = 'Note content cannot be empty.';
				if (errorDiv) errorDiv.classList.remove('hidden');
				return;
			}
			
			if (!noteTitle) {
				if (errorMessage) errorMessage.textContent = 'Note title is required.';
				if (errorDiv) errorDiv.classList.remove('hidden');
				return;
			}
			
			if (!activityType) {
				if (errorMessage) errorMessage.textContent = 'Please select an activity type.';
				if (errorDiv) errorDiv.classList.remove('hidden');
				return;
			}
			
			const candidateId = candidateActivityModal.dataset.candidateId;
			if (!candidateId) {
				if (errorMessage) errorMessage.textContent = 'Candidate ID not found.';
				if (errorDiv) errorDiv.classList.remove('hidden');
				return;
			}
			
			// Disable button during submission
			const addBtn = document.getElementById('addNoteBtn');
			const originalText = addBtn.innerHTML;
			addBtn.innerHTML = '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Saving...';
			addBtn.disabled = true;
			
			fetch('/api/candidate_musters/add_note/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': getCSRFToken(),
				},
				body: JSON.stringify({
					candidate_id: candidateId,
					activity_type: activityType,
					activity_title: noteTitle,
					notes: noteText,
					priority: priority
				})
			})
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					// Clear form
					if (noteInput) noteInput.value = '';
					if (noteTitleInput) noteTitleInput.value = '';
					if (activityTypeSelect) activityTypeSelect.value = '';
					if (prioritySelect) prioritySelect.value = 'medium';
					
					// Show success message
					if (successDiv) successDiv.classList.remove('hidden');
					
					// Refresh activities list after a short delay
					setTimeout(() => {
						const activitiesBtn = document.querySelector(`.activities-btn[data-candidate-id='${candidateId}']`);
						if (activitiesBtn) {
							activitiesBtn.click();
						} else {
							hideModal();
						}
					}, 1500);
				} else {
					if (errorMessage) errorMessage.textContent = data.error || 'Failed to add note.';
					if (errorDiv) errorDiv.classList.remove('hidden');
				}
			})
			.catch(error => {
				console.error('Error adding note:', error);
				if (errorMessage) errorMessage.textContent = 'Network error occurred while adding note.';
				if (errorDiv) errorDiv.classList.remove('hidden');
			})
			.finally(() => {
				// Re-enable button
				if (addBtn) {
					addBtn.innerHTML = originalText;
					addBtn.disabled = false;
				}
			});
		}
	});

	// Helper to get CSRF token from cookies
	function getCSRFToken() {
		let name = 'csrftoken';
		let cookieValue = null;
		if (document.cookie && document.cookie !== '') {
			const cookies = document.cookie.split(';');
			for (let i = 0; i < cookies.length; i++) {
				const cookie = cookies[i].trim();
				if (cookie.substring(0, name.length + 1) === (name + '=')) {
					cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
					break;
				}
			}
		}
		return cookieValue;
	}
	
	});