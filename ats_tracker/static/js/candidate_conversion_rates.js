document.addEventListener("DOMContentLoaded", function() {
    // --- Load filter dropdowns ---
    fetch("/api/ccr_filters/")
        .then(resp => resp.json())
        .then(data => {
            const jdSel = document.getElementById("filter-jd");
            jdSel.innerHTML = `<option value="">All JDs</option>`;
            data.jds.forEach(jd => {
                jdSel.innerHTML += `<option value="${jd.jd_id}">${jd.jd_summary}</option>`;
            });
            const teamSel = document.getElementById("filter-team");
            teamSel.innerHTML = `<option value="">All Teams</option>`;
            data.teams.forEach(t => {
                teamSel.innerHTML += `<option value="${t.team_id}">${t.team_name}</option>`;
            });
        });

    // --- Main report fetch ---
    function fetchReports() {
        const params = {
            jd_id: document.getElementById("filter-jd").value,
            team_id: document.getElementById("filter-team").value,
            from_date: document.getElementById("filter-from-date").value,
            to_date: document.getElementById("filter-to-date").value
        };
        fetch("/api/ccr_reports/?" + new URLSearchParams(params))
            .then(resp => resp.json())
            .then(data => {
                renderFunnelChart(data.funnel);
                renderStageChart(data.stage_rates);
                renderTrendChart(data.trend);
                renderJDTable(data.jd_rates);
                renderTeamTable(data.team_rates);
                renderTimeTable(data.time_metrics);
            });
    }
    document.getElementById("ccr-filter-btn").onclick = fetchReports;
    fetchReports();

    // --- Funnel Chart ---
    let funnelChart;
    function renderFunnelChart(funnel) {
        const ctx = document.getElementById("conversionFunnelChart").getContext("2d");
        if (funnelChart) funnelChart.destroy();
        funnelChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: funnel.labels,
                datasets: [{
                    label: "Candidates",
                    data: funnel.data,
                    backgroundColor: ["#2563eb", "#3b82f6", "#0ea5e9", "#16a34a", "#f59e42"]
                }]
            },
            options: {
                indexAxis: "y",
                plugins: { legend: { display: false } },
                responsive: true
            }
        });
    }

    // --- Stage Conversion Chart ---
    let stageChart;
    function renderStageChart(stage) {
        const ctx = document.getElementById("stageConversionChart").getContext("2d");
        if (stageChart) stageChart.destroy();
        stageChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: stage.labels,
                datasets: [{
                    label: "Conversion %",
                    data: stage.data,
                    backgroundColor: "#2563eb"
                }]
            },
            options: {
                scales: { y: { min: 0, max: 100, ticks: { stepSize: 10 } } },
                plugins: { legend: { display: false } },
                responsive: true
            }
        });
    }

    // --- Trend Chart ---
    let trendChart;
    function renderTrendChart(trend) {
        const ctx = document.getElementById("conversionTrendChart").getContext("2d");
        if (trendChart) trendChart.destroy();
        trendChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: trend.labels,
                datasets: trend.datasets
            },
            options: { responsive: true }
        });
    }

    // --- JD Table ---
    function renderJDTable(rows) {
        const tbody = document.querySelector("#jd-conversion-table tbody");
        tbody.innerHTML = "";
        rows.forEach(r => {
            tbody.innerHTML += `<tr>
                <td>${r.jd_summary}</td>
                <td>${r.team_name}</td>
                <td>${r.total}</td>
                <td>${r.screened}</td>
                <td>${r.l1}</td>
                <td>${r.l2}</td>
                <td>${r.l3}</td>
                <td>${r.final_selected}</td>
                <td>${r.conversion_pct}%</td>
            </tr>`;
        });
    }

    // --- Team Table ---
    function renderTeamTable(rows) {
        const tbody = document.querySelector("#team-conversion-table tbody");
        tbody.innerHTML = "";
        rows.forEach(r => {
            tbody.innerHTML += `<tr>
                <td>${r.team_name}</td>
                <td>${r.member_name}</td>
                <td>${r.total}</td>
                <td>${r.final_selected}</td>
                <td>${r.conversion_pct}%</td>
            </tr>`;
        });
    }

    // --- Time Table ---
    function renderTimeTable(rows) {
        const tbody = document.querySelector("#time-conversion-table tbody");
        tbody.innerHTML = "";
        rows.forEach(r => {
            tbody.innerHTML += `<tr>
                <td>${r.jd_summary}</td>
                <td>${r.screen_l1}</td>
                <td>${r.l1_l2}</td>
                <td>${r.l2_l3}</td>
                <td>${r.l3_final}</td>
            </tr>`;
        });
    }

    // --- Export Button ---
    document.getElementById("ccr-export-btn").onclick = function() {
        window.location.href = "/api/ccr_reports/export/?" + new URLSearchParams({
            jd_id: document.getElementById("filter-jd").value,
            team_id: document.getElementById("filter-team").value,
            from_date: document.getElementById("filter-from-date").value,
            to_date: document.getElementById("filter-to-date").value
        });
    };
});