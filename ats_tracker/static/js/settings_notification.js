// javascript
document.addEventListener("DOMContentLoaded", function() {
    const switchEl = document.getElementById("notificationSwitch");
    const statusText = document.getElementById("notifStatusText");

    // Mark as read buttons
    document.querySelectorAll('.mark-read-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const notifId = btn.getAttribute('data-notif-id');
            console.log('Marking notification as read:', notifId);
            fetch(`/settings/notification/mark_read/${notifId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken()
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    // Remove notification from list
                    const li = document.getElementById(`notif_${notifId}`);
                    if (li) li.remove();
                }
            });
        });
    });

    // Clear all notifications
    const clearAllBtn = document.querySelector('.clear-all_notifications');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', function() {
            fetch('/settings/notification/clear_all/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken()
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    // Remove all notifications from list
                    const notifList = document.getElementById('notifList');
                    if (notifList) notifList.innerHTML = '';
                }
            });
        });
    }

    switchEl.addEventListener("change", function() {
        const enabled = switchEl.checked;
        fetch("/settings/notification/toggle/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCSRFToken()
            },
            body: JSON.stringify({ enabled: enabled })
        })
        .then(res => res.json())
        .then(data => {
            statusText.textContent = data.status_text;
        });
    });
});

// Helper to get CSRF token from cookies
function getCSRFToken() {
    let name = "csrftoken=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

