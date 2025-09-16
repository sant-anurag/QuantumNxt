// Optionally, add client-side validation or UX improvements here
document.getElementById('customerForm').addEventListener('submit', function(e) {
    // Example: Prevent multiple submits
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving...";
});


// Modal logic
const modal = document.getElementById('customerEditModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const editBtn = document.getElementById('editCustomerBtn');
const saveBtn = document.getElementById('saveCustomerBtn');
const form = document.getElementById('editCustomerForm');
const modalMsg = document.getElementById('modalMsg');
let currentCustomerId = null;

// Open modal and populate data
document.querySelectorAll('.btn-view-edit').forEach(btn => {
    btn.addEventListener('click', function() {
        const row = this.closest('tr');
        currentCustomerId = this.getAttribute('data-customer-id');
        document.getElementById('modalCompanyName').value = row.children[1].textContent.trim();
        document.getElementById('modalContactPersonName').value = row.children[2].textContent.trim();
        document.getElementById('modalContactEmail').value = row.children[3].textContent.trim();
        document.getElementById('modalContactPhone').value = row.children[4].textContent.trim();
        // Relation Since (showcase date)
        var createdAt = row.getAttribute('data-created-at');
        document.getElementById('modalRelationSince').textContent = createdAt ? createdAt : '';
        // Note (textarea)
        var note = row.getAttribute('data-note');
        document.getElementById('modalNote').value = note ? note : '';
        // Disable fields
        Array.from(form.elements).forEach(el => { if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.disabled = true; });
        saveBtn.style.display = 'none';
        saveBtn.disabled = true;
        editBtn.style.display = 'inline-block';
        editBtn.disabled = false;
        modalMsg.textContent = '';
        modal.classList.add('active');
    });
});
// Close modal
closeModalBtn.onclick = () => { modal.classList.remove('active'); };
window.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
// Enable editing
editBtn.onclick = () => {
    Array.from(form.elements).forEach(el => { if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.disabled = false; });
    saveBtn.disabled = false;
    saveBtn.style.display = 'inline-block';
    editBtn.style.display = 'none';
    // Relation Since should remain disabled
    document.getElementById('modalRelationSince').disabled = true;
};
// Save changes
form.onsubmit = function(e) {
    e.preventDefault();
    saveBtn.disabled = true;
    editBtn.style.display = 'none';
    modalMsg.textContent = 'Saving...';
    // Prepare data
    const data = {
        company_name: form.company_name.value,
        contact_person_name: form.contact_person_name.value,
        contact_email: form.contact_email.value,
        contact_phone: form.contact_phone.value,
        note: form.note.value
    };
    // Get CSRF token from cookie
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
    const csrftoken = getCookie('csrftoken');
    fetch(`/update_customer/${currentCustomerId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': csrftoken },
        body: new URLSearchParams(data)
    })
    .then(res => res.json())
    .then(resp => {
        if (resp.success) {
            modalMsg.textContent = 'Customer updated successfully.';
            modalMsg.style.color = '#1a7f4c'; // green for success
            setTimeout(() => { window.location.reload(); }, 900);
        } else {
            modalMsg.textContent = resp.error || 'Update failed.';
            modalMsg.style.color = '#c0392b'; // red for error
            saveBtn.disabled = false;
            saveBtn.style.display = 'inline-block';
            editBtn.style.display = 'none';
        }
    })
    .catch(() => {
        modalMsg.textContent = 'Network error.';
        modalMsg.style.color = '#c0392b'; // red for error
        saveBtn.disabled = false;
        saveBtn.style.display = 'inline-block';
        editBtn.style.display = 'none';
    });
};