document.addEventListener('DOMContentLoaded', function() {
    loadAdminDashboardData();
    loadCustomerJDStats(1); // Load first page
    loadTeamwiseStats(1); // Load team-wise stats first page
    loadCurrentCustomersChart(); // Load current customers chart
    loadRecruitmentFunnelChart(); // Load recruitment funnel chart
});

function loadAdminDashboardData() {
    fetch('/api/admin-dashboard-data/', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateKPICards(data.data);
        } else {
            console.error('Failed to load admin dashboard data:', data.message);
            showErrorState();
        }
    })
    .catch(error => {
        console.error('Error fetching admin dashboard data:', error);
        showErrorState();
    });
}

function loadCustomerJDStats(page = 1) {
    fetch(`/api/admin-dashboard-data/customer-jd-stats/?page=${page}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateCustomerStatsTable(data.data, data.pagination);
        } else {
            console.error('Failed to load customer JD stats:', data.message);
            showCustomerStatsError();
        }
    })
    .catch(error => {
        console.error('Error fetching customer JD stats:', error);
        showCustomerStatsError();
    });
}

function loadTeamwiseStats(page = 1) {
    fetch(`/api/admin-dashboard-data/teamwise-stats/?page=${page}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateTeamStatsTable(data.data, data.pagination);
        } else {
            console.error('Failed to load team-wise stats:', data.message);
            showTeamStatsError();
        }
    })
    .catch(error => {
        console.error('Error fetching team-wise stats:', error);
        showTeamStatsError();
    });
}

function updateCustomerStatsTable(customers, pagination) {
    const tbody = document.getElementById('customer-stats-tbody');
    
    if (!customers || customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No customer data available</td></tr>';
        return;
    }

    tbody.innerHTML = customers.map(customer => {
        const total = customer.Active_JD_Count + customer.Onhold_JD_Count + customer.Closed_JD_Count;
        const companyId = customer.company_id;
        const companyName = customer.company_name;
        
        return `
            <tr>
                <td title="${companyName}">${companyName}</td>
                <td>
                    <button class="count-btn btn-active" 
                            data-company-id="${companyId}" 
                            data-status="active" 
                            data-company-name="${companyName}"
                            onclick="handleCountClick(this)">
                        ${customer.Active_JD_Count}
                    </button>
                </td>
                <td>
                    <button class="count-btn btn-onhold" 
                            data-company-id="${companyId}" 
                            data-status="onhold" 
                            data-company-name="${companyName}"
                            onclick="handleCountClick(this)">
                        ${customer.Onhold_JD_Count}
                    </button>
                </td>
                <td>
                    <button class="count-btn btn-closed" 
                            data-company-id="${companyId}" 
                            data-status="closed" 
                            data-company-name="${companyName}"
                            onclick="handleCountClick(this)">
                        ${customer.Closed_JD_Count}
                    </button>
                </td>
                <td>
                    <button class="count-btn btn-total" 
                            data-company-id="${companyId}" 
                            data-status="total" 
                            data-company-name="${companyName}"
                            onclick="handleCountClick(this)">
                        ${total}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Update pagination
    updatePagination(pagination);
}

function handleCountClick(button) {
    const companyId = button.getAttribute('data-company-id');
    const status = button.getAttribute('data-status');
    const companyName = button.getAttribute('data-company-name');
    const count = button.textContent.trim();
    
    console.log('Count clicked:', {
        companyId: companyId,
        companyName: companyName,
        status: status,
        count: count
    });
    
    // Map status values for API call
    let jdStatus = '';
    if (status === 'active') {
        jdStatus = 'active';
    } else if (status === 'onhold') {
        jdStatus = 'on hold';
    } else if (status === 'closed') {
        jdStatus = 'closed';
    }
    
    // Only proceed if it's not the total button and count > 0
    if (status !== 'total' && parseInt(count) > 0) {
        // Show JD details modal/page
        showJDDetails(companyId, jdStatus, companyName, count);
    } else if (status === 'total' && parseInt(count) > 0) {
        // Show all JDs for this company
        showJDDetails(companyId, '', companyName, count);
    } else {
        // Show info message for zero counts
        alert(`No ${status} JDs found for ${companyName}`);
    }
}

function showJDDetails(companyId, jdStatus, companyName, count) {
    // Build API URL with filters
    let apiUrl = `/api/admin-dashboard-data/jd-info/?company_id=${companyId}&page=1&limit=10`;
    if (jdStatus) {
        apiUrl += `&jd_status=${jdStatus}`;
    }
    
    // Show loading state
    const modalTitle = jdStatus ? 
        `${jdStatus.charAt(0).toUpperCase() + jdStatus.slice(1)} JDs for ${companyName}` : 
        `All JDs for ${companyName}`;
    
    // Create and show modal
    showJDModal(modalTitle, apiUrl, companyName, jdStatus);
}

function showJDModal(title, apiUrl, companyName, jdStatus) {
    // Remove existing modal if any
    const existingModal = document.getElementById('jd-details-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal HTML with card layout
    const modalHtml = `
        <div id="jd-details-modal" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="closeJDModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-content">
                    <div class="jd-cards-container" id="jd-cards-container">
                        <div class="loading-message">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Loading JD details...</span>
                        </div>
                    </div>
                    <div class="modal-pagination" id="jd-modal-pagination" style="display: none;">
                        <div class="pagination-info">
                            <span id="jd-pagination-info">Loading...</span>
                        </div>
                        <div class="pagination-controls">
                            <button class="pagination-btn" id="jd-prev-btn" disabled>
                                <i class="fas fa-chevron-left"></i> Previous
                            </button>
                            <span class="pagination-pages" id="jd-pagination-pages"></span>
                            <button class="pagination-btn" id="jd-next-btn" disabled>
                                Next <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Load JD data
    loadJDDetails(apiUrl, 1);
}

function loadJDDetails(baseUrl, page = 1) {
    const url = baseUrl.replace(/page=\d+/, `page=${page}`);
    
    fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateJDTable(data.data, data.pagination, baseUrl);
        } else {
            showJDError('Failed to load JD details: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error fetching JD details:', error);
        showJDError('Error loading JD details. Please try again.');
    });
}

