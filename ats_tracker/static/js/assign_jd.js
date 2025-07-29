document.addEventListener("DOMContentLoaded", function() {
    let allJDs = [];
    let allTeams = [];

    // Fetch JDs and Teams for dropdowns
    fetch("/assign_jd_data/")
        .then(resp => resp.json())
        .then(data => {
            allJDs = data.jds;
            allTeams = data.teams;
            renderJDOptions(allJDs);
            renderTeamOptions(allTeams);
        });

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
        fetch("/assign_jd/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
            body: JSON.stringify({ jd_id: jd_id, team_id: team_id })
        })
        .then(resp => resp.json())
        .then(data => {
            if (data.success) {
                showResult(data.jd, data.team, data.members);
            } else {
                alert(data.error || "Assignment failed.");
            }
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