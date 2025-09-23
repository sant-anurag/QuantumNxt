// candidate_muster_admin.js
// Handles enabling/disabling activity notes input and toggling buttons for Admin role

document.addEventListener('click', function(e) {
    // Edit button click
    if (e.target.classList.contains('edit-note-btn')) {
        const activityId = e.target.getAttribute('data-activity-id');
        const input = document.querySelector(`input.activity-note-input[data-activity-id='${activityId}']`);
        const saveBtn = document.querySelector(`button.save-note-btn[data-activity-id='${activityId}']`);
        const deleteBtn = document.querySelector(`button.delete-note-btn[data-activity-id='${activityId}']`);
        const cancelBtn = document.querySelector(`button.cancel-note-btn[data-activity-id='${activityId}']`);
        e.target.style.display = 'none';
        if (input) input.disabled = false;
        if (saveBtn) saveBtn.style.display = '';
        if (deleteBtn) deleteBtn.style.display = '';
        if (cancelBtn) cancelBtn.style.display = '';
        if (input) input.focus();
    }
    // Save, Cancel, or Delete button click
    if (e.target.classList.contains('save-note-btn') || e.target.classList.contains('cancel-note-btn') || e.target.classList.contains('delete-note-btn')) {
        const activityId = e.target.getAttribute('data-activity-id');
        const input = document.querySelector(`input.activity-note-input[data-activity-id='${activityId}']`);
        const editBtn = document.querySelector(`button.edit-note-btn[data-activity-id='${activityId}']`);
        const saveBtn = document.querySelector(`button.save-note-btn[data-activity-id='${activityId}']`);
        const cancelBtn = document.querySelector(`button.cancel-note-btn[data-activity-id='${activityId}']`);
        const deleteBtn = document.querySelector(`button.delete-note-btn[data-activity-id='${activityId}']`);
        if (e.target.classList.contains('save-note-btn')) {
            // Save logic: send update to backend
            const newNote = input.value.trim();
            if (!newNote) {
                input.classList.add('border-red-500');
                input.classList.remove('border-blue-300');
                input.placeholder = 'Note cannot be empty';
                return;
            }
            fetch('/api/candidate_musters/edit_note/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: JSON.stringify({
                    activity_id: activityId,
                    notes: newNote
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Optionally, refresh activities list
                    const candidateId = document.getElementById('candidate-activity-modal').dataset.candidateId;
                    const activitiesBtn = document.querySelector(`.activities-btn[data-candidate-id='${candidateId}']`);
                    if (activitiesBtn) {
                        activitiesBtn.click();
                    }
                } else {
                    input.classList.add('border-red-500');
                    input.classList.remove('border-blue-300');
                    input.value = '';
                    input.placeholder = data.error || 'Failed to update note';
                }
            })
            .catch(() => {
                input.classList.add('border-red-500');
                input.classList.remove('border-blue-300');
                input.value = '';
                input.placeholder = 'Error updating note';
            });
        }

        
        if (e.target.classList.contains('delete-note-btn')) {
            // Delete logic: send delete to backend
            fetch('/api/candidate_musters/delete_note/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: JSON.stringify({
                    activity_id: activityId
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Refresh activities list
                    const candidateId = document.getElementById('candidate-activity-modal').dataset.candidateId;
                    const activitiesBtn = document.querySelector(`.activities-btn[data-candidate-id='${candidateId}']`);
                    if (activitiesBtn) {
                        activitiesBtn.click();
                    }
                } else {
                    if (input) {
                        input.classList.add('border-red-500');
                        input.classList.remove('border-blue-300');
                        input.value = '';
                        input.placeholder = data.error || 'Failed to delete note';
                    }
                }
            })
            .catch(() => {
                if (input) {
                    input.classList.add('border-red-500');
                    input.classList.remove('border-blue-300');
                    input.value = '';
                    input.placeholder = 'Error deleting note';
                }
            });
        }

        
        // Reset UI for Save, Cancel, and Delete
        if (input) input.disabled = true;
        if (editBtn) editBtn.style.display = '';
        if (saveBtn) saveBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
    }

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
