document.addEventListener('DOMContentLoaded', function() {
        // Show/hide date fields based on report type
        const reportType = document.getElementById('reportType');
        const dateInput = document.getElementById('dateInput');
        const fromDateInput = document.getElementById('fromDateInput');
        const toDateInput = document.getElementById('toDateInput');
        const dateLabel = document.getElementById('dateLabel');
        const fromLabel = document.getElementById('fromLabel');
        const toLabel = document.getElementById('toLabel');

        reportType.addEventListener('change', function() {
            if (this.value === 'custom') {
                dateInput.style.display = 'none';
                dateLabel.style.display = 'none';
                fromDateInput.style.display = '';
                toDateInput.style.display = '';
                fromLabel.style.display = '';
                toLabel.style.display = '';
                fromDateInput.required = true;
                toDateInput.required = true;
                dateInput.required = false;
            } else {
                dateInput.style.display = '';
                dateLabel.style.display = '';
                fromDateInput.style.display = 'none';
                toDateInput.style.display = 'none';
                fromLabel.style.display = 'none';
                toLabel.style.display = 'none';
                fromDateInput.required = false;
                toDateInput.required = false;
                dateInput.required = true;
            }
        });

        // AJAX form submit
        document.getElementById('statusReportForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            fetch('/status_report/generate/', {
                method: 'POST',
                headers: {'X-CSRFToken': getCookie('csrftoken')},
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                console.log(data);
                renderTable(data.report);
                document.getElementById('statusReportMsg').textContent = data.message || '';
                if (window.renderCandidateTables) {
                    renderCandidateTables(data.list_of_candidates);
                }
            });
// Load candidate_tables.js dynamically if not already loaded
if (!window.renderCandidateTables) {
    const script = document.createElement('script');
    script.src = '/static/js/candidate_tables.js';
    document.head.appendChild(script);
}
        });

        // Render table
        function renderTable(rows) {
            const tbody = document.querySelector('#statusReportTable tbody');
            tbody.innerHTML = '';
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No data found.</td></tr>';
                return;
            }
            rows.forEach((row, idx) => {
                const tr = document.createElement('tr');
                if (idx === rows.length - 1) {
                    // Last row: summary, bold, no serial number
                    tr.innerHTML = `
                        <td></td>
                        <td style="font-weight:bold;">${row.company_name}</td>
                        <td style="font-weight:bold;">${row.jd_summary}</td>
                        <td style="font-weight:bold;">${row.jd_id}</td>
                        <td style="font-weight:bold;">${row.profile_count}</td>
                        <td style="font-weight:bold;">${row.feedback}</td>
                    `;
                } else {
                    tr.innerHTML = `
                        <td>${idx + 1}</td>
                        <td>${row.company_name}</td>
                        <td>${row.jd_summary}</td>
                        <td>${row.jd_id}</td>
                        <td>${row.profile_count}</td>
                        <td>${row.feedback}</td>
                    `;
                }
                tbody.appendChild(tr);
            });
        }

        // Export to Excel
        document.getElementById('exportBtn').addEventListener('click', function() {
            const table = document.getElementById('statusReportTable');
            const wb = XLSX.utils.book_new();
            // Add main status report sheet
            const mainSheet = XLSX.utils.table_to_sheet(table);
            XLSX.utils.book_append_sheet(wb, mainSheet, "Status Report");

            // Add candidate tables as sheets
            const candidateBlocks = document.querySelectorAll('.candidate-meta');
            const candidateTables = document.querySelectorAll('.candidate-table');
            candidateTables.forEach((candTable, idx) => {
                // Try to get jd_id and company name from metadata block
                let sheetName = `Candidates_${idx+1}`;
                if (candidateBlocks[idx]) {
                    const metaText = candidateBlocks[idx].textContent;
                    // Extract JD and company name
                    const jdMatch = metaText.match(/JD:\s*([^|]+)/);
                    const companyMatch = metaText.match(/Company:\s*([^|]+)/);
                    let jd = jdMatch ? jdMatch[1].trim() : '';
                    let company = companyMatch ? companyMatch[1].trim() : '';
                    if (jd || company) {
                        sheetName = `${jd}${company ? '_' + company : ''}`.replace(/[^A-Za-z0-9_]/g, '').slice(0, 31);
                    }
                }
                const sheet = XLSX.utils.table_to_sheet(candTable);
                XLSX.utils.book_append_sheet(wb, sheet, sheetName || `Candidates_${idx+1}`);
            });

            const today = new Date().toISOString().slice(0,10);
            XLSX.writeFile(wb, `Report_${today}.xlsx`);
        });

        // CSRF helper
        function getCookie(name) {
            let cookieValue = null;
            if (document.cookie && document.cookie !== '') {
                const cookies = document.cookie.split(';');
                for (let i=0; i<cookies.length; i++) {
                    const c = cookies[i].trim();
                    if (c.substring(0, name.length+1) === (name+'=')) {
                        cookieValue = decodeURIComponent(c.substring(name.length+1));
                        break;
                    }
                }
            }
            return cookieValue;
        }
    });