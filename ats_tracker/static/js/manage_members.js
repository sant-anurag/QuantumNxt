document.addEventListener('DOMContentLoaded', function() {
    function getCookie(name) {
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

    function updateUserStatusColor(selectElement) {
        const selectedValue = selectElement.value;
        selectElement.classList.remove('active', 'inactive', 'on-leave');
        if (selectedValue === 'active') {
            selectElement.classList.add('active');
        } else if (selectedValue === 'on_leave') {
            selectElement.classList.add('on-leave');
        } else if (selectedValue === 'inactive') {
            selectElement.classList.add('inactive');
        }
    }

    function changeMemberStatus(memberId, prevStatus, newStatus) {
        if (newStatus === 'inactive') {
            if (!confirm('Are you sure you want to set this member as Inactive?')) {
                const selectElement = document.querySelector(`select[data-member-id='${memberId}']`);
                selectElement.value = prevStatus;
                console.log('Status change cancelled by user.', prevStatus, newStatus);
                updateUserStatusColor(selectElement);
                return;
            }
        }

        const formData = new FormData();
        formData.append('member_id', memberId);
        formData.append('new_status', newStatus);

        fetch('/api/manage_members/change-member-status/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                console.log('Status updated successfully');
                // Optionally, you can show a success message to the user.
                // For now, we just log it.
                window.location.reload();
            } else {
                console.error('Error updating status:', data.error);
                // Revert the select element to its previous state
                const selectElement = document.querySelector(`select[data-member-id='${memberId}']`);
                selectElement.value = prevStatus;
                updateUserStatusColor(selectElement);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            const selectElement = document.querySelector(`select[data-member-id='${memberId}']`);
            selectElement.value = prevStatus;
            updateUserStatusColor(selectElement);
        });
    }

    const statusSelects = document.querySelectorAll('.user-status-select');
    statusSelects.forEach(select => {
        // Set initial color and store previous status
        updateUserStatusColor(select);
        select.dataset.prevStatus = select.value;

        select.addEventListener('change', function() {
            const memberId = this.getAttribute('data-member-id');
            const newStatus = this.value;
            const prevStatus = this.dataset.prevStatus;
            
            updateUserStatusColor(this);
            changeMemberStatus(memberId, prevStatus, newStatus);

            // Update prevStatus after the change
            this.dataset.prevStatus = newStatus;
        });
    });
});
