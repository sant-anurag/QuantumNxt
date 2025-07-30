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
                document.getElementById("member-search-box").value = item.textContent;
                selectedMember = m;
                dropdown.innerHTML = "";
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

    function renderResult(data) {
        if (!data.member) {
            document.getElementById("employee-result").innerHTML = `<div class="ev-no-data">No data found for this member.</div>`;
            return;
        }
        let html = `<div class="ev-section">
            <h3>Member Details</h3>
            <div><b>Name:</b> ${data.member.first_name} ${data.member.last_name}</div>
            <div><b>Email:</b> ${data.member.email}</div>
            <div><b>Role:</b> ${data.member.role || "-"}</div>
            <div><b>Status:</b> ${data.member.status}</div>
        </div>`;

        // Assigned JDs as table
        html += `<div class="ev-section">
            <h3>Assigned JDs</h3>`;
        if (data.jds.length === 0) {
            html += `<div class="ev-no-data">No JD assignments found.</div>`;
        } else {
            html += `<table class="ev-table">
                <thead>
                    <tr>
                        <th>JD ID</th>
                        <th>Summary</th>
                        <th>Status</th>
                        <th>Team</th>
                        <th>Company</th>
                    </tr>
                </thead>
                <tbody>`;
            data.jds.forEach(jd => {
                html += `<tr>
                    <td>${jd.jd_id}</td>
                    <td>${jd.jd_summary}</td>
                    <td>${jd.jd_status}</td>
                    <td>${jd.team_name || "-"}</td>
                    <td>${jd.company_name || "-"}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
        }
        html += `</div>`;

        // Teams & JDs as table
        html += `<div class="ev-section">
            <h3>Teams & JDs</h3>`;
        if (data.teams.length === 0) {
            html += `<div class="ev-no-data">Member is not part of any team.</div>`;
        } else {
            data.teams.forEach(team => {
                html += `<div class="ev-team-header">${team.team_name}</div>`;
                if (team.jds.length === 0) {
                    html += `<div class="ev-no-data">No JDs assigned to this team.</div>`;
                } else {
                    html += `<table class="ev-table">
                        <thead>
                            <tr>
                                <th>JD ID</th>
                                <th>Summary</th>
                                <th>Status</th>
                                <th>Company</th>
                            </tr>
                        </thead>
                        <tbody>`;
                    team.jds.forEach(jd => {
                        html += `<tr>
                            <td>${jd.jd_id}</td>
                            <td>${jd.jd_summary}</td>
                            <td>${jd.jd_status}</td>
                            <td>${jd.company_name || "-"}</td>
                        </tr>`;
                    });
                    html += `</tbody></table>`;
                }
            });
        }
        html += `</div>`;
        document.getElementById("employee-result").innerHTML = html;
    }
});