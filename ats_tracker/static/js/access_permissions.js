document.addEventListener('DOMContentLoaded', function() {

// Change Role
document.getElementById('changeRoleForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const form = e.target;
    const user_id = form.user_id.value;
    const role = form.role.value;
    const msg = document.getElementById('changeRoleMsg');
    msg.textContent = '';
    fetch('/access_permissions/change_role/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({user_id, role})
    })
    .then(res => res.json())
    .then(data => {
        msg.textContent = data.message;
        msg.style.color = data.success ? '#38a169' : '#e53e3e';
        if (data.success) location.reload();
    });
});

// --- User Permissions Table Pagination ---
const users = window.usersData || [];
const pageSize = 5;
let currentPage = 1;

function renderTable(page) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pagedUsers = users.slice(start, end);
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = '';
    pagedUsers.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.user_id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${user.is_active === 'true' ? 'Active' : 'Inactive'}
                <button class="btn-status-toggle ${user.is_active === 'true' ? 'deactivate' : 'activate'}" data-user-id="${user.user_id}" data-action="${user.is_active === 'true' ? 'deactivate' : 'activate'}" style="margin-left:10px;padding:3px 10px;font-size:0.95em;">${user.is_active === 'true' ? 'Deactivate' : 'Activate'}</button>
            </td>
            <td>${user.created_at}</td>
        `;
        tbody.appendChild(tr);
    });
    // Attach event listeners for status toggle buttons
    tbody.querySelectorAll('.btn-status-toggle').forEach(btn => {
        btn.onclick = function() {
            const userId = btn.getAttribute('data-user-id');
            const action = btn.getAttribute('data-action');
            console.log(`Changing status for user ${userId} to ${action}`);
            btn.disabled = true;
            btn.textContent = 'Processing...';
            fetch(`/access_permissions/change_active_status/${userId}/${action}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Update usersData for this user
                    const userObj = users.find(u => u.user_id == userId);
                    if (userObj) {
                        userObj.is_active = action === 'activate' ? 'true' : 'false';
                    }
                    // Re-render table and pagination to reflect change
                    renderTable(currentPage);
                    renderPagination();
                } else {
                    btn.textContent = 'Error';
                    setTimeout(() => { btn.disabled = false; btn.textContent = action === 'activate' ? 'Deactivate' : 'Activate'; }, 1200);
                }
            })
            .catch(() => {
                btn.textContent = 'Network Error';
                setTimeout(() => { btn.disabled = false; btn.textContent = action === 'activate' ? 'Deactivate' : 'Activate'; }, 1200);
            });
        };
    });
}

function renderPagination() {
    const totalPages = Math.ceil(users.length / pageSize);
    const container = document.getElementById('userTablePagination');
    container.innerHTML = '';
    if (totalPages <= 1) return;
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === currentPage ? 'active' : '';
        btn.onclick = function() {
            currentPage = i;
            renderTable(currentPage);
            renderPagination();
        };
        container.appendChild(btn);
    }
}

renderTable(currentPage);
renderPagination();

// CSRF helper
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i=0; i<cookies.length; i++) {
            const c = cookies[i].trim();
            if (c.substring(0, name.length+1) === (name+'=')) {
                cookieValue = decodeURIComponent(c.substring(name.length+1));
                break;
            }
        }
    }
    return cookieValue;
}
});