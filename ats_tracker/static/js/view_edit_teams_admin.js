document.addEventListener("DOMContentLoaded", function() {
        
        // --- Modal logic for editing team members ---
        const modal = document.getElementById("edit-team-modal");
        const modalContent = document.getElementById("edit-team-modal-content");
        const closeModalBtn = document.getElementById("close-edit-modal");
        let currentTeamId = null;

        const userRole = modalContent.getAttribute('data-user-role');

        document.addEventListener("click", function(e) {
            if (e.target.classList.contains("view-edit-team")) {
                e.preventDefault();
                currentTeamId = e.target.getAttribute("data-team-id");
                fetch(`/teams/${currentTeamId}/members/`)
                    .then(resp => resp.json())
                    .then(data => {
                        renderMembersList(data.members);
                        populateAddMemberSelect(data.available_members);
                        modal.style.display = "flex";
                    });
            }
            if (e.target.classList.contains("remove-member-btn")) {
                const empId = e.target.getAttribute("data-emp-id");
                fetch(`/teams/${currentTeamId}/remove_member/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
                    body: JSON.stringify({ emp_id: empId })
                })
                .then(resp => resp.json())
                .then(data => {
                    renderMembersList(data.members);
                    populateAddMemberSelect(data.available_members);
                });
            }
        });

        if (closeModalBtn) {
            closeModalBtn.onclick = function() {
                modal.style.display = "none";
            };
        }
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = "none";
            }
        };

        // view_edit_teams_admin.js

        function renderMembersList(members) {
            const container = document.getElementById("edit-team-members-list");
            const userRole = document.getElementById("edit-team-modal-content").getAttribute('data-user-role');
            const isAdmin = (userRole === 'Admin');

            if (!members || members.length === 0) {
                container.innerHTML = `<div class="ct-no-data">No members in this team.</div>`;
                return;
            }

            let html = `<table class="ct-table"><thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    ${isAdmin ? '<th>Action</th>' : ''}
                </tr>
            </thead><tbody>`;

            members.forEach(m => {
                html += `<tr>
                    <td>${m.first_name} ${m.last_name}</td>
                    <td>${m.email}</td>
                    <td>${m.role || "-"}</td>
                    ${isAdmin ? `<td><button class="ct-link remove-member-btn" data-emp-id="${m.emp_id}" style="color:#da3c45;">Remove</button></td>` : ''}
                </tr>`;
            });

            html += "</tbody></table>";
            container.innerHTML = html;
        }

        function populateAddMemberSelect(availableMembers) {
            const select = document.getElementById("add-member-select");
            if (!select) {
                return; 
            }
            select.innerHTML = "";
            if (!availableMembers || availableMembers.length === 0) {
                select.innerHTML = `<option value="">No available members</option>`;
                return;
            }
            select.innerHTML = `<option value="">Select member...</option>`;
            availableMembers.forEach(m => {
                select.innerHTML += `<option value="${m.emp_id}">${m.first_name} ${m.last_name} (${m.email})</option>`;
            });
        }

        const addMemberBtn = document.getElementById("add-member-btn");

        if (userRole === 'Admin' && addMemberBtn) {
            addMemberBtn.onclick = function() {
                const empId = document.getElementById("add-member-select").value;
                if (!empId) return;
                fetch(`/teams/${currentTeamId}/add_member/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
                    body: JSON.stringify({ emp_id: empId })
                })
                .then(resp => resp.json())
                .then(data => {
                    renderMembersList(data.members);
                    populateAddMemberSelect(data.available_members);
                });
            };
        }

        // CSRF helper for Django
        function getCSRFToken() {
            let cookieValue = null;
            if (document.cookie && document.cookie !== "") {
                const cookies = document.cookie.split(";");
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i].trim();
                    if (cookie.substring(0, 10) === "csrftoken=") {
                        cookieValue = decodeURIComponent(cookie.substring(10));
                        break;
                    }
                }
            }
            return cookieValue;
        }
    });