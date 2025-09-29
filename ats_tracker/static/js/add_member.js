document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('addMemberForm');


    const dateInput = document.getElementById('date_joined');
    const today = new Date().toISOString().split('T')[0];
    const fixedMinDate = '2020-01-01';

    if (dateInput) {
        dateInput.setAttribute('min', fixedMinDate);
        dateInput.setAttribute('max', today);
    }

    if (!form) return;

    form.addEventListener('submit', function(e) {
        let valid = true;
        let messages = [];

        const firstName = form.first_name.value.trim();
        const lastName = form.last_name.value.trim();
        const email = form.email.value.trim();
        const phone = form.phone.value.trim();
        const role = form.role.value.trim();
        const dateJoined = form.date_joined.value.trim();

        if (!firstName || !lastName || !email || !role || !dateJoined) {
            messages.push("All fields except phone are required.");
            valid = false;
        }
        if (email && (!email.includes('@') || email.length > 100)) {
            messages.push("Provide a valid email address (max 100 chars).");
            valid = false;
        }
        if (firstName.length > 50 || lastName.length > 50) {
            messages.push("Names should be under 50 characters.");
            valid = false;
        }
        if (phone && (!/^\+?[0-9\s-]{10,20}$/.test(phone) || phone.length > 20)) {
            messages.push("Phone number should be numeric and can include +, spaces, or dashes (10-20 chars).");
            valid = false;
        }

        if (!valid) {
            e.preventDefault();
            let msgDiv = document.querySelector('.error-msg');
            if (!msgDiv) {
                msgDiv = document.createElement('div');
                msgDiv.className = 'error-msg';
                form.parentNode.insertBefore(msgDiv, form);
            }
            msgDiv.innerHTML = messages.join("<br>");
        }
    });
});
