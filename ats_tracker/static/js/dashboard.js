document.addEventListener("DOMContentLoaded", function() {
    fetchDashboardData();
});

function fetchDashboardData() {
    fetch("/dashboard_data/")
        .then(response => response.json())
        .then(data => {
            renderPendingJDsTable(data.pending_jds);
            renderMonthlyReportTable(data.monthly_report);
            renderCustomerPieChart(data.customer_pie);
            renderClosedJDsBarChart(data.closed_jds_bar);
            renderInProgressCandidatesTable(data.in_progress_candidates);
        });
}

let pendingJDsData = [];
let pendingJDsPage = 1;
const pendingJDsPageSize = 5;

function renderPendingJDsTable(jds) {
    pendingJDsData = jds || [];
    pendingJDsPage = 1;
    renderPendingJDsPage();
}

function renderPendingJDsPage() {
    const tbody = document.getElementById("pending-jds-table").querySelector("tbody");
    tbody.innerHTML = "";
    const start = (pendingJDsPage - 1) * pendingJDsPageSize;
    const end = start + pendingJDsPageSize;
    const pageData = pendingJDsData.slice(start, end);

    if (pendingJDsData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No active/pending JDs assigned.</td></tr>`;
    } else {
        pageData.forEach(jd => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${jd.jd_id}</td>
                            <td>${jd.jd_summary}</td>
                            <td>${jd.company_name}</td>
                            <td>${jd.jd_status}</td>
                            <td>${jd.not_finalized_count}</td>`;
            tbody.appendChild(tr);
        });
    }
    renderPendingJDsPagination();
}

function renderPendingJDsPagination() {
    let pagination = document.getElementById("pending-jds-pagination");
    if (!pagination) {
        pagination = document.createElement("div");
        pagination.id = "pending-jds-pagination";
        pagination.className = "dashboard-pagination";
        document.getElementById("pending-jds-table").after(pagination);
    }
    pagination.innerHTML = "";

    const totalPages = Math.ceil(pendingJDsData.length / pendingJDsPageSize);
    if (totalPages <= 1) return;

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "Prev";
    prevBtn.disabled = pendingJDsPage === 1;
    prevBtn.onclick = () => { pendingJDsPage--; renderPendingJDsPage(); };
    pagination.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.textContent = i;
        pageBtn.className = i === pendingJDsPage ? "active" : "";
        pageBtn.onclick = () => { pendingJDsPage = i; renderPendingJDsPage(); };
        pagination.appendChild(pageBtn);
    }

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.disabled = pendingJDsPage === totalPages;
    nextBtn.onclick = () => { pendingJDsPage++; renderPendingJDsPage(); };
    pagination.appendChild(nextBtn);
}

function renderMonthlyReportTable(report) {
    const tbody = document.getElementById("monthly-report-table").querySelector("tbody");
    tbody.innerHTML = "";
    if (report.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3">No closed JDs or candidates found for recent months.</td></tr>`;
        return;
    }
    report.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${row.month}</td>
                        <td>${row.closed_jds}</td>
                        <td>${row.candidates}</td>`;
        tbody.appendChild(tr);
    });
}

function renderCustomerPieChart(pieData) {
    const ctx = document.getElementById("customerPieChart").getContext("2d");
    if (window.customerPieChartInstance) window.customerPieChartInstance.destroy();
    window.customerPieChartInstance = new Chart(ctx, {
        type: "pie",
        data: {
            labels: pieData.labels,
            datasets: [{
                data: pieData.data,
                backgroundColor: ["#5661d2", "#38a169", "#4f8cff", "#f6ad55", "#e53e3e", "#7280ff"]
            }]
        },
        options: {
            plugins: { legend: { position: "bottom" } }
        }
    });
}

function renderClosedJDsBarChart(barData) {
    const ctx = document.getElementById("closedJDsBarChart").getContext("2d");
    if (window.closedJDsBarChartInstance) window.closedJDsBarChartInstance.destroy();
    window.closedJDsBarChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: barData.labels,
            datasets: [{
                label: "Closed JDs",
                data: barData.data,
                backgroundColor: "#5661d2"
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderInProgressCandidatesTable(candidates) {
    const tbody = document.getElementById('in-progress-candidates-table').querySelector('tbody');
    tbody.innerHTML = '';
    if (!candidates || candidates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10">No in-progress candidates found.</td></tr>`;
        return;
    }
    candidates.forEach(c => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${c.candidate_id}</td>
            <td class="tooltip" title="${c.name || ''}">${c.name || ''}</td>
            <td>${c.jd_id}</td>
            <td>${c.l1_result || ''}</td>
            <td>${c.l2_result || ''}</td>
            <td>${c.l3_result || ''}</td>
            <td class="tooltip" title="${c.company_name || ''}">${c.company_name || ''}</td>
            <td class="tooltip" title="${c.team_name || ''}">${c.team_name || ''}</td>
            <td>${c.last_updated || ''}</td>
            <td class="tooltip" title="${c.recruiter_comments || ''}">${c.recruiter_comments || ''}</td>
        `;
        tbody.appendChild(row);
    });
}