document.addEventListener('DOMContentLoaded', function () {
            const searchBtn = document.getElementById('search-btn');
            const resetBtn = document.getElementById('reset-btn');
            const editBtn = document.getElementById('edit-btn');
            const saveBtn = document.getElementById('save-btn');
            const candidateDetails = document.getElementById('candidate-details');
            const searchInput = document.getElementById('search-input');

            searchBtn.addEventListener('click', function () {
                const query = searchInput.value.trim();
                if (query.length > 0) {
                    fetch(`/get_candidate_details_profile/?query=${query}`)
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
            });

            editBtn.addEventListener('click', function () {
                document.querySelectorAll('#candidate-details input, #candidate-details textarea, #candidate-details select').forEach(el => {
                    el.disabled = false;
                });
                editBtn.classList.add('hidden');
                saveBtn.classList.remove('hidden');
            });

            saveBtn.addEventListener('click', function () {
                const candidateId = document.getElementById('candidate-id').value; // Ensure this field exists in the HTML
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
                        'X-CSRFToken': getCSRFToken(), // Ensure CSRF token is included
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
        });