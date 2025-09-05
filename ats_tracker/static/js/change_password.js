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