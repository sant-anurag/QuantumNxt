document.addEventListener('DOMContentLoaded', function() {
        // Initialize Select2 for searchable dropdowns
        $('#teamSelect').select2({
            placeholder: 'Select a team...',
            allowClear: false,
            width: '200px',
            minimumResultsForSearch: 5, // Show search box only if more than 5 options
            escapeMarkup: function(markup) { return markup; },
            templateResult: function(data) {
                return data.text;
            },
            templateSelection: function(data) {
                return data.text;
            }
        });

        $('#memberSelect').select2({
            placeholder: 'Select a member...',
            allowClear: false,
            width: '200px',
            minimumResultsForSearch: 5, // Show search box only if more than 5 options
            escapeMarkup: function(markup) { return markup; },
            templateResult: function(data) {
                return data.text;
            },
            templateSelection: function(data) {
                return data.text;
            }
        });

        // Load teams and members data on page load
        loadTeamsData();
        loadMembersData();

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

        // Handle team selection change to update members
        $('#teamSelect').on('change', function() {
            const selectedTeamId = this.value;
            const selectedMemberId = $('#memberSelect').val();
            
            // Load members for the selected team, but preserve member selection if valid
            loadMembersData(selectedTeamId === 'all' ? null : selectedTeamId, selectedMemberId);
        });

        // Handle member selection change to update teams
        $('#memberSelect').on('change', function() {
            const selectedMemberId = this.value;
            const selectedTeamId = $('#teamSelect').val();
            
            if (selectedMemberId === 'all') {
                // If "All Members" is selected, reload all teams but preserve team selection
                loadTeamsData(selectedTeamId);
            } else {
                // Filter teams based on selected member, but preserve team selection if valid
                loadTeamsForMember(selectedMemberId, selectedTeamId);
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

        // Load teams data
        function loadTeamsData(preserveTeamId = null) {
            fetch('/get_teams/', {
                method: 'GET',
                headers: {'X-CSRFToken': getCookie('csrftoken')}
            })
            .then(res => res.json())
            .then(data => {
                const $teamSelect = $('#teamSelect');
                const currentSelection = preserveTeamId || $teamSelect.val();
                
                // Clear existing options except "All Teams"
                $teamSelect.empty().append('<option value="all">All Teams</option>');
                
                let hasValidSelection = false;
                if (data.teams && data.teams.length > 0) {
                    data.teams.forEach(team => {
                        $teamSelect.append(`<option value="${team.team_id}">${team.team_name}</option>`);
                        
                        // Check if current selection is still valid
                        if (team.team_id == currentSelection) {
                            hasValidSelection = true;
                        }
                    });
                }
                
                // Restore selection if it's still valid
                if (hasValidSelection && currentSelection !== 'all') {
                    $teamSelect.val(currentSelection).trigger('change.select2');
                } else if (preserveTeamId && preserveTeamId !== 'all') {
                    // If we were trying to preserve a selection but it's not valid, reset to "all"
                    $teamSelect.val('all').trigger('change.select2');
                }
            })
            .catch(error => {
                console.error('Error loading teams:', error);
            });
        }

        // Load teams data for a specific member
        function loadTeamsForMember(memberId, preserveTeamId = null) {
            fetch(`/get_teams/?emp_id=${memberId}`, {
                method: 'GET',
                headers: {'X-CSRFToken': getCookie('csrftoken')}
            })
            .then(res => res.json())
            .then(data => {
                const $teamSelect = $('#teamSelect');
                const currentSelection = preserveTeamId || $teamSelect.val();
                
                // Clear existing options except "All Teams"
                $teamSelect.empty().append('<option value="all">All Teams</option>');
                
                let hasValidSelection = false;
                if (data.teams && data.teams.length > 0) {
                    data.teams.forEach(team => {
                        $teamSelect.append(`<option value="${team.team_id}">${team.team_name}</option>`);
                        
                        // Check if current selection is still valid
                        if (team.team_id == currentSelection) {
                            hasValidSelection = true;
                        }
                    });
                }
                
                // Restore selection if it's still valid
                if (hasValidSelection && currentSelection !== 'all') {
                    $teamSelect.val(currentSelection).trigger('change.select2');
                } else if (preserveTeamId && preserveTeamId !== 'all') {
                    // If we were trying to preserve a selection but it's not valid, reset to "all"
                    $teamSelect.val('all').trigger('change.select2');
                }
            })
            .catch(error => {
                console.error('Error loading teams for member:', error);
            });
        }

        // Load members data
        function loadMembersData(teamId = null, preserveMemberId = null) {
            let url = '/get_team_members/';
            if (teamId) {
                url += `?team_id=${teamId}`;
            }

            fetch(url, {
                method: 'GET',
                headers: {'X-CSRFToken': getCookie('csrftoken')}
            })
            .then(res => res.json())
            .then(data => {
                const $memberSelect = $('#memberSelect');
                const currentSelection = preserveMemberId || $memberSelect.val();
                
                // Clear existing options except "All Members"
                $memberSelect.empty().append('<option value="all">All Members</option>');
                
                let hasValidSelection = false;
                if (data.members && data.members.length > 0) {
                    data.members.forEach(member => {
                        $memberSelect.append(`<option value="${member.emp_id}">${member.emp_name}</option>`);
                        
                        // Check if current selection is still valid
                        if (member.emp_id == currentSelection) {
                            hasValidSelection = true;
                        }
                    });
                }
                
                // Restore selection if it's still valid
                if (hasValidSelection && currentSelection !== 'all') {
                    $memberSelect.val(currentSelection).trigger('change.select2');
                } else if (preserveMemberId && preserveMemberId !== 'all') {
                    // If we were trying to preserve a selection but it's not valid, reset to "all"
                    $memberSelect.val('all').trigger('change.select2');
                }
            })
            .catch(error => {
                console.error('Error loading members:', error);
            });
        }

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