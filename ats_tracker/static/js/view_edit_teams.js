document.addEventListener("DOMContentLoaded", function() {
        // --- Pagination and Search for Teams Table ---
        const teamsTableBody = document.getElementById("teams-table-body");
        const teamSearchInput = document.getElementById("team-search");
        const teamsPaginationDiv = document.getElementById("teams-pagination");
        const exportBtn = document.getElementById("export-teams-btn");
        let allTeams = [];
        teamsTableBody.querySelectorAll("tr").forEach(row => {
            const name = row.children[1].textContent.trim().toLowerCase();
            allTeams.push({ row: row.cloneNode(true), name: name });
        });

        function getFilteredTeams() {
            const term = teamSearchInput.value.trim().toLowerCase();
            let filtered = allTeams;
            if (term) {
                filtered = allTeams.filter(t => t.name.includes(term));
            }
            return filtered.map(t => {
                const cells = t.row.querySelectorAll("td");
                return {
                    team_id: cells[0].textContent.trim(),
                    team_name: cells[1].textContent.trim(),
                    strength: cells[2].textContent.trim(),
                    created_at: cells[3].textContent.trim()
                };
            });
        }

        function renderTeams(filteredTeams, page = 1, perPage = 10) {
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
            renderTeams(filtered, 1, 10);
        }

        // Initial render
        renderTeams(allTeams, 1, 10);
        teamSearchInput.addEventListener("input", filterTeams);

        // --- Export Teams to Excel ---
        exportBtn.addEventListener("click", function() {
            const filteredTeams = getFilteredTeams();
            if (filteredTeams.length === 0) {
                alert("No teams to export.");
                return;
            }
            fetch("/teams/export/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCSRFToken()
                },
                body: JSON.stringify({ teams: filteredTeams })
            })
            .then(resp => {
                if (!resp.ok) throw new Error("Export failed");
                return resp.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "teams_export.xlsx";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            })
            .catch(() => {
                alert("Failed to export teams.");
            });
        });



            // --- Export Teams to Excel ---


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