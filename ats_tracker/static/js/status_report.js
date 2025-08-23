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
                renderTable(data.report);
                document.getElementById('statusReportMsg').textContent = data.message || '';
            });
        });

        // Render table
        function renderTable(rows) {
            const tbody = document.querySelector('#statusReportTable tbody');
            tbody.innerHTML = '';
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No data found.</td></tr>';
                return;
            }
            rows.forEach((row, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${idx + 1}</td>
                    <td>${row.company_name}</td>
                    <td>${row.jd_summary}</td>
                    <td>${row.jd_id}</td>
                    <td>${row.shared_on}</td>
                    <td>${row.profile_count}</td>
                    <td>${row.feedback}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Export to Excel
        document.getElementById('exportBtn').addEventListener('click', function() {
            const table = document.getElementById('statusReportTable');
            const wb = XLSX.utils.table_to_book(table, {sheet:"Status Report"});
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