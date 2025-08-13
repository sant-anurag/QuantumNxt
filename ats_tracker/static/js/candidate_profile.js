document.addEventListener('DOMContentLoaded', function () {
                       const searchBtn = document.getElementById('search-btn');
                       const resetBtn = document.getElementById('reset-btn');
                       const editBtn = document.getElementById('edit-btn');
                       const saveBtn = document.getElementById('save-btn');
                       const candidateDetails = document.getElementById('candidate-details');
                       const searchInput = document.getElementById('search-input');
                       const suggestionsBox = document.getElementById('suggestions');
                       let debounceTimeout = null;

                       searchBtn.addEventListener('click', function () {
                           const query = searchInput.value.trim();
                           if (query.length > 0) {
                               fetch(`/get_candidate_details_profile/?query=${encodeURIComponent(query)}`)
                                   .then(response => response.json())
                                   .then(data => {
                                       if (data.success) {
                                           candidateDetails.classList.remove('hidden');
                                           document.getElementById('candidate-name').textContent = data.data.name;
                                           document.getElementById('candidate-email').textContent = `Email: ${data.data.email}`;
                                           document.getElementById('candidate-phone').textContent = `Phone: ${data.data.phone}`;
                                           document.getElementById('candidate-experience').textContent = `Experience: ${data.data.experience}`;
                                           document.getElementById('candidate-skills').textContent = `Skills: ${data.data.skills}`;
                                           document.getElementById('screened-remarks').value = data.data.screened_remarks || '';
                                           document.getElementById('l1-comments').value = data.data.l1_comments || '';
                                           document.getElementById('l2-comments').value = data.data.l2_comments || '';
                                           document.getElementById('l3-comments').value = data.data.l3_comments || '';
                                           document.getElementById('candidate-status').value = data.data.status || 'toBeScreened';
                                           // Optionally set candidate-id if needed for save
                                           if (document.getElementById('candidate-id')) {
                                               document.getElementById('candidate-id').value = data.data.candidate_id;
                                           }
                                       } else {
                                           alert(data.message || 'Candidate not found.');
                                       }
                                   })
                                   .catch(error => {
                                       console.error('Error fetching candidate details:', error);
                                       alert('An error occurred while fetching candidate details.');
                                   });
                           } else {
                               alert('Please enter a search query.');
                           }
                       });

                       resetBtn.addEventListener('click', function () {
                           candidateDetails.classList.add('hidden');
                           searchInput.value = '';
                           suggestionsBox.classList.add('hidden');
                           suggestionsBox.innerHTML = '';
                       });

                       editBtn.addEventListener('click', function () {
                           document.querySelectorAll('#candidate-details input, #candidate-details textarea, #candidate-details select').forEach(el => {
                               el.disabled = false;
                           });
                           editBtn.classList.add('hidden');
                           saveBtn.classList.remove('hidden');
                       });

                       saveBtn.addEventListener('click', function () {
                           const candidateId = document.getElementById('candidate-id') ? document.getElementById('candidate-id').value : '';
                           const data = {
                               candidate_id: candidateId,
                               screened_remarks: document.getElementById('screened-remarks').value,
                               l1_comments: document.getElementById('l1-comments').value,
                               l2_comments: document.getElementById('l2-comments').value,
                               l3_comments: document.getElementById('l3-comments').value,
                               status: document.getElementById('candidate-status').value,
                           };

                           fetch('/save_candidate_details_profile/', {
                               method: 'POST',
                               headers: {
                                   'Content-Type': 'application/json',
                                   'X-CSRFToken': getCSRFToken(),
                               },
                               body: JSON.stringify(data),
                           })
                               .then(response => response.json())
                               .then(data => {
                                   if (data.success) {
                                       alert('Candidate details saved successfully!');
                                       document.querySelectorAll('#candidate-details input, #candidate-details textarea, #candidate-details select').forEach(el => {
                                           el.disabled = true;
                                       });
                                       saveBtn.classList.add('hidden');
                                       editBtn.classList.remove('hidden');
                                   } else {
                                       alert(data.message || 'Failed to save candidate details.');
                                   }
                               })
                               .catch(error => {
                                   console.error('Error saving candidate details:', error);
                                   alert('An error occurred while saving candidate details.');
                               });
                       });

                       function getCSRFToken() {
                           const cookieValue = document.cookie
                               .split('; ')
                               .find(row => row.startsWith('csrftoken='))
                               ?.split('=')[1];
                           return cookieValue || '';
                       }

                       // --- Dynamic Suggestions ---
                       searchInput.addEventListener('input', function () {
                           const query = searchInput.value.trim();
                           if (query.length >= 3) {
                               clearTimeout(debounceTimeout);
                               debounceTimeout = setTimeout(() => {
                                   fetch(`/candidate_suggestions/?q=${encodeURIComponent(query)}`)
                                       .then(response => response.json())
                                       .then(data => {
                                           suggestionsBox.innerHTML = '';
                                           if (data.results && data.results.length > 0) {
                                               suggestionsBox.classList.remove('hidden');
                                               data.results.forEach(item => {
                                                   const div = document.createElement('div');
                                                   div.className = 'suggestion-item';
                                                   div.textContent = `${item.name} (${item.email})`;
                                                   div.addEventListener('click', () => {
                                                       searchInput.value = item.name;
                                                       suggestionsBox.classList.add('hidden');
                                                   });
                                                   suggestionsBox.appendChild(div);
                                               });
                                           } else {
                                               suggestionsBox.classList.add('hidden');
                                           }
                                       });
                               }, 250);
                           } else {
                               suggestionsBox.classList.add('hidden');
                               suggestionsBox.innerHTML = '';
                           }
                       });

                       document.addEventListener('click', function (e) {
                           if (!suggestionsBox.contains(e.target) && e.target !== searchInput) {
                               suggestionsBox.classList.add('hidden');
                           }
                       });
                   });