document.addEventListener("DOMContentLoaded", function() {
        // --- Modal logic for team members ---
        const modal = document.getElementById("team-members-modal");
        const closeModalBtn = document.getElementById("close-modal");
        document.addEventListener("click", function(e) {
            // Delegate for dynamic table pagination and modal links
            if (e.target.classList.contains("ct-link") && e.target.hasAttribute("data-team-id")) {
                e.preventDefault();
                const teamId = e.target.getAttribute("data-team-id");
                fetch(`/team-members/${teamId}/`)
                    .then(resp => resp.json())
                    .then(data => {
                        const container = document.getElementById("modal-members-list");
                        if (data.members && data.members.length > 0) {
                            let html = `<table class="ct-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Emp ID</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th>Role</th>
                                        <th>Date Joined</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>`;
                            data.members.forEach(m => {
                                html += `<tr>
                                    <td>${m.first_name || ""} ${m.last_name || ""}</td>
                                    <td>${m.emp_id || "-"}</td>
                                    <td>${m.email || "-"}</td>
                                    <td>${m.phone || "-"}</td>
                                    <td>${m.role || "-"}</td>
                                    <td>${m.date_joined || "-"}</td>
                                    <td>${m.status || "-"}</td>
                                </tr>`;
                            });
                            html += "</tbody></table>";
                            container.innerHTML = html;
                        } else {
                            container.innerHTML = `<div class="ct-no-data">No members in this team.</div>`;
                        }
                        modal.style.display = "flex";
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

        // --- Search and Pagination for Members Table ---
        const membersTableBody = document.getElementById("members-table-body");
        const searchInput = document.getElementById("member-search");
        const paginationDiv = document.getElementById("members-pagination");
        let allMembers = [];
        membersTableBody.querySelectorAll("tr").forEach(row => {
            if (!row.classList.contains("ct-no-data")) {
                const name = row.children[1].textContent.trim().toLowerCase();
                allMembers.push({
                    row: row.cloneNode(true),
                    name: name
                });
            }
        });

        function renderMembers(filteredMembers, page = 1, perPage = 5) {
            membersTableBody.innerHTML = "";
            if (filteredMembers.length === 0) {
                membersTableBody.innerHTML = `<tr><td colspan="5" class="ct-no-data">No members found.</td></tr>`;
                paginationDiv.innerHTML = "";
                return;
            }
            const totalPages = Math.ceil(filteredMembers.length / perPage);
            const start = (page - 1) * perPage;
            const end = start + perPage;
            filteredMembers.slice(start, end).forEach(m => {
                membersTableBody.appendChild(m.row.cloneNode(true));
            });
            // Pagination controls
            let pagHtml = "";
            if (totalPages > 1) {
                for (let i = 1; i <= totalPages; i++) {
                    pagHtml += `<button type="button" class="${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
                }
            }
            paginationDiv.innerHTML = pagHtml;
            // Add event listeners
            paginationDiv.querySelectorAll("button").forEach(btn => {
                btn.onclick = function() {
                    renderMembers(filteredMembers, parseInt(this.getAttribute("data-page")), perPage);
                };
            });
        }

        function filterMembers() {
            const term = searchInput.value.trim().toLowerCase();
            let filtered = allMembers;
            if (term) {
                filtered = allMembers.filter(m => m.name.includes(term));
            }
            renderMembers(filtered, 1, 5);
        }

        // Initial render
        renderMembers(allMembers, 1, 5);

        // Search event
        searchInput.addEventListener("input", filterMembers);
        // Also re-render on form reset (if needed)
        if (searchInput.form) {
            searchInput.form.addEventListener("reset", () => setTimeout(filterMembers, 10));
        }

        // Keep checkboxes in sync with form (for checked state)
        membersTableBody.addEventListener("change", function(e) {
            if (e.target.type === "checkbox") {
                const value = e.target.value;
                document.querySelectorAll(`input[name="members"][value="${value}"]`).forEach(cb => {
                    cb.checked = e.target.checked;
                });
            }
            // Sync radio button for team lead selection
            if (e.target.type === "radio" && e.target.name === "team_lead") {
                const value = e.target.value;
                document.querySelectorAll(`input[name="team_lead"]`).forEach(rb => {
                    rb.checked = (rb.value === value);
                });

            }
        });

        // Disable button on submit
        const form = document.getElementById("create-team-form");
        if (form) {
            form.addEventListener("submit", function() {
                const btn = form.querySelector("button[type='submit']");
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = "Creating...";
                }
            });
        }

        // --- Search and Pagination for Teams Table ---
        const teamsTableBody = document.getElementById("teams-table-body");
        const teamSearchInput = document.getElementById("team-search");
        const teamsPaginationDiv = document.getElementById("teams-pagination");
        let allTeams = [];
        teamsTableBody.querySelectorAll("tr").forEach(row => {
            if (!row.classList.contains("ct-no-data")) {
                const name = row.children[0].textContent.trim().toLowerCase();
                allTeams.push({
                    row: row.cloneNode(true),
                    name: name
                });
            }
        });

        function renderTeams(filteredTeams, page = 1, perPage = 5) {
            teamsTableBody.innerHTML = "";
            if (filteredTeams.length === 0) {
                teamsTableBody.innerHTML = `<tr><td colspan="4" class="ct-no-data">No teams found.</td></tr>`;
                teamsPaginationDiv.innerHTML = "";
                return;
            }
            const totalPages = Math.ceil(filteredTeams.length / perPage);
            const start = (page - 1) * perPage;
            const end = start + perPage;
            filteredTeams.slice(start, end).forEach(t => {
                teamsTableBody.appendChild(t.row.cloneNode(true));
            });
            // Pagination controls
            let pagHtml = "";
            if (totalPages > 1) {
                for (let i = 1; i <= totalPages; i++) {
                    pagHtml += `<button type="button" class="${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
                }
            }
            teamsPaginationDiv.innerHTML = pagHtml;
            // Add event listeners
            teamsPaginationDiv.querySelectorAll("button").forEach(btn => {
                btn.onclick = function() {
                    renderTeams(filteredTeams, parseInt(this.getAttribute("data-page")), perPage);
                };
            });
        }

        function filterTeams() {
            const term = teamSearchInput.value.trim().toLowerCase();
            let filtered = allTeams;
            if (term) {
                filtered = allTeams.filter(t => t.name.includes(term));
            }
            renderTeams(filtered, 1, 5);
        }

        // Initial render
        renderTeams(allTeams, 1, 5);

        // Search event
        teamSearchInput.addEventListener("input", filterTeams);
    });