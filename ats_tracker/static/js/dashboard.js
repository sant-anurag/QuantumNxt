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
        });
}

function renderPendingJDsTable(jds) {
    const tbody = document.getElementById("pending-jds-table").querySelector("tbody");
    tbody.innerHTML = "";
    if (jds.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No active/pending JDs assigned.</td></tr>`;
        return;
    }
    jds.forEach(jd => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${jd.jd_id}</td>
                        <td>${jd.jd_summary}</td>
                        <td>${jd.company_name}</td>
                        <td>${jd.jd_status}</td>
                        <td>${jd.created_at}</td>`;
        tbody.appendChild(tr);
    });
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