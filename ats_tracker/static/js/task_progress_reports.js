document.addEventListener("DOMContentLoaded", function() {
    // --- Filter dropdowns ---
    fetch("/api/team_report_filters/")
        .then(resp => resp.json())
        .then(data => {
            const teamSel = document.getElementById("filter-team");
            teamSel.innerHTML = `<option value="">All Teams</option>`;
            data.teams.forEach(t => {
                teamSel.innerHTML += `<option value="${t.team_id}">${t.team_name}</option>`;
            });
        });

    // --- Main report fetch ---
    function fetchReports() {
        const params = {
            team_id: document.getElementById("filter-team").value,
            jd_status: document.getElementById("filter-jd-status").value,
            from_date: document.getElementById("filter-from-date").value,
            to_date: document.getElementById("filter-to-date").value
        };
        fetch("/api/team_reports/?"+new URLSearchParams(params))
            .then(resp => resp.json())
            .then(data => {
                renderJDProgress(data.jd_progress);
                renderProfileStatusChart(data.profile_status_chart);
                renderJDCompletionChart(data.jd_completion_chart);
                renderTeamContribution(data.team_contribution);
                renderTimelineChart(data.timeline_chart);
            });
    }
    document.getElementById("tpr-filter-btn").onclick = fetchReports;
    fetchReports();

    // --- JD Progress Table ---
    function renderJDProgress(jds) {
        const tbody = document.querySelector("#jd-progress-table tbody");
        tbody.innerHTML = "";
        jds.forEach(jd => {
            const completion = jd.total_profiles ? Math.round((jd.profiles_selected / jd.total_profiles) * 100) : 0;
            tbody.innerHTML += `<tr>
                <td>${jd.jd_id}</td>
                <td>${jd.jd_summary}</td>
                <td>${jd.team_name}</td>
                <td>${jd.jd_status}</td>
                <td>${jd.total_profiles}</td>
                <td>${jd.profiles_in_progress}</td>
                <td>${jd.profiles_completed}</td>
                <td>${jd.profiles_selected}</td>
                <td>${jd.profiles_rejected}</td>
                <td>${jd.profiles_on_hold}</td>
                <td>${completion}%</td>
                <td><button class="tpr-btn-secondary tpr-drilldown-btn" data-jd="${jd.jd_id}">View</button></td>
            </tr>`;
        });
        document.querySelectorAll(".tpr-drilldown-btn").forEach(btn => {
            btn.onclick = function() {
                fetch(`/api/jds/${btn.getAttribute("data-jd")}/`)
                    .then(resp => resp.json())
                    .then(data => renderJDDrilldown(data.candidates));
                document.getElementById("jd-drilldown-section").style.display = "block";
            };
        });
    }

    // --- Profile Status Chart ---
    let profileStatusChart;
    function renderProfileStatusChart(chartData) {
        const ctx = document.getElementById("profileStatusChart").getContext("2d");
        if (profileStatusChart) profileStatusChart.destroy();
        profileStatusChart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    backgroundColor: ["#2563eb", "#16a34a", "#dc2626", "#f59e42", "#a3a3a3"]
                }]
            },
            options: { responsive: true }
        });
    }

    // --- JD Completion Chart ---
    let jdCompletionChart;
    function renderJDCompletionChart(chartData) {
        const ctx = document.getElementById("jdCompletionChart").getContext("2d");
        if (jdCompletionChart) jdCompletionChart.destroy();
        jdCompletionChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: "% Completion",
                    data: chartData.data,
                    backgroundColor: "#2563eb"
                }]
            },
            options: { responsive: true }
        });
    }

    // --- Team Contribution Table ---
    function renderTeamContribution(rows) {
        const tbody = document.querySelector("#team-contribution-table tbody");
        tbody.innerHTML = "";
        rows.forEach(r => {
            tbody.innerHTML += `<tr>
                <td>${r.jd_id}</td>
                <td>${r.team_name}</td>
                <td>${r.member_name}</td>
                <td>${r.profiles_processed}</td>
                <td>${r.selected}</td>
                <td>${r.rejected}</td>
                <td>${r.on_hold}</td>
            </tr>`;
        });
    }

    // --- Timeline Chart ---
    let timelineChart;
    function renderTimelineChart(chartData) {
        const ctx = document.getElementById("timelineChart").getContext("2d");
        if (timelineChart) timelineChart.destroy();
        timelineChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets
            },
            options: { responsive: true }
        });
    }

    // --- JD Drilldown Table ---
    function renderJDDrilldown(candidates) {
        const tbody = document.querySelector("#jd-drilldown-table tbody");
        tbody.innerHTML = "";
        candidates.forEach(c => {
            tbody.innerHTML += `<tr>
                <td>${c.name}</td>
                <td>${c.email}</td>
                <td>${c.phone}</td>
                <td>${c.status}</td>
                <td>${c.team_name}</td>
                <td>${c.member_name}</td>
                <td><a href="/candidate-profile/?id=${c.candidate_id}" class="tpr-btn-secondary">Profile</a></td>
            </tr>`;
        });
    }

    // --- Export Button ---
    document.getElementById("tpr-export-btn").onclick = function() {
        window.location.href = "/api/team_reports/export/?" + new URLSearchParams({
            team_id: document.getElementById("filter-team").value,
            jd_status: document.getElementById("filter-jd-status").value,
            from_date: document.getElementById("filter-from-date").value,
            to_date: document.getElementById("filter-to-date").value
        });
    };
});