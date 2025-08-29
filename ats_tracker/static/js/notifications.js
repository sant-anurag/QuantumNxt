// static/js/notifications.js

document.addEventListener('DOMContentLoaded', function() {
    const notificationPanel = document.querySelector('.notifications-panel');
    let hidePanelTimeout = null;
    const notificationBadge = document.getElementById('notification-badge');
    const notificationList = document.getElementById('notification-list');
    const MAX_NOTIFICATIONS = 5;
    let notifications = [];

    function updateBadgeCount(count) {
        if (notificationBadge) {
            if (count > 0) {
                notificationBadge.innerText = count;
                notificationBadge.style.display = 'inline';
            } else {
                notificationBadge.style.display = 'none';
            }
        }
    }

    function renderNotifications() {
        if (!notificationList) return;
        notificationList.innerHTML = '';
        notifications.forEach(function(n) {
            const li = document.createElement('li');
            li.className = 'notification-item';
            li.id = 'notification-' + n.notification_id;

            // Sender (created-by)
            const senderDiv = document.createElement('div');
            senderDiv.className = 'notification-sender';
            senderDiv.textContent = n['created-by'] || '';
            li.appendChild(senderDiv);

            // Meta (date & time)
            const metaDiv = document.createElement('div');
            metaDiv.className = 'notification-meta';
            const dateDiv = document.createElement('div');
            dateDiv.className = 'notification-date';
            dateDiv.textContent = n['created-at'] && n['created-at'].date ? n['created-at'].date : '';
            const timeDiv = document.createElement('div');
            timeDiv.className = 'notification-time';
            timeDiv.textContent = n['created-at'] && n['created-at'].time ? n['created-at'].time : '';
            metaDiv.appendChild(dateDiv);
            metaDiv.appendChild(timeDiv);
            li.appendChild(metaDiv);

            // Content (type & text)
            const contentDiv = document.createElement('div');
            contentDiv.className = 'notification-content';
            const typeDiv = document.createElement('div');
            typeDiv.className = 'notification-type';
            typeDiv.textContent = n.notification_type || '';
            const textDiv = document.createElement('div');
            textDiv.className = 'notification-text';
            textDiv.textContent = n.message || '';
            contentDiv.appendChild(typeDiv);
            contentDiv.appendChild(textDiv);
            li.appendChild(contentDiv);

            // Cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'notification-cancel';
            cancelBtn.id = 'cancel-notification-' + n.notification_id;
            cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
            cancelBtn.onclick = function() {
                notifications = notifications.filter(item => item.notification_id !== n.notification_id);
                renderNotifications();
                updateBadgeCount(notifications.length);
            };
            li.appendChild(cancelBtn);

            notificationList.appendChild(li);
        });
        updateBadgeCount(notifications.length);
    }

    // WebSocket connection (auto-detect ws/wss)
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(wsScheme + '://' + window.location.host + '/ws/notifications/');

    socket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        console.log('Received real-time notification:', data);

        // Add new notification to the front, keep only last MAX_NOTIFICATIONS
        notifications.unshift(data);
        if (notifications.length > MAX_NOTIFICATIONS) {
            notifications = notifications.slice(0, MAX_NOTIFICATIONS);
        }
        renderNotifications();

        // Show notification panel with pop-up effect and auto-hide after 10 seconds with fade-out
        if (notificationPanel) {
            notificationPanel.classList.add('visible');
            if (hidePanelTimeout) {
                clearTimeout(hidePanelTimeout);
            }
            hidePanelTimeout = setTimeout(function() {
                notificationPanel.classList.remove('visible');
            }, 10000);
        }
    };

    socket.onclose = function(e) {
        console.log('WebSocket closed unexpectedly');
    };

    // Optionally, expose notifications for debugging
    window._notifications = notifications;

    // Hide panel by default
    if (notificationPanel) {
        notificationPanel.classList.remove('visible');
    }
});