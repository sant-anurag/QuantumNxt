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
				console.log("Fetching activities from URL:", url);
				fetch(url)
					.then(response => response.json())
					.then(data => {
						console.log("Fetched activities data:", data);
						if (data.success && Array.isArray(data.activity_records)) {
							let activitiesHtml = `<h3 class='font-bold mb-2'>Candidate Activities</h3>`;
							if (data.activity_records.length === 0) {
								activitiesHtml += `<div class='text-gray-500'>No activities found.</div>`;
							} else {
								activitiesHtml += `<ul class='space-y-4'>`;
								data.activity_records.forEach(activity => {
									activitiesHtml += `
										<li class='border rounded p-3 bg-gray-50'>
											<div class='flex flex-col gap-2'>
												<div class='flex justify-between align-center gap-2'>
													<div>
														<span class='font-semibold'>Date:</span>
														<span class='text-sm text-gray-500'>${activity.activity_date}</span>
													</div>
													<div>
														<span class='font-semibold'>Type:</span>
														<span class='text-sm text-gray-500'>${activity.activity_type}</span>
													</div>
												</div>
												<div class='flex justify-between align-center gap-2 '>
													<div>
														<span class='font-semibold'>Author:</span>
														<span class='text-sm text-gray-500'>${activity.hr_member_name}</span>
													</div>
													<div><span class='font-semibold'>JD:</span> <span class='text-sm text-gray-500'>${activity.jd_summary}</span></div>
												</div>
												<div><span class='font-semibold'>Note:</span> <input type='text' value="${activity.notes || ''}" class="activity-note-input border rounded px-2 py-1 my-1 w-full" data-activity-id="${activity.activity_id}" disabled></div>
												${userRole === "Admin" ? `
												<div class='activities-controls flex justify-end gap-2 px-2'>
													<button class='edit-note-btn' data-activity-id="${activity.activity_id}">Edit</button>
													<button class='save-note-btn' data-activity-id="${activity.activity_id}" style="display:none;">Save</button>
													<button class='delete-note-btn' data-activity-id="${activity.activity_id}" style="display:none;">Delete</button>
													<button class='cancel-note-btn' data-activity-id="${activity.activity_id}" style="display:none;">Cancel</button>
												</div>
												` : ''}
											</div>
										</li>
									`;
								});
								activitiesHtml += `</ul>`;
							}
							activitiesHtml += `
								<div class=\"add-note-section mt-8 px-6 py-5 border-t border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 rounded-b-lg shadow-sm\">
									<h4 class=\"font-bold mb-3 text-blue-800 text-lg flex items-center gap-2\">
										<i class=\"fa fa-plus\" aria-hidden=\"true\" class='w-5 h-5 text-blue-500'></i>
										Add a New Note
									</h4>
									<form class=\"flex flex-col md:flex-row gap-3 items-center\" onsubmit=\"return false;\">
										<input type=\"text\" id=\"newNoteInput\" class=\"activity-note-input border border-blue-300 rounded-lg px-3 py-4 w-full focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-800 placeholder-gray-400 text-base transition\" placeholder=\"Type your note here...\" maxlength=\"255\">
										<button id=\"addNoteBtn\" class=\"bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2 rounded-lg font-semibold shadow hover:from-blue-700 hover:to-blue-600 transition duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center gap-2\">
											<i class=\"fa fa-check\" aria-hidden=\"true\" class='w-5 h-5 text-gray-500'></i>
											Add Note
										</button>
									</form>
									<div id=\"addNoteError\" class=\"text-red-500 mt-2 text-sm font-medium\" style=\"display:none;\"></div>
								</div>
							`;
							showModal(activitiesHtml);
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
		console.log("Showing modal with content:", contentHtml);
        candidateActivityModal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                ${contentHtml}
                <button class="close-modal-btn mt-4">Close</button>
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
			const noteText = noteInput.value.trim();
			const errorDiv = document.getElementById('addNoteError');
			errorDiv.style.display = 'none';
			if (!noteText) {
				errorDiv.textContent = 'Note cannot be empty.';
				errorDiv.style.display = 'block';
				return;
			}
			const candidateId = candidateActivityModal.dataset.candidateId;
			if (!candidateId) {
				errorDiv.textContent = 'Candidate ID not found.';
				errorDiv.style.display = 'block';
				return;
			}
			const activityType = 'other';
			fetch('/api/candidate_musters/add_note/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': getCSRFToken(),
				},
				body: JSON.stringify({
					candidate_id: candidateId,
					activity_type: activityType,
					notes: noteText
				})
			})
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					noteInput.value = '';
					errorDiv.style.display = 'none';
					// Refresh activities list by simulating activitiesBtn click
					const activitiesBtn = document.querySelector(`.activities-btn[data-candidate-id='${candidateId}']`);
					if (activitiesBtn) {
						activitiesBtn.click();
					} else {
						hideModal();
					}
				} else {
					errorDiv.textContent = data.error || 'Failed to add note.';
					errorDiv.style.display = 'block';
				}
			})
			.catch(() => {
				errorDiv.textContent = 'Error adding note.';
				errorDiv.style.display = 'block';
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