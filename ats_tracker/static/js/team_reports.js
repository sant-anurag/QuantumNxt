document.addEventListener("DOMContentLoaded", function() {
let allTeams = [];
const teamSearchInput = document.getElementById("teamSearchInput");
const teamDropdownList = document.getElementById("teamDropdownList");
const teamSearchHidden = document.getElementById("teamSearchHidden");
const teamReportFilter = document.getElementById("teamReportFilter");

// Fetch all teams for dropdown filter
fetch("/api/teams/list/")
    .then(resp => resp.json())
    .then(data => {
        allTeams = data.teams || [];
    });

// Dropdown filter logic
teamSearchInput.addEventListener("input", function() {
    const term = teamSearchInput.value.trim().toLowerCase();
    if (term.length < 3) {
        teamDropdownList.style.display = "none";
        return;
    }
    const filtered = allTeams.filter(t => t.name.toLowerCase().includes(term));
        teamDropdownList.innerHTML = "";
        if (filtered.length === 0) {
            teamDropdownList.innerHTML = `<div class="no-results">No teams found.</div>`;
        } else {
            filtered.forEach(t => {
                const div = document.createElement("div");
                div.className = "dropdown-item";
                div.textContent = t.name;
                div.style.cursor = "pointer";
                div.style.pointerEvents = "auto";
                div.addEventListener("mousedown", function(e) {
                    teamSearchInput.value = t.name;
                    teamSearchHidden.value = t.name;
                    setTimeout(() => { teamDropdownList.style.display = "none"; }, 0);
                    e.preventDefault();
                });
                teamDropdownList.appendChild(div);
            });
        }
        teamDropdownList.style.display = "block";
});

teamSearchInput.addEventListener("blur", function() {
    setTimeout(() => {
        if (!teamDropdownList.matches(':hover')) {
            teamDropdownList.style.display = "none";
        }
    }, 200);
});

teamSearchInput.addEventListener("focus", function() {
    if (teamSearchInput.value.length >= 3) {
        teamDropdownList.style.display = "block";
    }
});

// Set hidden input on manual change
teamSearchInput.addEventListener("change", function() {
    teamSearchHidden.value = teamSearchInput.value;
});

// Populate other filters (members, customers)
fetch("/api/teams/filters/")
    .then(resp => resp.json())
    .then(data => {
        const memberSelect = teamReportFilter.querySelector('[name="team_member"]');
        memberSelect.innerHTML = `<option value="">All Members</option>`;
        data.members.forEach(m => {
            memberSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        });
        const customerSelect = teamReportFilter.querySelector('[name="customer"]');
        customerSelect.innerHTML = `<option value="">All Customers</option>`;
        data.customers.forEach(c => {
            customerSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    });

// Handle filter submit
teamReportFilter.addEventListener("submit", function(e) {
    e.preventDefault();
    const formData = new FormData(teamReportFilter);
    const params = {};
    for (let [key, value] of formData.entries()) {
        params[key] = value;
    }
    fetch("/api/teams/report/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
        body: JSON.stringify(params)
    })
    .then(resp => resp.json())
    .then(data => {
        renderReportTables(data);
    });
});
document.getElementById('exportBtn').addEventListener('click', function() {
    // Helper to extract table data by table id
    function getTableData(tableId) {
        const table = document.getElementById(tableId);
        const rows = [];
        for (let tr of table.querySelectorAll('tr')) {
            const row = [];
            for (let td of tr.querySelectorAll('th,td')) {
                row.push(td.innerText.trim());
            }
            rows.push(row);
        }
        return rows;
    }
    // Collect data from all report tables
    const teamOverviewData = getTableData('teamOverviewTable');
    const recruitmentMetricsData = getTableData('recruitmentMetricsTable');
    const candidatePipelineData = getTableData('candidatePipelineTable');
    const memberContributionData = getTableData('memberContributionTable');
    const customerDistributionData = getTableData('customerDistributionTable');

    // Send all data to Django view
    fetch('/export_team_reports_excel/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({
            teamOverviewData: teamOverviewData,
            recruitmentMetricsData: recruitmentMetricsData,
            candidatePipelineData: candidatePipelineData,
            memberContributionData: memberContributionData,
            customerDistributionData: customerDistributionData
        })
    })
    .then(response => response.blob())
    .then(blob => {
        // Download the Excel file
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'team_reports.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    });
});

// Helper to get CSRF token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
// Render report tables
function renderReportTables(data) {
    // Team Overview
    const teamOverviewTable = document.getElementById("teamOverviewTable").querySelector("tbody");
    teamOverviewTable.innerHTML = "";
    if (data.team_overview && data.team_overview.length) {
        data.team_overview.forEach(row => {
            teamOverviewTable.innerHTML += `<tr>
                <td>${row.team_name}</td>
                <td>${row.team_lead}</td>
                <td>${row.members.join(", ")}</td>
            </tr>`;
        });
    } else {
        teamOverviewTable.innerHTML = `<tr><td colspan="3" class="ct-no-data">No data found.</td></tr>`;
    }
    // Recruitment Metrics
    const recruitmentMetricsTable = document.getElementById("recruitmentMetricsTable").querySelector("tbody");
    recruitmentMetricsTable.innerHTML = "";
    if (data.recruitment_metrics && data.recruitment_metrics.length) {
        data.recruitment_metrics.forEach(row => {
            recruitmentMetricsTable.innerHTML += `<tr>
                <td>${row.total_jds}</td>
                <td>${row.in_progress}</td>
                <td>${row.closed}</td>
                <td>${row.avg_closure_time}</td>
            </tr>`;
        });
    } else {
        recruitmentMetricsTable.innerHTML = `<tr><td colspan="4" class="ct-no-data">No data found.</td></tr>`;
    }
    // Candidate Pipeline
    const candidatePipelineTable = document.getElementById("candidatePipelineTable").querySelector("tbody");
    candidatePipelineTable.innerHTML = "";
    if (data.candidate_pipeline && data.candidate_pipeline.length) {
        data.candidate_pipeline.forEach(row => {
            candidatePipelineTable.innerHTML += `<tr>
                <td>${row.sourced}</td>
                <td>${row.l1}</td>
                <td>${row.l2}</td>
                <td>${row.l3}</td>
                <td>${row.offered}</td>
                <td>${row.accepted}</td>
                <td>${row.rejected}</td>
            </tr>`;
        });
    } else {
        candidatePipelineTable.innerHTML = `<tr><td colspan="7" class="ct-no-data">No data found.</td></tr>`;
    }
    // Member Contribution
    const memberContributionTable = document.getElementById("memberContributionTable").querySelector("tbody");
    memberContributionTable.innerHTML = "";
    if (data.member_contribution && data.member_contribution.length) {
        data.member_contribution.forEach(row => {
            memberContributionTable.innerHTML += `<tr>
                <td>${row.member}</td>
                <td>${row.jds_handled}</td>
                <td>${row.candidates_processed}</td>
                <td>${row.offers_made}</td>
                <td>${row.top_performer ? "Yes" : "No"}</td>
            </tr>`;
        });
    } else {
        memberContributionTable.innerHTML = `<tr><td colspan="5" class="ct-no-data">No data found.</td></tr>`;
    }
    // Customer Distribution
    const customerDistributionTable = document.getElementById("customerDistributionTable").querySelector("tbody");
    customerDistributionTable.innerHTML = "";
    if (data.customer_distribution && data.customer_distribution.length) {
        data.customer_distribution.forEach(row => {
            customerDistributionTable.innerHTML += `<tr>
                <td>${row.customer}</td>
                <td>${row.jds_handled}</td>
                <td>${row.candidates_placed}</td>
            </tr>`;
        });
    } else {
        customerDistributionTable.innerHTML = `<tr><td colspan="3" class="ct-no-data">No data found.</td></tr>`;
    }
    // Charts (Performance Analytics)
    // You can update chart.js code here as needed using data.performance_analytics
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