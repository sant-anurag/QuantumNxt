// static/js/notifications.js

document.addEventListener('DOMContentLoaded', function() {
    const notificationPanel = document.querySelector('.notifications-panel');
    const notificationBell = document.getElementById('notification-bell');
    let hidePanelTimeout = null;
    const notificationBadge = document.getElementById('notification-badge');
    const notificationList = document.getElementById('notification-list');
    const notificationSound = new Audio('/static/sounds/notification-ping.mp3'); //ats_tracker\static\sounds\
    const MAX_NOTIFICATIONS = 5;
    let notifications = [];

    function requestNotificationPermission() {
        // Check if the browser supports notifications
        if (!("Notification" in window)) {
            console.log("This browser does not support desktop notification.");
        } 
        // If permission has not been granted yet, ask the user
        else if (Notification.permission === "default") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log("Desktop notification permission granted.");
                } else {
                    console.log("Desktop notification permission denied.");
                }
            });
        }
    }

    // Call this function once the DOM is ready to prompt the user
    requestNotificationPermission();

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

    console.log('WebSocket URL:', wsScheme + '://' + window.location.host + '/ws/notifications/');
    // Flag to track if user has interacted with the page
    let userInteracted = false;
    
    // Add event listeners to track user interaction
    document.addEventListener('click', function() {
        userInteracted = true;
    });
    
    document.addEventListener('keydown', function() {
        userInteracted = true;
    });
    
    // Pre-load the sound to prepare it
    notificationSound.load();
    
    socket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        console.log('Received real-time notification:', data);

        // Only try to play sound if user has interacted with the page
        if (userInteracted) {
            notificationSound.play().catch(error => {
                console.log('Could not play notification sound:', error.message);
            });
        }

        // --- NEW: 2. Trigger Native Desktop Notification (Only if the tab is not active) ---
        // document.hidden is true when the tab is not in the foreground
        if (document.hidden && Notification.permission === "granted") {
            const notificationTitle = data['title'] || 'System Alert';
            const notificationBody = `${data.notification_type || 'Message'}: ${data.message || 'New activity.'}`;
            const notificationIcon = data['icon'] || '/static/images/app-icon.png';
            const nativeNotification = new Notification(notificationTitle, {
                body: notificationBody,
                // Add an icon for better visibility (you must provide this file)
                icon: notificationIcon
            });

            // Optional: Auto-close the notification after 24000 milliseconds (24 seconds)
            setTimeout(() => nativeNotification.close(), 24000);

            // Optional: Focus the application window when the notification is clicked
            nativeNotification.onclick = function() {
                window.focus(); 
                this.close(); // Close the notification upon click
            };
        }

        // Add new notification to the front, keep only last MAX_NOTIFICATIONS
        notifications.unshift(data);
        if (notifications.length > MAX_NOTIFICATIONS) {
            notifications = notifications.slice(0, MAX_NOTIFICATIONS);
        }

        renderNotifications();
        
        // Add animation to the notification bell to catch attention even without sound
        if (notificationBell) {
            // Add animation class
            notificationBell.classList.add('notification-bell-animate');
            // Remove the animation class after the animation completes
            setTimeout(() => {
                notificationBell.classList.remove('notification-bell-animate');
            }, 2000);
        }
        
        // Show notification panel and hide bell
        if (notificationPanel) {
            notificationPanel.classList.add('visible');
            if (notificationBell) {
                notificationBell.style.display = 'none';
            }
            if (hidePanelTimeout) {
                clearTimeout(hidePanelTimeout);
            }
            hidePanelTimeout = setTimeout(function() {
                notificationPanel.classList.remove('visible');
                if (notificationBell) {
                    notificationBell.style.display = '';
                }
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
        if (notificationBell) {
            notificationBell.style.display = '';
        }
    }
});