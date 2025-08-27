// javascript
document.addEventListener("DOMContentLoaded", function() {
    const switchEl = document.getElementById("notificationSwitch");
    const statusText = document.getElementById("notifStatusText");

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