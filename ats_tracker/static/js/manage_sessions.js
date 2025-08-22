document.addEventListener('DOMContentLoaded', function() {
        function renderTable(data, page=1, pageSize=10) {
            const start = (page-1)*pageSize;
            const end = start+pageSize;
            const paged = data.slice(start, end);
            let html = `<table class="sessions-table">
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Session ID</th>
                        <th>Expires At</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>`;
            if (paged.length === 0) {
                html += `<tr><td colspan="6" style="text-align:center;">No active sessions found.</td></tr>`;
            } else {
                // Render each session
                console.log('Rendering sessions:', paged);
                console.log('Current page:', page);
                console.log('Page size:', pageSize);
                console.log('Total sessions:', data.length);
                console.log('Start index:', start);
                console.log('End index:', end);
                console.log('Filtered sessions:', filtered.length);
                console.log('Total pages:', Math.ceil(data.length / pageSize));
                console.log('Current page sessions:', paged.length);
                console.log('Session data:', paged);
                console.log('Session IDs:', paged.map(s => s.session_id));
                console.log('Session usernames:', paged.map(s => s.username));
                console.log('Session roles:', paged.map(s => s.role));
                console.log('Session expires_at:', paged.map(s => s.expires_at));
                paged.forEach(s => {
                    html += `<tr>
                        <td>${s.user_id}</td>
                        <td>${s.username}</td>
                        <td>${s.role}</td>
                        <td>${s.session_id}</td>
                        <td>${s.expires_at}</td>
                        <td>
                            <button class="logout-btn" onclick="logoutSession('${s.session_id}')">
                                <i class="fas fa-sign-out-alt"></i> Logout
                            </button>
                        </td>
                    </tr>`;
                });
            }
            html += `</tbody></table>`;
            document.getElementById('sessionsTableContainer').innerHTML = html;
        }

        function renderPagination(data, page, pageSize) {
            const totalPages = Math.ceil(data.length / pageSize);
            if (totalPages <= 1) {
                document.getElementById('paginationContainer').innerHTML = '';
                return;
            }
            let html = `<div class="pagination">`;
            for (let i=1; i<=totalPages; i++) {
                html += `<button class="${i===page?'active':''}" onclick="changePage(${i})">${i}</button>`;
            }
            html += `</div>`;
            document.getElementById('paginationContainer').innerHTML = html;
        }

        let sessions = window.sessionData || [];
        let filtered = sessions;
        let currentPage = 1;
        const pageSize = 10;

        function updateTable() {
            renderTable(filtered, currentPage, pageSize);
            renderPagination(filtered, currentPage, pageSize);
        }

        window.changePage = function(page) {
            currentPage = page;
            updateTable();
        };

        document.getElementById('searchInput').addEventListener('input', function() {
            const val = this.value.trim().toLowerCase();
            filtered = sessions.filter(s => s.username.toLowerCase().includes(val));
            currentPage = 1;
            updateTable();
        });

        function logoutSession(sessionId) {
            if (!confirm('Are you sure you want to logout this user?')) return;
            fetch('/manage_sessions/logout_session/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({session_id: sessionId})
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    sessions = sessions.filter(s => s.session_id !== sessionId);
                    filtered = filtered.filter(s => s.session_id !== sessionId);
                    updateTable();
                } else {
                    alert('Failed to logout session.');
                }
            });
        }
        window.logoutSession = logoutSession; // Expose to global for button onclick

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

        // Initial render
        updateTable();
    });