function updateJDTable(jds, pagination, baseUrl) {
    const cardsContainer = document.getElementById('jd-cards-container');
    const paginationContainer = document.getElementById('jd-modal-pagination');
    
    if (!jds || jds.length === 0) {
        cardsContainer.innerHTML = '<div class="no-data-message"><i class="fas fa-inbox"></i><span>No JD records found</span></div>';
        paginationContainer.style.display = 'none';
        return;
    }
    
    // Create JD cards
    const cardsHtml = jds.map(jd => {
        const statusClass = getStatusClass(jd.jd_status);
        const createdDate = new Date(jd.created_at).toLocaleDateString();
        const closureDate = jd.closure_date ? new Date(jd.closure_date).toLocaleDateString() : 'Not set';
        const profilesProgress = jd.total_profiles > 0 ? 
            Math.round((jd.profiles_completed / jd.total_profiles) * 100) : 0;
        
        return `
            <div class="jd-card">
                <div class="jd-card-header">
                    <div class="jd-id">
                        <i class="fas fa-briefcase"></i>
                        <span>${jd.jd_id}</span>
                    </div>
                    <div class="jd-status ${statusClass}">
                        ${jd.jd_status.charAt(0).toUpperCase() + jd.jd_status.slice(1)}
                    </div>
                </div>
                <div class="jd-card-body">
                    <p class="company-name" title="${jd.company_name || 'N/A'}">${jd.company_name || 'N/A'}</p>
                    <h4 class="jd-summary" title="${jd.jd_summary || 'No summary available'}">${jd.jd_summary || 'No summary available'}</h4>
                    <div class="jd-details-grid">
                        <div class="jd-detail-item">
                            <i class="fas fa-users"></i>
                            <div>
                                <span class="detail-label">Team</span>
                                <span class="detail-value">${jd.team_name || 'Unassigned'}</span>
                            </div>
                        </div>
                        <div class="jd-detail-item">
                            <i class="fas fa-chair"></i>
                            <div>
                                <span class="detail-label">Positions</span>
                                <span class="detail-value">${jd.no_of_positions || 0}</span>
                            </div>
                        </div>
                        <div class="jd-detail-item">
                            <i class="fas fa-user-friends"></i>
                            <div>
                                <span class="detail-label">Total Profiles</span>
                                <span class="detail-value">${jd.total_profiles || 0}</span>
                            </div>
                        </div>
                        <div class="jd-detail-item">
                            <i class="fas fa-chart-line"></i>
                            <div>
                                <span class="detail-label">Progress</span>
                                <span class="detail-value">${profilesProgress}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="jd-progress-bar">
                        <div class="progress-track">
                            <div class="progress-fill" style="width: ${profilesProgress}%"></div>
                        </div>
                        <span class="progress-text">${jd.profiles_completed || 0} of ${jd.total_profiles || 0} completed</span>
                    </div>
                </div>
                <div class="jd-card-footer">
                    <div class="jd-dates">
                        <div class="date-item">
                            <i class="fas fa-calendar-plus"></i>
                            <span>Created: ${createdDate}</span>
                        </div>
                        <div class="date-item">
                            <i class="fas fa-calendar-check"></i>
                            <span>Closure: ${closureDate}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    cardsContainer.innerHTML = cardsHtml;
    
    // Update pagination
    if (pagination.total_pages > 1) {
        updateJDPagination(pagination, baseUrl);
        paginationContainer.style.display = 'flex';
    } else {
        paginationContainer.style.display = 'none';
    }
}

function getStatusClass(status) {
    switch(status.toLowerCase()) {
        case 'active': return 'status-active';
        case 'onhold': return 'status-onhold';
        case 'closed': return 'status-closed';
        default: return 'status-default';
    }
}

function updateJDPagination(pagination, baseUrl) {
    const paginationInfo = document.getElementById('jd-pagination-info');
    const prevBtn = document.getElementById('jd-prev-btn');
    const nextBtn = document.getElementById('jd-next-btn');
    const paginationPages = document.getElementById('jd-pagination-pages');
    
    // Update info
    paginationInfo.textContent = `Showing ${pagination.showing_from} to ${pagination.showing_to} of ${pagination.total_records} records`;
    
    // Update buttons
    prevBtn.disabled = !pagination.has_previous;
    prevBtn.onclick = pagination.has_previous ? () => loadJDDetails(baseUrl, pagination.current_page - 1) : null;
    
    nextBtn.disabled = !pagination.has_next;
    nextBtn.onclick = pagination.has_next ? () => loadJDDetails(baseUrl, pagination.current_page + 1) : null;
    
    // Generate page numbers (simplified - show current page and neighbors)
    let pages = [];
    const current = pagination.current_page;
    const total = pagination.total_pages;
    
    if (total <= 5) {
        for (let i = 1; i <= total; i++) {
            pages.push(i);
        }
    } else {
        if (current <= 3) {
            pages = [1, 2, 3, 4, '...', total];
        } else if (current >= total - 2) {
            pages = [1, '...', total - 3, total - 2, total - 1, total];
        } else {
            pages = [1, '...', current - 1, current, current + 1, '...', total];
        }
    }
    
    paginationPages.innerHTML = pages.map(page => {
        if (page === '...') {
            return '<span class="page-ellipsis">...</span>';
        } else {
            const isActive = page === current ? 'active' : '';
            return `<span class="page-number ${isActive}" onclick="loadJDDetails('${baseUrl}', ${page})">${page}</span>`;
        }
    }).join('');
}

function showJDError(message) {
    const cardsContainer = document.getElementById('jd-cards-container');
    cardsContainer.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><span>${message}</span></div>`;
    
    const paginationContainer = document.getElementById('jd-modal-pagination');
    paginationContainer.style.display = 'none';
}

function closeJDModal() {
    const modal = document.getElementById('jd-details-modal');
    if (modal) {
        modal.remove();
    }
}

function updatePagination(pagination) {
    const paginationContainer = document.getElementById('customer-stats-pagination');
    const paginationInfo = document.getElementById('pagination-info-text');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const paginationPages = document.getElementById('pagination-pages');

    if (pagination.total_pages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';
    
    // Update info text
    paginationInfo.textContent = `Page ${pagination.current_page} of ${pagination.total_pages} (${pagination.total_companies} companies)`;
    
    // Update previous button
    prevBtn.disabled = !pagination.has_previous;
    prevBtn.onclick = pagination.has_previous ? () => loadCustomerJDStats(pagination.current_page - 1) : null;
    
    // Update next button
    nextBtn.disabled = !pagination.has_next;
    nextBtn.onclick = pagination.has_next ? () => loadCustomerJDStats(pagination.current_page + 1) : null;
    
    // Update page numbers
    paginationPages.innerHTML = generatePageNumbers(pagination);
}

function generatePageNumbers(pagination) {
    const current = pagination.current_page;
    const total = pagination.total_pages;
    let pages = [];

    if (total <= 7) {
        // Show all pages if total is 7 or less
        for (let i = 1; i <= total; i++) {
            pages.push(i);
        }
    } else {
        // Show pages with ellipsis
        if (current <= 4) {
            pages = [1, 2, 3, 4, 5, '...', total];
        } else if (current >= total - 3) {
            pages = [1, '...', total - 4, total - 3, total - 2, total - 1, total];
        } else {
            pages = [1, '...', current - 1, current, current + 1, '...', total];
        }
    }

    return pages.map(page => {
        if (page === '...') {
            return '<span class="page-ellipsis">...</span>';
        } else {
            const isActive = page === current ? 'active' : '';
            return `<span class="page-number ${isActive}" onclick="loadCustomerJDStats(${page})">${page}</span>`;
        }
    }).join('');
}

function showCustomerStatsError() {
    const tbody = document.getElementById('customer-stats-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell" style="color: #ef4444;">Error loading customer data</td></tr>';
    
    const paginationContainer = document.getElementById('customer-stats-pagination');
    paginationContainer.style.display = 'none';
}

function updateTeamStatsTable(teams, pagination) {
    const tbody = document.getElementById('team-stats-tbody');
    
    if (!teams || teams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No team data available</td></tr>';
        return;
    }

    tbody.innerHTML = teams.map(team => {
        const total = team.active_jds_count + team.on_hold_jds_count + team.closed_jds_count;
        
        return `
            <tr>
                <td style="font-weight: 600; color: #1f2937;" title="${team.team_name}">${team.team_name}</td>
                <td>
                    <button class="count-btn btn-active" 
                            data-team-id="${team.team_id}" 
                            data-status="active" 
                            data-team-name="${team.team_name}"
                            onclick="handleTeamCountClick(this)">
                        ${team.active_jds_count}
                    </button>
                </td>
                <td>
                    <button class="count-btn btn-onhold" 
                            data-team-id="${team.team_id}" 
                            data-status="on hold" 
                            data-team-name="${team.team_name}"
                            onclick="handleTeamCountClick(this)">
                        ${team.on_hold_jds_count}
                    </button>
                </td>
                <td>
                    <button class="count-btn btn-closed" 
                            data-team-id="${team.team_id}" 
                            data-status="closed" 
                            data-team-name="${team.team_name}"
                            onclick="handleTeamCountClick(this)">
                        ${team.closed_jds_count}
                    </button>
                </td>
                <td>
                    <button class="count-btn btn-total" 
                            data-team-id="${team.team_id}" 
                            data-status="total" 
                            data-team-name="${team.team_name}"
                            onclick="handleTeamCountClick(this)">
                        ${total}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Update pagination
    updateTeamPagination(pagination);
}

function handleTeamCountClick(button) {
    const teamId = button.getAttribute('data-team-id');
    const status = button.getAttribute('data-status');
    const teamName = button.getAttribute('data-team-name');
    const count = button.textContent.trim();
    
    console.log('Team count clicked:', {
        teamId: teamId,
        teamName: teamName,
        status: status,
        count: count
    });
    
    // Map status values for API call
    let jdStatus = '';
    if (status === 'active') {
        jdStatus = 'active';
    } else if (status === 'on hold') {
        jdStatus = 'on hold';
    } else if (status === 'closed') {
        jdStatus = 'closed';
    }
    
    // Only proceed if it's not the total button and count > 0
    if (status !== 'total' && parseInt(count) > 0) {
        showTeamJDDetails(teamId, jdStatus, teamName, count);
    } else if (status === 'total' && parseInt(count) > 0) {
        showTeamJDDetails(teamId, '', teamName, count);
    } else {
        console.log('No JDs to show for this team');
    }
}

function showTeamJDDetails(teamId, jdStatus, teamName, count) {
    // Build API URL with filters
    let apiUrl = `/api/admin-dashboard-data/jd-info/?team_id=${teamId}&page=1&limit=10`;
    if (jdStatus) {
        apiUrl += `&jd_status=${jdStatus}`;
    }
    
    // Show loading state
    const modalTitle = jdStatus ? 
        `${jdStatus.charAt(0).toUpperCase() + jdStatus.slice(1)} JDs for Team: ${teamName}` : 
        `All JDs for Team: ${teamName}`;
    
    // Create and show modal (reuse the existing JD modal function)
    showJDModal(modalTitle, apiUrl, teamName, jdStatus);
}

function updateTeamPagination(pagination) {
    const paginationContainer = document.getElementById('team-stats-pagination');
    const paginationInfo = document.getElementById('team-pagination-info-text');
    const prevBtn = document.getElementById('team-prev-page-btn');
    const nextBtn = document.getElementById('team-next-page-btn');
    const paginationPages = document.getElementById('team-pagination-pages');

    if (pagination.total_pages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';
    
    // Update info text
    paginationInfo.textContent = `Page ${pagination.current_page} of ${pagination.total_pages} (${pagination.total_teams} teams)`;
    
    // Update previous button
    prevBtn.disabled = !pagination.has_previous;
    prevBtn.onclick = pagination.has_previous ? () => loadTeamwiseStats(pagination.current_page - 1) : null;
    
    // Update next button
    nextBtn.disabled = !pagination.has_next;
    nextBtn.onclick = pagination.has_next ? () => loadTeamwiseStats(pagination.current_page + 1) : null;
    
    // Update page numbers
    paginationPages.innerHTML = generateTeamPageNumbers(pagination);
}

function generateTeamPageNumbers(pagination) {
    const current = pagination.current_page;
    const total = pagination.total_pages;
    let pages = [];

    if (total <= 7) {
        // Show all pages if total is 7 or less
        for (let i = 1; i <= total; i++) {
            pages.push(i);
        }
    } else {
        // Show pages with ellipsis
        if (current <= 4) {
            pages = [1, 2, 3, 4, 5, '...', total];
        } else if (current >= total - 3) {
            pages = [1, '...', total - 4, total - 3, total - 2, total - 1, total];
        } else {
            pages = [1, '...', current - 1, current, current + 1, '...', total];
        }
    }

    return pages.map(page => {
        if (page === '...') {
            return '<span class="page-ellipsis">...</span>';
        } else {
            const isActive = page === current ? 'active' : '';
            return `<span class="page-number ${isActive}" onclick="loadTeamwiseStats(${page})">${page}</span>`;
        }
    }).join('');
}

function showTeamStatsError() {
    const tbody = document.getElementById('team-stats-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell" style="color: #ef4444;">Error loading team data</td></tr>';
    
    const paginationContainer = document.getElementById('team-stats-pagination');
    paginationContainer.style.display = 'none';
}

function updateKPICards(data) {
    // Update Total Open Positions
    const totalOpenPositions = document.getElementById('total-open-positions');
    totalOpenPositions.innerHTML = formatNumber(data.Total_Open_Positions || 0);

    // Update Total Candidates in Pipeline
    const totalCandidates = document.getElementById('total-candidates');
    totalCandidates.innerHTML = formatNumber(data.Total_Candidates_In_Pipeline || 0);

    // Update Average Time to Fill
    const avgTimeFill = document.getElementById('avg-time-fill');
    const avgDays = data.Avg_Time_To_Fill_Days;
    if (avgDays !== null && avgDays !== undefined) {
        avgTimeFill.innerHTML = `${Math.round(avgDays)} <span style="font-size: 0.5em; color: #6b7280;">days</span>`;
    } else {
        avgTimeFill.innerHTML = '<span style="font-size: 0.6em; color: #9ca3af;">No data</span>';
    }

    // Update Offer Acceptance Rate
    const offerAcceptanceRate = document.getElementById('offer-acceptance-rate');
    const acceptanceRate = data.Offer_Acceptance_Rate_Percent;
    if (acceptanceRate !== null && acceptanceRate !== undefined) {
        offerAcceptanceRate.innerHTML = `${Math.round(acceptanceRate)}<span style="font-size: 0.5em; color: #6b7280;">%</span>`;
    } else {
        offerAcceptanceRate.innerHTML = '<span style="font-size: 0.6em; color: #9ca3af;">No data</span>';
    }

    // Add subtle animation to the updated values
    animateValueUpdate();
}

function formatNumber(num) {
    if (num === null || num === undefined) {
        return '<span style="font-size: 0.6em; color: #9ca3af;">No data</span>';
    }
    
    // Format large numbers with commas
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function animateValueUpdate() {
    const kpiValues = document.querySelectorAll('.kpi-value');
    kpiValues.forEach(value => {
        value.style.transform = 'scale(1.05)';
        value.style.transition = 'transform 0.3s ease';
        
        setTimeout(() => {
            value.style.transform = 'scale(1)';
        }, 300);
    });
}

function showErrorState() {
    const kpiValues = document.querySelectorAll('.kpi-value');
    kpiValues.forEach(value => {
        value.innerHTML = '<span style="font-size: 0.6em; color: #ef4444;">Error loading</span>';
    });
}

// Refresh data every 5 minutes
setInterval(loadAdminDashboardData, 300000);

// Chart.js instance
let currentCustomersChart = null;

// Load Current Customers Chart
function loadCurrentCustomersChart() {
    fetch('/api/admin-dashboard-data/current-customers/', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            createCurrentCustomersChart(data.data);
        } else {
            showChartError('Failed to load customer data');
        }
    })
    .catch(error => {
        console.error('Error fetching current customers data:', error);
        showChartError('Error loading customer data');
    });
}

function createCurrentCustomersChart(customers) {
    const chartLoading = document.getElementById('chart-loading');
    const chartNoData = document.getElementById('chart-no-data');
    const canvas = document.getElementById('currentCustomersChart');
    
    // Hide loading state
    chartLoading.style.display = 'none';
    
    if (!customers || customers.length === 0) {
        chartNoData.style.display = 'flex';
        canvas.style.display = 'none';
        return;
    }
    
    // Show canvas and hide no-data message
    canvas.style.display = 'block';
    chartNoData.style.display = 'none';
    
    // Destroy existing chart if it exists
    if (currentCustomersChart) {
        currentCustomersChart.destroy();
    }
    
    // Prepare data for the chart
    const labels = customers.map(customer => customer.company_name);
    const data = customers.map(customer => customer.JDs_Added_This_Month);
    
    // Get canvas context
    const ctx = canvas.getContext('2d');
    
    // Create dynamic colors for pie chart
    const colors = [
        '#5661d2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
        '#14b8a6', '#eab308', '#dc2626', '#7c3aed', '#0ea5e9'
    ];
    
    const backgroundColors = data.map((_, index) => colors[index % colors.length]);
    const borderColors = backgroundColors.map(color => color);
    
    // Chart configuration
    const config = {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'JDs Added',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'New Customers - JDs Distribution This Month',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: '#374151',
                    padding: {
                        bottom: 20
                    }
                },
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 12
                        },
                        color: '#374151',
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    
                                    return {
                                        text: `${label} (${value} JDs - ${percentage}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].borderColor[i],
                                        lineWidth: data.datasets[0].borderWidth,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#5661d2',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `JDs: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false
            }
        }
    };
    
    // Create the chart
    currentCustomersChart = new Chart(ctx, config);
}

function showChartError(message) {
    const chartLoading = document.getElementById('chart-loading');
    const chartNoData = document.getElementById('chart-no-data');
    const canvas = document.getElementById('currentCustomersChart');
    
    chartLoading.style.display = 'none';
    canvas.style.display = 'none';
    
    // Update no-data message to show error
    chartNoData.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
    `;
    chartNoData.style.display = 'flex';
}

// Recruitment Funnel Chart
let recruitmentFunnelChart = null;

// Load Recruitment Funnel Chart
function loadRecruitmentFunnelChart() {
    fetch('/api/admin-dashboard-data/recruitment_funnel/', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Raw funnel data:', data.data); // Debug log
            createRecruitmentFunnelChart(data.data);
        } else {
            showFunnelChartError('Failed to load funnel data');
        }
    })
    .catch(error => {
        console.error('Error fetching recruitment funnel data:', error);
        showFunnelChartError('Error loading funnel data');
    });
}

function createRecruitmentFunnelChart(funnelData) {
    const chartLoading = document.getElementById('funnel-chart-loading');
    const chartNoData = document.getElementById('funnel-chart-no-data');
    const canvas = document.getElementById('recruitmentFunnelChart');
    
    // Hide loading state
    chartLoading.style.display = 'none';
    
    console.log('Raw funnel data:', funnelData); // Debug log
    
    if (!funnelData || funnelData.length === 0) {
        chartNoData.style.display = 'flex';
        canvas.style.display = 'none';
        return;
    }
    
    // Show canvas and hide no-data message
    canvas.style.display = 'block';
    chartNoData.style.display = 'none';
    
    // Destroy existing chart if it exists
    if (recruitmentFunnelChart) {
        recruitmentFunnelChart.destroy();
    }
    
    // Calculate totals for funnel stages
    const totals = funnelData.reduce((acc, jd) => {
        acc.total_sourced += parseInt(jd.Total_Sourced) || 0;
        acc.screened_selected += parseInt(jd.Screened_Selected) || 0;
        acc.l1_selected += parseInt(jd.L1_Selected) || 0;
        acc.l2_selected += parseInt(jd.L2_Selected) || 0;
        acc.l3_selected += parseInt(jd.L3_Selected) || 0;
        acc.offer_released += parseInt(jd.Offer_Released) || 0;
        acc.offer_accepted += parseInt(jd.Offer_Accepted) || 0;
        acc.joined += parseInt(jd.Joined) || 0;
        return acc;
    }, {
        total_sourced: 0,
        screened_selected: 0,
        l1_selected: 0,
        l2_selected: 0,
        l3_selected: 0,
        offer_released: 0,
        offer_accepted: 0,
        joined: 0
    });
    
    console.log('Funnel totals:', totals); // Debug log
    
    // Get canvas context
    const ctx = canvas.getContext('2d');
    
    // Prepare funnel data
    const labels = [
        'Total Sourced',
        'Screened Selected', 
        'L1 Selected',
        'L2 Selected',
        'L3 Selected',
        'Offer Released',
        'Offer Accepted',
        'Joined'
    ];
    
    const data = [
        totals.total_sourced,
        totals.screened_selected,
        totals.l1_selected,
        totals.l2_selected,
        totals.l3_selected,
        totals.offer_released,
        totals.offer_accepted,
        totals.joined
    ];
    
    // Create gradient colors for funnel effect
    const colors = [
        '#5661d2', '#4f46e5', '#4338ca', '#3730a3',
        '#312e81', '#1e1b4b', '#1e3a8a', '#1e40af'
    ];
    
    // Chart configuration
    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Candidates',
                data: data,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Recruitment Funnel - Overall Pipeline',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: '#374151',
                    padding: {
                        bottom: 20
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#5661d2',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            const value = parseInt(context.parsed.x) || 0;
                            const total = parseInt(data[0]) || 1; // Total sourced as base
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                            return `Candidates: ${value.toLocaleString()} (${percentage}% of sourced)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 12
                        },
                        callback: function(value) {
                            return parseInt(value).toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(107, 114, 128, 0.1)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Number of Candidates',
                        color: '#374151',
                        font: {
                            size: 13,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 1200,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    };
    
    // Create the chart
    recruitmentFunnelChart = new Chart(ctx, config);
}

function showFunnelChartError(message) {
    const chartLoading = document.getElementById('funnel-chart-loading');
    const chartNoData = document.getElementById('funnel-chart-no-data');
    const canvas = document.getElementById('recruitmentFunnelChart');
    
    chartLoading.style.display = 'none';
    canvas.style.display = 'none';
    
    // Update no-data message to show error
    chartNoData.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
    `;
    chartNoData.style.display = 'flex';
}