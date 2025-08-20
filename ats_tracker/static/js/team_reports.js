document.addEventListener('DOMContentLoaded', function () {
    // Fetch filter options (team members, customers)
    fetch('/api/team_report_filters/')
        .then(res => res.json())
        .then(data => {
            const memberSelect = document.querySelector('select[name="team_member"]');
            data.members.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                memberSelect.appendChild(opt);
            });
            const customerSelect = document.querySelector('select[name="customer"]');
            data.customers.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                customerSelect.appendChild(opt);
            });
        });

    // Fetch and render report data
    function loadReports(params = {}) {
        let url = '/api/team_reports/?' + new URLSearchParams(params).toString();
        fetch(url)
            .then(res => res.json())
            .then(data => {
                // Team Overview
                fillTable('teamOverviewTable', data.team_overview, ['team_name', 'team_lead', 'members']);
                // Recruitment Metrics
                fillTable('recruitmentMetricsTable', [data.recruitment_metrics], ['total_jds', 'in_progress', 'closed', 'avg_closure_time']);
                // Candidate Pipeline
                fillTable('candidatePipelineTable', [data.candidate_pipeline], ['sourced', 'l1', 'l2', 'l3', 'offered', 'accepted', 'rejected']);
                // Member Contribution
                fillTable('memberContributionTable', data.member_contribution, ['member', 'jds_handled', 'candidates_processed', 'offers_made', 'top_performer']);
                // Customer Distribution
                fillTable('customerDistributionTable', data.customer_distribution, ['customer', 'jds_handled', 'candidates_placed']);
                // Charts
                renderChart('conversionRateChart', 'Conversion Rate', data.performance_analytics.conversion_rate);
                renderChart('successRateChart', 'Success Rate', data.performance_analytics.success_rate);
                renderBarChart('monthlyTrendsChart', 'Monthly Trends', data.performance_analytics.monthly_trends);
            });
    }

    function fillTable(tableId, rows, keys) {
        const tbody = document.getElementById(tableId).querySelector('tbody');
        tbody.innerHTML = '';
        rows.forEach(row => {
            const tr = document.createElement('tr');
            keys.forEach(k => {
                const td = document.createElement('td');
                td.textContent = row[k];
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    function renderChart(canvasId, label, value) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [label, 'Other'],
                datasets: [{
                    data: [value, 100 - value],
                    backgroundColor: ['#5661d2', '#e3eafc'],
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }

    function renderBarChart(canvasId, label, data) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: label,
                    data: data.values,
                    backgroundColor: '#5661d2'
                }]
            },
            options: { responsive: true }
        });
    }

    // Filter form
    document.getElementById('teamReportFilter').addEventListener('submit', function (e) {
        e.preventDefault();
        const params = Object.fromEntries(new FormData(this).entries());
        loadReports(params);
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', function () {
        window.open('/api/team_reports/export/?' + new URLSearchParams(Object.fromEntries(new FormData(document.getElementById('teamReportFilter')).entries())).toString());
    });

    // Initial load
    loadReports();
});