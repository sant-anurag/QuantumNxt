document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('login-form');
    const errorDiv = document.getElementById('error-message');

    form.addEventListener('submit', function(e) {
        errorDiv.textContent = '';
        let username = form.username.value.trim();
        let password = form.password.value.trim();
        if (!username || !password) {
            e.preventDefault();
            errorDiv.textContent = 'Please enter both username/email and password.';
            errorDiv.style.opacity = 1;
            return false;
        }
    });
});