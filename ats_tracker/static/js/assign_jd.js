document.addEventListener("DOMContentLoaded", function() {
    let allJDs = [];
    let allTeams = [];
    let currentPage = 1;

    // Fetch JDs and Teams for dropdowns
    fetch("/assign_jd_data/")
        .then(resp => resp.json())
        .then(data => {
            allJDs = data.jds;
            allTeams = data.teams;
            renderJDOptions(allJDs);
            renderTeamOptions(allTeams);
        });

    // Load initial assignments table
    loadAssignmentsTable(1);

    function renderJDOptions(jds) {
        const select = document.getElementById("assign-jd-select");
        select.innerHTML = "";
        jds.forEach(jd => {
            const opt = document.createElement("option");
            opt.value = jd.jd_id;
            opt.textContent = `${jd.jd_id} - ${jd.jd_summary}`;
            select.appendChild(opt);
        });
    }
    
    function renderTeamOptions(teams) {
        const select = document.getElementById("assign-team-select");
        select.innerHTML = "";
        teams.forEach(team => {
            const opt = document.createElement("option");
            opt.value = team.team_id;
            opt.textContent = team.team_name;
            select.appendChild(opt);
        });
    }

    function loadAssignmentsTable(page = 1) {
        currentPage = page;
        fetch(`/api/jd_assignments/?page=${page}`)
            .then(resp => resp.json())
            .then(data => {
                if (data.success) {
                    renderAssignmentsTable(data.jds);
                    renderPagination(data.pagination);
                } else {
                    console.error('Failed to load assignments:', data.error);
                }
            })
            .catch(error => {
                console.error('Error loading assignments:', error);
            });
    }

    function renderAssignmentsTable(jds) {
        const tbody = document.getElementById("assignments-tbody");
        tbody.innerHTML = "";
        
        if (jds.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-records">No JD assignments found.</td>
                </tr>
            `;
            return;
        }

        jds.forEach(jd => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${jd.row_number}</td>
                <td>${jd.jd_id}</td>
                <td title="${jd.jd_summary}">${jd.jd_summary}</td>
                <td>${jd.no_of_positions}</td>
                <td title="${jd.company_name}">${jd.company_name}</td>
                <td title="${jd.team_name}">${jd.team_name}</td>
            `;
            tbody.appendChild(row);
        });
    }

    function renderPagination(pagination) {
        const paginationDiv = document.getElementById("assignments-pagination");
        
        if (pagination.num_pages <= 1) {
            paginationDiv.innerHTML = "";
            return;
        }

        let paginationHTML = '<div class="pagination-controls">';
        
        // First and Previous buttons
        if (pagination.has_previous) {
            paginationHTML += `
                <button class="pagination-btn first" onclick="loadAssignmentsTable(1)">« First</button>
                <button class="pagination-btn prev" onclick="loadAssignmentsTable(${pagination.previous_page})">Previous</button>
            `;
        } else {
            paginationHTML += `
                <span class="pagination-btn disabled">« First</span>
                <span class="pagination-btn disabled">Previous</span>
            `;
        }
        
        // Page info
        paginationHTML += `
            <span class="pagination-info">
                Page ${pagination.current_page} of ${pagination.num_pages}
            </span>
        `;
        
        // Next and Last buttons
        if (pagination.has_next) {
            paginationHTML += `
                <button class="pagination-btn next" onclick="loadAssignmentsTable(${pagination.next_page})">Next</button>
                <button class="pagination-btn last" onclick="loadAssignmentsTable(${pagination.num_pages})">Last »</button>
            `;
        } else {
            paginationHTML += `
                <span class="pagination-btn disabled">Next</span>
                <span class="pagination-btn disabled">Last »</span>
            `;
        }
        
        paginationHTML += '</div>';
        paginationDiv.innerHTML = paginationHTML;
    }

    // Make loadAssignmentsTable available globally for pagination buttons
    window.loadAssignmentsTable = loadAssignmentsTable;

    // Search filter for JD dropdown
    document.getElementById("jd-search-box").addEventListener("input", function() {
        const term = this.value.trim().toLowerCase();
        if (term.length < 3) {
            renderJDOptions(allJDs);
            return;
        }
        const filtered = allJDs.filter(jd =>
            jd.jd_id.toLowerCase().includes(term) ||
            jd.jd_summary.toLowerCase().includes(term)
        );
        renderJDOptions(filtered);
    });

    // Search filter for Team dropdown
    document.getElementById("team-search-box").addEventListener("input", function() {
        const term = this.value.trim().toLowerCase();
        if (term.length < 3) {
            renderTeamOptions(allTeams);
            return;
        }
        const filtered = allTeams.filter(team =>
            team.team_name.toLowerCase().includes(term)
        );
        renderTeamOptions(filtered);
    });

    // Reset button
    document.getElementById("reset-btn").onclick = function() {
        document.getElementById("assign-jd-select").selectedIndex = -1;
        document.getElementById("assign-team-select").selectedIndex = -1;
        document.getElementById("jd-search-box").value = "";
        document.getElementById("team-search-box").value = "";
        renderJDOptions(allJDs);
        renderTeamOptions(allTeams);
        document.getElementById("assign-jd-result").style.display = "none";
    };

    // Assign button
    document.getElementById("assign-btn").onclick = function() {
        const jdSelect = document.getElementById("assign-jd-select");
        const teamSelect = document.getElementById("assign-team-select");
        const jd_id = jdSelect.value;
        const team_id = teamSelect.value;
        
        if (!jd_id || !team_id) {
            alert("Please select both JD and Team.");
            return;
        }

        // Disable the button and show loading state
        const assignBtn = document.getElementById("assign-btn");
        const originalText = assignBtn.innerHTML;
        assignBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Assigning...';
        assignBtn.disabled = true;

        fetch("/assign_jd/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
            body: JSON.stringify({ jd_id: jd_id, team_id: team_id })
        })
        .then(resp => resp.json())
        .then(data => {
            if (data.success) {
                showResult(data.jd, data.team, data.members);
                // Refresh the assignments table to show the new assignment
                loadAssignmentsTable(currentPage);
                // Reset the form
                document.getElementById("reset-btn").click();
            } else {
                alert(data.error || "Assignment failed.");
            }
        })
        .catch(error => {
            console.error('Assignment error:', error);
            alert("An error occurred during assignment.");
        })
        .finally(() => {
            // Re-enable the button
            assignBtn.innerHTML = originalText;
            assignBtn.disabled = false;
        });
    };

    function showResult(jd, team, members) {
        const resultDiv = document.getElementById("assign-jd-result");
        resultDiv.innerHTML = `
            <h3>Assignment Successful</h3>
            <div class="jd-details">
                <b>JD ID:</b> ${jd.jd_id}<br>
                <b>Summary:</b> ${jd.jd_summary}<br>
                <b>Status:</b> ${jd.jd_status}<br>
                <b>Positions:</b> ${jd.no_of_positions}<br>
                <b>Company:</b> ${jd.company_name || "-"}
            </div>
            <div class="team-details">
                <b>Assigned Team:</b> ${team.team_name}
                <ul class="team-members-list">
                    ${members.length ? members.map(m => `<li>${m.first_name} ${m.last_name} (${m.email})</li>`).join("") : "<li>No members in this team.</li>"}
                </ul>
            </div>
        `;
        resultDiv.style.display = "block";
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