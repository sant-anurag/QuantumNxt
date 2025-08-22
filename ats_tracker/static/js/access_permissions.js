document.addEventListener('DOMContentLoaded', function() {
// Change Password
document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const form = e.target;
    const old_password = form.old_password.value;
    const new_password = form.new_password.value;
    const confirm_password = form.confirm_password.value;
    const msg = document.getElementById('changePasswordMsg');
    msg.textContent = '';
    if (new_password !== confirm_password) {
        msg.textContent = 'New passwords do not match.';
        msg.style.color = '#e53e3e';
        return;
    }
    fetch('/access_permissions/change_password/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({old_password, new_password})
    })
    .then(res => res.json())
    .then(data => {
        msg.textContent = data.message;
        msg.style.color = data.success ? '#38a169' : '#e53e3e';
        form.reset();
    });
});

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
            <td>${user.is_active ? 'Active' : 'Inactive'}</td>
            <td>${user.created_at}</td>
        `;
        tbody.appendChild(tr);
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