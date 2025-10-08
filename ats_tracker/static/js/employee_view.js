// ats_tracker/static/js/employee_view.js
        document.addEventListener("DOMContentLoaded", function() {
            let allMembers = [];
            let filteredMembers = [];
            let selectedMember = null;

            // Fetch all members for dropdown
            fetch("/employee_view_data/")
                .then(resp => resp.json())
                .then(data => {
                    allMembers = data.members;
                    filteredMembers = [];
                    renderDropdown([]);
                });

            function renderDropdown(members) {
                const dropdown = document.getElementById("member-dropdown");
                dropdown.innerHTML = "";
                if (members.length === 0) {
                    dropdown.style.display = "none";
                    setButtonState(false);
                    return;
                }
                dropdown.style.display = "block";
                members.forEach(m => {
                    const item = document.createElement("div");
                    item.className = "ev-autocomplete-item";
                    item.textContent = `${m.first_name} ${m.last_name} (${m.email})`;
                    item.dataset.empId = m.emp_id;
                    item.onclick = function() {
                        selectedMember = m;
                        document.getElementById("member-search-box").value = `${m.first_name} ${m.last_name}`;
                        dropdown.style.display = "none";
                        setButtonState(true);
                    };
                    dropdown.appendChild(item);
                });
                setButtonState(false);
            }

            function setButtonState(enabled) {
                document.getElementById("search-btn").disabled = !enabled;
                document.getElementById("reset-btn").disabled = false;
            }

            document.getElementById("member-search-box").addEventListener("input", function() {
                const term = this.value.trim().toLowerCase();
                selectedMember = null;
                document.getElementById("employee-result").innerHTML = "";
                if (term.length < 3) {
                    renderDropdown([]);
                    return;
                }
                filteredMembers = allMembers.filter(m =>
                    m.first_name.toLowerCase().includes(term) ||
                    m.last_name.toLowerCase().includes(term) ||
                    m.email.toLowerCase().includes(term)
                );
                renderDropdown(filteredMembers);
            });

            document.getElementById("search-btn").onclick = function() {
                if (!selectedMember) {
                    alert("Please select a member from the dropdown.");
                    return;
                }
                fetch("/employee_view_report/?emp_id=" + selectedMember.emp_id)
                    .then(resp => resp.json())
                    .then(data => {
                        renderResult(data);
                    });
            };

            document.getElementById("reset-btn").onclick = function() {
                document.getElementById("member-search-box").value = "";
                document.getElementById("member-dropdown").innerHTML = "";
                document.getElementById("member-dropdown").style.display = "none";
                document.getElementById("employee-result").innerHTML = "";
                selectedMember = null;
                setButtonState(false);
            };

            // --- Pagination helpers ---
            function paginate(array, page, pageSize) {
                const total = array.length;
                const numPages = Math.ceil(total / pageSize);
                const start = (page - 1) * pageSize;
                return {
                    rows: array.slice(start, start + pageSize),
                    page,
                    numPages,
                    total
                };
            }

            function renderPagination(container, page, numPages, onPageChange) {
                container.innerHTML = "";
                if (numPages <= 1) return;
                const prev = document.createElement("button");
                prev.textContent = "Prev";
                prev.disabled = page === 1;
                prev.onclick = () => onPageChange(page - 1);
                container.appendChild(prev);
                for (let i = 1; i <= numPages; i++) {
                    const btn = document.createElement("button");
                    btn.textContent = i;
                    btn.className = i === page ? "active" : "";
                    btn.onclick = () => onPageChange(i);
                    container.appendChild(btn);
                }
                const next = document.createElement("button");
                next.textContent = "Next";
                next.disabled = page === numPages;
                next.onclick = () => onPageChange(page + 1);
                container.appendChild(next);
            }

            // --- Main result rendering with pagination ---
            function renderResult(data) {
                const resultDiv = document.getElementById("employee-result");
                resultDiv.innerHTML = "";
                // Safely get JDs array
                const jdscount = Array.isArray(data.jds) ? data.jds : [];
                const activeCount = jdscount.filter(jd => jd.jd_status === "active").length;
                const closedCount = jdscount.filter(jd => jd.jd_status === "closed").length;
                const holdCount = jdscount.filter(jd => jd.jd_status === "on hold").length;

                // Member Details (Professional Card Style)
                const member = data.member || {};
// Inside renderResult(data)
let html = `
<div class="ev-section" style="margin-bottom:24px;">
    <h3>
        <i class="fas fa-id-badge" style="color:#11b7ee;"></i> Member Details
    </h3>
    <div class="ev-table-container">
        <table class="ev-table">
            <tr class="ev-table-row">
                <td class="ev-table-cell"><strong>Name</strong></td>
                <td class="ev-table-cell">${member.first_name || ""} ${member.last_name || ""}</td>
            </tr>
            <tr class="ev-table-row">
                <td class="ev-table-cell"><strong>Email</strong></td>
                <td class="ev-table-cell">${member.email || ""}</td>
            </tr>
            <tr class="ev-table-row">
                <td class="ev-table-cell"><strong>Employee ID</strong></td>
                <td class="ev-table-cell">${member.emp_id || ""}</td>
            </tr>
            <tr class="ev-table-row">
                <td class="ev-table-cell"><strong>Role</strong></td>
                <td class="ev-table-cell">${member.role || ""}</td>
            </tr>
            <tr class="ev-table-row">
                <td class="ev-table-cell"><strong>Status</strong></td>
                <td class="ev-table-cell"><span class="ev-status-${(member.status || '').toLowerCase().replace(' ', '-')}">${member.status || ""}</span></td>
            </tr>
            <tr class="ev-table-row">
                <td class="ev-table-cell"><strong>Active JDs</strong></td>
                <td class="ev-table-cell">${activeCount}</td>
            </tr>
            <tr class="ev-table-row">
                <td class="ev-table-cell"><strong>Closed JDs</strong></td>
                <td class="ev-table-cell">${closedCount}</td>
            </tr>
            <tr class="ev-table-row">
                <td class="ev-table-cell"><strong>On Hold JDs</strong></td>
                <td class="ev-table-cell">${holdCount}</td>
            </tr>
        </table>
    </div>
</div>
`;
resultDiv.innerHTML = html;

                // Assigned JDs Table with Pagination and Count
                const jdSection = document.createElement("div");
                jdSection.className = "ev-section";
                const jds = data.jds || [];
                jdSection.innerHTML = `<h3>Assigned JDs <span style="color:#898fa4;font-weight:500;font-size:0.98em;">(${jds.length})</span></h3>`;
                let jdPage = 1;
                function renderJDs(page) {
                    jdSection.querySelectorAll("table,.ev-no-data,.ev-pagination").forEach(e => e.remove());
                    const jds = data.jds || [];
                    if (jds.length === 0) {
                        const noData = document.createElement("div");
                        noData.className = "ev-no-data";
                        noData.textContent = "No JDs assigned to this member.";
                        jdSection.appendChild(noData);
                        return;
                    }
                    const { rows, numPages } = paginate(jds, page, 5);
                    let table = `<div class="ev-table-container"><table class="ev-table"><thead>
                        <tr>
                            <th>JD ID</th>
                            <th>Summary</th>
                            <th>Status</th>
                            <th>Team</th>
                            <th>Company</th>
                        </tr></thead><tbody>`;
                    rows.forEach(jd => {
                        table += `<tr>
                            <td>${jd.jd_id}</td>
                            <td>${jd.jd_summary}</td>
                            <td>
                                <span class="ev-status-${jd.jd_status.replace(" ", "-")}">${jd.jd_status}</span>
                            </td>
                            <td>${jd.team_name || "-"}</td>
                            <td>${jd.company_name || "-"}</td>
                        </tr>`;
                    });
                    table += `</tbody></table></div>`;
                    jdSection.insertAdjacentHTML("beforeend", table);
                    // Pagination controls
                    if (numPages > 1) {
                        const pagDiv = document.createElement("div");
                        pagDiv.className = "ev-pagination";
                        renderPagination(pagDiv, page, numPages, renderJDs);
                        jdSection.appendChild(pagDiv);
                    }
                }
                renderJDs(jdPage);
                resultDiv.appendChild(jdSection);

                // Teams & JDs Table with Pagination per team
                const teamsSection = document.createElement("div");
                teamsSection.className = "ev-section";
                teamsSection.innerHTML = `<h3>Teams & JDs</h3>`;
                if (!data.teams || data.teams.length === 0) {
                    teamsSection.insertAdjacentHTML("beforeend", `<div class="ev-no-data">Member is not part of any team.</div>`);
                } else {
                    data.teams.forEach((team, idx) => {
                        const teamDiv = document.createElement("div");
                        teamDiv.style.marginBottom = "18px";
                        teamDiv.innerHTML = `<div class="ev-team-header">${team.team_name}</div>`;
                        let teamJdPage = 1;
                        function renderTeamJDs(page) {
                            teamDiv.querySelectorAll("table,.ev-no-data,.ev-pagination").forEach(e => e.remove());
                            const jds = team.jds || [];
                            if (jds.length === 0) {
                                const noData = document.createElement("div");
                                noData.className = "ev-no-data";
                                noData.textContent = "No JDs for this team.";
                                teamDiv.appendChild(noData);
                                return;
                            }
                            const { rows, numPages } = paginate(jds, page, 5);
                            let table = `<div class="ev-table-container"><table class="ev-table"><thead>
                                <tr>
                                    <th>JD ID</th>
                                    <th>Summary</th>
                                    <th>Status</th>
                                    <th>Company</th>
                                </tr></thead><tbody>`;
                            rows.forEach(jd => {
                                table += `<tr>
                                    <td>${jd.jd_id}</td>
                                    <td>${jd.jd_summary}</td>
                                    <td>
                                        <span class="ev-status-${jd.jd_status.replace(" ", "-")}">${jd.jd_status}</span>
                                    </td>
                                    <td>${jd.company_name || "-"}</td>
                                </tr>`;
                            });
                            table += `</tbody></table></div>`;
                            teamDiv.insertAdjacentHTML("beforeend", table);
                            if (numPages > 1) {
                                const pagDiv = document.createElement("div");
                                pagDiv.className = "ev-pagination";
                                renderPagination(pagDiv, page, numPages, renderTeamJDs);
                                teamDiv.appendChild(pagDiv);
                            }
                        }
                        renderTeamJDs(teamJdPage);
                        teamsSection.appendChild(teamDiv);
                    });
                }
                resultDiv.appendChild(teamsSection);
            }
        });