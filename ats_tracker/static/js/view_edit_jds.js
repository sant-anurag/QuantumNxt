// ats_tracker/static/js/view_edit_jds.js
document.addEventListener("DOMContentLoaded", function() {
    const page_container = document.querySelector(".jd-main");
    const user_role = page_container.getAttribute("data-user-role");
    console.log("User Role:", user_role);

    // Initialize Quill editor (make it globally accessible)
    window.quill = null;
    
    // Elements
    const tableBody = document.getElementById("jd-table-body");
    const cardList = document.getElementById("jd-card-view");
    const tablePagination = document.getElementById("jd-table-pagination");
    const cardPagination = document.getElementById("jd-card-pagination");
    const searchInput = document.getElementById("jd-search");
    const searchBtn = document.getElementById("jd-search-btn");
    const toggleViewBtn = document.getElementById("toggle-view");
    const toggleLabel = document.getElementById("toggle-view-label");

    // Modal logic
    const modalOverlay = document.getElementById("jd-modal-overlay");
    const closeModalBtn = document.getElementById("jd-close-modal");
    const jdEditForm = document.getElementById("jd-edit-form");
    const closeBtn = document.getElementById("jd-close-btn");
    cards_per_page = 6;
    table_rows_per_page = 10;

    // Initialize empty JDs array - will be filled from API
    let allJDs = [];
    
    // Function to fetch all JDs from the API
    async function fetchAllJDs() {
        try {
            // Show loading indicator
            tableBody.innerHTML = '<tr><td colspan="8" class="jd-loading">Loading JDs...</td></tr>';
            
            const response = await fetch('/get_jds/');
            const data = await response.json();
            
            if (data.jds && Array.isArray(data.jds)) {
                allJDs = data.jds.map(jd => ({
                    jd_id: jd.jd_id || '',
                    jd_summary: jd.jd_summary || '',
                    jd_status: jd.jd_status || '',
                    no_of_positions: jd.no_of_positions || 0,
                    company_name: jd.company_name || '', // Note: API returns company_name as company_id
                    team_name: jd.team_name || '',       // Note: API returns team_name as team_id
                    company_id: jd.company_id || '',
                    team_id: jd.team_id || '',
                    // Metrics fields
                    total_profiles: jd.total_profiles || 0,
                    profiles_in_progress: jd.profiles_in_progress || 0,
                    profiles_completed: jd.profiles_completed || 0,
                    profiles_on_hold: jd.profiles_on_hold || 0,
                    profiles_selected: jd.profiles_selected || 0,
                    profiles_rejected: jd.profiles_rejected || 0,
                    // Additional fields
                    location: jd.location || '',
                    experience_required: jd.experience_required || '',
                    jd_description: jd.jd_description || '',
                    must_have_skills: jd.must_have_skills || '',
                    good_to_have_skills: jd.good_to_have_skills || '',
                    budget_ctc: jd.budget_ctc || '',
                    education_required: jd.education_required || '',
                    closure_date: jd.closure_date || ''
                }));
                return allJDs;
            } else {
                console.error("Invalid response format from get_jds API:", data);
                return [];
            }
        } catch (error) {
            console.error("Error fetching JDs:", error);
            tableBody.innerHTML = '<tr><td colspan="8" class="jd-no-data">Error loading JDs. Please try again.</td></tr>';
            return [];
        }
    }

    function renderCards(jds) {
        // Create a container for the cards with responsive grid styling
        // 1 card per row on small screens, 2 cards on medium screens, 3 cards on large screens
        const cardContainer = document.createElement("div");
        cardContainer.id = "job-cards-container";
        cardContainer.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-10";
        
        // Clear the card list and add the container
        cardList.innerHTML = "";
        cardList.appendChild(cardContainer);
        
        if (jds.length === 0) {
            cardContainer.innerHTML = `<div class="jd-no-data">No JDs found.</div>`;
            return;
        }
        
        jds.forEach(jd => {
            // Set defaults for missing data
            const statusClass = getStatusClass(jd.jd_status);
            // Default metrics (these would come from the backend in a real implementation)
            const metrics = {
                total_profiles: jd.total_profiles || 0,
                profiles_in_progress: jd.profiles_in_progress || 0,
                profiles_completed: jd.profiles_completed || 0,
                profiles_on_hold: jd.profiles_on_hold || 0,
                profiles_selected: jd.profiles_selected || 0,
                profiles_rejected: jd.profiles_rejected || 0
            };
            
            // Calculate progress width (% of profiles in progress)
            let progressWidth = 0;
            if (metrics.total_profiles > 0) {
                progressWidth = Math.round((metrics.profiles_completed / metrics.total_profiles) * 100);
            }
            
            // Calculate selection rate (% of profiles completed that were selected)
            let selectionRate = 0;
            if (metrics.profiles_completed > 0) {
                selectionRate = Math.round((metrics.profiles_selected / metrics.profiles_completed) * 100);
            }
            
            const card = document.createElement("div");
            card.className = "job-card bg-white p-6 rounded-xl border border-gray-100 flex flex-col justify-between";
            card.innerHTML = `
                <div>
                    <!-- Header -->
                    <div class="flex justify-between items-start mb-4">
                        <div style="width: 70%;">
                            <div class="tooltip-container">
                                <h2 class="text-xl font-bold text-gray-800 hover:text-indigo-600 transition duration-150 text-ellipsis" title="${jd.jd_summary}">${jd.jd_summary}</h2>
                                <span class="tooltip-text">${jd.jd_summary}</span>
                            </div>
                            <p class="text-sm text-gray-500 font-medium text-ellipsis" title="${jd.jd_id}">${jd.jd_id}</p>
                        </div>
                       
                        <div class="flex-shrink-0 flex flex-col items-end">
                            <span class="px-3 py-1 text-xs font-semibold rounded-full ${statusClass}">
                                ${capitalizeFirstLetter(jd.jd_status)}
                            </span>

                        </div>
                    </div>

                    <div class="flex justify-between items-center w-full mt-2 mb-2">
                        <div class="tooltip-container" style="max-width: 48%;">
                            <p class="text-sm text-gray-600 font-medium text-ellipsis" title="${jd.company_name || 'N/A'}"><strong>Company:</strong> ${jd.company_name || 'N/A'}</p>
                            <span class="tooltip-text">${jd.company_name || 'N/A'}</span>
                        </div>
                        <div class="tooltip-container" style="max-width: 48%;">
                            <p class="text-sm text-gray-600 font-medium text-ellipsis text-right"}"><strong>Team:</strong> ${jd.team_name || 'N/A'}</p>
                            <span class="tooltip-text">${jd.team_name || 'N/A'}</span>
                        </div>
                    </div>

                    <!-- Key Metrics Grid -->
                    <div class="grid grid-cols-2 gap-4 text-center mt-4 border-t border-b py-4 mb-4">
                        <div class="border-r">
                            <p class="text-2xl font-extrabold text-indigo-600">${jd.no_of_positions}</p>
                            <p class="text-xs text-gray-500 uppercase font-medium">Positions</p>
                        </div>
                        <div>
                            <p class="text-2xl font-extrabold text-gray-800">${metrics.total_profiles}</p>
                            <p class="text-xs text-gray-500 uppercase font-medium">Total Profiles</p>
                        </div>
                    </div>

                    <!-- Status Breakdown & Progress -->
                    <div class="space-y-3">
                        <div class="flex justify-between text-sm text-gray-600">
                            <span class="font-medium text-blue-600">In Progress: ${metrics.profiles_in_progress}</span>
                            <span>Completed: ${metrics.profiles_completed}</span>
                            <span class="text-yellow-600">On Hold: ${metrics.profiles_on_hold}</span>
                        </div>
                        
                        <!-- Simple Progress Bar for Flow -->
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                            <div class="bg-blue-500 h-2.5 rounded-full" style="width: ${progressWidth}%;" title="${progressWidth}% of total profiles are In Progress"></div>
                        </div>
                        <p class="text-xs text-gray-500 text-right mt-1">Completion Rate: <span class="font-semibold">${selectionRate}%</span></p>

                        <!-- Selection/Rejection Summary -->
                        <div class="flex justify-between text-xs pt-2 border-t border-gray-100">
                            <p class="flex items-center text-green-600 font-medium">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                Selected: ${metrics.profiles_selected}
                            </p>
                            <p class="flex items-center text-red-600 font-medium">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                Rejected: ${metrics.profiles_rejected}
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Footer and Actions -->
                <div class="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
                    <div class="space-y-1" style="width: 50%;">
                        <div class="tooltip-container">
                            <p class="flex items-center text-ellipsis">
                                <svg class="w-4 h-4 mr-1 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                <span class="text-ellipsis" style="display: inline-block; max-width: calc(100% - 20px);" title="${jd.location || 'Location not specified'}">${jd.location || 'Location not specified'}</span>
                            </p>
                            <span class="tooltip-text">${jd.location || 'Location not specified'}</span>
                        </div>
                        <div class="tooltip-container">
                            <p class="flex items-center text-ellipsis">
                                <svg class="w-4 h-4 mr-1 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span class="text-ellipsis" style="display: inline-block; max-width: calc(100% - 20px);" title="${jd.experience_required || 'Experience not specified'}">${jd.experience_required || 'Experience not specified'}</span>
                            </p>
                            <span class="tooltip-text">${jd.experience_required || 'Experience not specified'}</span>
                        </div>
                    </div>
                    
                    
                    <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                        <button class="jd-btn-view bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2 px-3 rounded-lg shadow-md transition duration-150" data-jd="${jd.jd_id}" title="View JD">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="jd-btn-edit bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold py-2 px-3 rounded-lg shadow-md transition duration-150" data-jd="${jd.jd_id}" title="Edit JD">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            `;
            cardContainer.appendChild(card);
        });
    }
    
    // Helper function to get status class based on JD status
    function getStatusClass(status) {
        status = status.toLowerCase();
        if (status === 'active') return 'bg-green-100 text-green-800';
        if (status === 'closed') return 'bg-red-100 text-red-800';
        if (status === 'on hold') return 'bg-yellow-100 text-yellow-800';
        return 'bg-gray-100 text-gray-800';
    }
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function renderTable(jds, page = 1, perPage = 10) {
        tableBody.innerHTML = "";
        if (jds.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="jd-no-data">No JDs found.</td></tr>`;
            tablePagination.innerHTML = "";
            return;
        }
        const totalPages = Math.ceil(jds.length / perPage);
        const start = (page - 1) * perPage;
        const end = start + perPage;
        
        // Update showing results text for pagination
        const resultsCounter = document.getElementById('showing-results');
        if (resultsCounter) {
            const firstItem = start + 1;
            const lastItem = Math.min(end, jds.length);
            resultsCounter.textContent = `Showing ${firstItem}-${lastItem} of ${jds.length} JDs`;
        }
        
        jds.slice(start, end).forEach(jd => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="">
                    <span class="text-ellipsis" style="max-width: 100px; display: inline-block;" title="${jd.jd_id}">${jd.jd_id}</span>
                    <span class="tooltip-text">${jd.jd_id}</span>
                </td>
                <td class="">
                    <span class="text-ellipsis" style="max-width: 200px; display: inline-block;" title="${jd.jd_summary}">${jd.jd_summary}</span>
                    <span class="tooltip-text">${jd.jd_summary}</span>
                </td>
                <td>${capitalizeFirstLetter(jd.jd_status)}</td>
                <td>${jd.no_of_positions}</td>
                <td class="">
                    <span class="text-ellipsis" style="max-width: 150px; display: inline-block;" title="${jd.company_name}">${jd.company_name}</span>
                    <span class="tooltip-text">${jd.company_name}</span>
                </td>
                <td class="">
                    <span class="text-ellipsis" style="max-width: 150px; display: inline-block;" title="${jd.team_name || ''}">${jd.team_name || 'N/A'}</span>
                    <span class="tooltip-text">${jd.team_name || ''}</span>
                </td>
                <td>${jd.closure_date || 'N/A'}</td>
                <td>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <button class="jd-btn-view" data-jd="${jd.jd_id}" title="View JD"><i class="fas fa-eye"></i></button>
                        <button class="jd-btn-edit" data-jd="${jd.jd_id}" title="Edit JD"><i class="fas fa-edit"></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        
        // Generate pagination controls
        let pagHtml = "";
        if (totalPages > 1) {
            // Add Previous button
            const prevDisabled = page === 1 ? 'disabled' : '';
            pagHtml += `<button type="button" ${prevDisabled} data-page="${page-1}" class="page-nav">&laquo; Prev</button>`;
            
            // Add page numbers (with ellipsis for large number of pages)
            const maxVisiblePages = 5; // Maximum number of page buttons to show
            
            if (totalPages <= maxVisiblePages) {
                // Show all pages if 5 or fewer
                for (let i = 1; i <= totalPages; i++) {
                    pagHtml += `<button type="button" class="${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
                }
            } else {
                // Show limited pages with ellipsis
                const startPage = Math.max(1, Math.min(page - Math.floor(maxVisiblePages / 2), totalPages - maxVisiblePages + 1));
                const endPage = Math.min(startPage + maxVisiblePages - 1, totalPages);
                
                // First page
                if (startPage > 1) {
                    pagHtml += `<button type="button" data-page="1">1</button>`;
                    if (startPage > 2) pagHtml += `<span class="pagination-ellipsis">...</span>`;
                }
                
                // Pages in the middle
                for (let i = startPage; i <= endPage; i++) {
                    pagHtml += `<button type="button" class="${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
                }
                
                // Last page
                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) pagHtml += `<span class="pagination-ellipsis">...</span>`;
                    pagHtml += `<button type="button" data-page="${totalPages}">${totalPages}</button>`;
                }
            }
            
            // Add Next button
            const nextDisabled = page === totalPages ? 'disabled' : '';
            pagHtml += `<button type="button" ${nextDisabled} data-page="${page+1}" class="page-nav">Next &raquo;</button>`;
        }
        
        tablePagination.innerHTML = pagHtml;
        tablePagination.querySelectorAll("button").forEach(btn => {
            btn.onclick = function() {
                if (!this.hasAttribute('disabled')) {
                    renderTable(jds, parseInt(this.getAttribute("data-page")), perPage);
                }
            };
        });
    }

    function renderCardPaginated(jds, page = 1, perPage = 4) {
        cardList.innerHTML = "";
        if (jds.length === 0) {
            cardList.innerHTML = `<div class="jd-no-data">No JDs found.</div>`;
            cardPagination.innerHTML = "";
            return;
        }
        const totalPages = Math.ceil(jds.length / perPage);
        const start = (page - 1) * perPage;
        const end = start + perPage;
        
        // Update showing results text for pagination
        const resultsCounter = document.getElementById('showing-results');
        if (resultsCounter) {
            const firstItem = start + 1;
            const lastItem = Math.min(end, jds.length);
            resultsCounter.textContent = `Showing ${firstItem}-${lastItem} of ${jds.length} JDs`;
        }
        
        renderCards(jds.slice(start, end));
        
        // Generate pagination controls
        let pagHtml = "";
        if (totalPages > 1) {
            // Add Previous button
            const prevDisabled = page === 1 ? 'disabled' : '';
            pagHtml += `<button type="button" ${prevDisabled} data-page="${page-1}" class="page-nav">&laquo; Prev</button>`;
            
            // Add page numbers (with ellipsis for large number of pages)
            const maxVisiblePages = 5; // Maximum number of page buttons to show
            
            if (totalPages <= maxVisiblePages) {
                // Show all pages if 5 or fewer
                for (let i = 1; i <= totalPages; i++) {
                    pagHtml += `<button type="button" class="${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
                }
            } else {
                // Show limited pages with ellipsis
                const startPage = Math.max(1, Math.min(page - Math.floor(maxVisiblePages / 2), totalPages - maxVisiblePages + 1));
                const endPage = Math.min(startPage + maxVisiblePages - 1, totalPages);
                
                // First page
                if (startPage > 1) {
                    pagHtml += `<button type="button" data-page="1">1</button>`;
                    if (startPage > 2) pagHtml += `<span class="pagination-ellipsis">...</span>`;
                }
                
                // Pages in the middle
                for (let i = startPage; i <= endPage; i++) {
                    pagHtml += `<button type="button" class="${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
                }
                
                // Last page
                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) pagHtml += `<span class="pagination-ellipsis">...</span>`;
                    pagHtml += `<button type="button" data-page="${totalPages}">${totalPages}</button>`;
                }
            }
            
            // Add Next button
            const nextDisabled = page === totalPages ? 'disabled' : '';
            pagHtml += `<button type="button" ${nextDisabled} data-page="${page+1}" class="page-nav">Next &raquo;</button>`;
        }
        
        cardPagination.innerHTML = pagHtml;
        cardPagination.style.display = totalPages > 1 ? "flex" : "none";
        cardPagination.querySelectorAll("button").forEach(btn => {
            btn.onclick = function() {
                if (!this.hasAttribute('disabled')) {
                    renderCardPaginated(jds, parseInt(this.getAttribute("data-page")), perPage);
                }
            };
        });
    }

    function filterJDs(term) {
        term = term.trim().toLowerCase();
        if (!term) return allJDs;
        return allJDs.filter(jd =>
            (jd.jd_id && jd.jd_id.toLowerCase().includes(term)) ||
            (jd.team_name && jd.team_name.toLowerCase().includes(term)) ||
            (jd.jd_summary && jd.jd_summary.toLowerCase().includes(term)) ||
            (jd.company_name && jd.company_name.toLowerCase().includes(term))
        );
    }

    function updateView() {
        const term = searchInput.value;
        const filtered = filterJDs(term);
        
        // Update the showing results count
        const resultsCounter = document.getElementById('showing-results');
        if (resultsCounter) {
            resultsCounter.textContent = `Showing ${filtered.length} of ${allJDs.length} JDs`;
        }
        
        if (cardList.style.display === "none") {
            renderTable(filtered, 1, table_rows_per_page);
        } else {
            renderCardPaginated(filtered, 1, cards_per_page);
        }
    }

    // Initial data fetch and render
    (async function initialLoad() {
        try {
            const jds = await fetchAllJDs();
            
            // Update the showing results count
            const resultsCounter = document.getElementById('showing-results');
            if (resultsCounter) {
                resultsCounter.textContent = `Showing ${jds.length} of ${jds.length} JDs`;
            }
            
            renderTable(jds, 1, table_rows_per_page);
        } catch (error) {
            console.error("Error during initial load:", error);
            tableBody.innerHTML = '<tr><td colspan="8" class="jd-no-data">Error loading JDs. Please try again.</td></tr>';
            
            const resultsCounter = document.getElementById('showing-results');
            if (resultsCounter) {
                resultsCounter.textContent = 'Error loading JDs';
            }
        }
    })();

    searchInput.addEventListener("input", updateView);
    searchBtn.addEventListener("click", updateView);

    toggleViewBtn.addEventListener("click", function() {
        // Get current filtered JDs
        const filtered = filterJDs(searchInput.value);
        
        // Update the showing results count
        const resultsCounter = document.getElementById('showing-results');
        if (resultsCounter) {
            resultsCounter.textContent = `Showing ${filtered.length} of ${allJDs.length} JDs`;
        }
        
        if (cardList.style.display === "none") {
            // Switch to card view
            cardList.innerHTML = '<div class="jd-loading">Loading card view...</div>';
            cardList.style.display = "block"; // Changed from "flex" to "block" to maintain proper grid layout
            document.getElementById("jd-table-view").style.display = "none";
            toggleLabel.textContent = "Table";
            toggleViewBtn.querySelector("i").className = "fas fa-table";
            
            // Use already loaded JD data for cards
            renderCardPaginated(filtered, 1, cards_per_page);
            tablePagination.style.display = "none";
        } else {
            // Switch to table view
            cardList.style.display = "none";
            document.getElementById("jd-table-view").style.display = "block";
            toggleLabel.textContent = "Cards";
            toggleViewBtn.querySelector("i").className = "fas fa-th-large";
            renderTable(filtered, 1, table_rows_per_page);
            cardPagination.style.display = "none";
            tablePagination.style.display = "flex";
        }
    });

    // For non-admins, all fields are always disabled (except close button)
    function setModalFieldsDisabled(disabled) {
        jdEditForm.querySelectorAll("input, textarea, select").forEach(el => {
            if (el.id === "jd_id") {
                el.readOnly = true;
                el.disabled = true;
            } else {
                el.disabled = true; // always disabled for non-admins
            }
        });
        
        // Handle Quill editor (always disabled for non-admins)
        if (window.quill) {
            window.quill.enable(false);
        }
    }

    function showModalLoading() {
        // Create a loading overlay for the modal
        modalOverlay.style.display = "flex";
        const modalContent = document.querySelector(".jd-modal-content");
        const loadingHTML = `
            <div id="modal-loading" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; z-index: 10;">
                <div class="jd-loading">Loading JD details...</div>
            </div>
        `;
        modalContent.insertAdjacentHTML('afterbegin', loadingHTML);
        
        // Show form but keep it disabled during loading
        jdEditForm.querySelectorAll("input, textarea, select").forEach(el => {
            el.disabled = true;
        });
    }
    
    function hideModalLoading() {
        const loadingElement = document.getElementById("modal-loading");
        if (loadingElement) {
            loadingElement.remove();
        }
    }
    
    function showModal(jd) {
        document.getElementById("jd_id").value = jd.jd_id || "";
        document.getElementById("jd_summary").value = jd.jd_summary || "";
        document.getElementById("must_have_skills").value = jd.must_have_skills || "";
        document.getElementById("good_to_have_skills").value = jd.good_to_have_skills || "";
        document.getElementById("experience").value = jd.experience_required || "";
        document.getElementById("education").value = jd.education_required || "";
        document.getElementById("budget_ctc").value = jd.budget_ctc || "";
        document.getElementById("location").value = jd.location || "";
        document.getElementById("no_of_positions").value = jd.no_of_positions || "";
        document.getElementById("jd_status").value = jd.jd_status || "active";
        document.getElementById("company_id").value = jd.company_id || "";
        document.getElementById("team_id").value = jd.team_id || "";
        document.getElementById("closure_date").value = jd.closure_date || "";
        
        // Initialize Quill editor if not already initialized
        if (!window.quill) {
            window.quill = new Quill('#jd_description_editor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                        [{ 'color': [] }, { 'background': [] }],
                        ['link'],
                        ['clean']
                    ],
                    clipboard: {
                        matchVisual: false
                    }
                },
            });

            // Handle paste events to preserve line breaks
            window.quill.clipboard.addMatcher(Node.TEXT_NODE, function(node, delta) {
                if (typeof node.data === 'string') {
                    const lines = node.data.split('\n');
                    const newOps = [];
                    
                    lines.forEach((line, index) => {
                        if (index > 0) {
                            newOps.push({ insert: '\n' });
                        }
                        if (line.trim()) {
                            newOps.push({ insert: line });
                        }
                    });
                    
                    return { ops: newOps };
                }
                return delta;
            });

            window.quill.clipboard.addMatcher('p', function(node, delta) {
                delta.ops.push({ insert: '\n' });
                return delta;
            });
            
            // Update hidden input when Quill content changes
            window.quill.on('text-change', function() {
                document.getElementById("jd_description").value = window.quill.root.innerHTML;
            });

            // Format button functionality for modal
            const formatBtnModal = document.getElementById('formatTextBtnModal');
            if (formatBtnModal) {
                formatBtnModal.addEventListener('click', function() {
                    const currentText = window.quill.getText();
                    if (currentText.trim()) {
                        window.quill.setContents([]);
                        
                        const paragraphs = currentText.split(/\n\s*\n/);
                        
                        paragraphs.forEach((paragraph, index) => {
                            if (paragraph.trim()) {
                                const lines = paragraph.split('\n');
                                lines.forEach((line, lineIndex) => {
                                    if (line.trim()) {
                                        window.quill.insertText(window.quill.getLength(), line.trim());
                                        if (lineIndex < lines.length - 1) {
                                            window.quill.insertText(window.quill.getLength(), '\n');
                                        }
                                    }
                                });
                                
                                if (index < paragraphs.length - 1) {
                                    window.quill.insertText(window.quill.getLength(), '\n\n');
                                }
                            }
                        });
                        
                        document.getElementById("jd_description").value = window.quill.root.innerHTML;
                        
                        formatBtnModal.textContent = '✅ Formatted!';
                        formatBtnModal.style.backgroundColor = '#28a745';
                        setTimeout(() => {
                            formatBtnModal.textContent = '📝 Format Pasted Text (Convert Line Breaks)';
                            formatBtnModal.style.backgroundColor = '#6c757d';
                        }, 2000);
                    } else {
                        alert('Please paste some text first, then click this button to format it.');
                    }
                });
            }
        }
        
        // Set Quill content from JD description
        window.quill.root.innerHTML = jd.jd_description || "";
        document.getElementById("jd_description").value = jd.jd_description || "";
        
        // Hide loading indicator if it exists
        hideModalLoading();
        
        // Set fields to disabled based on user role
        setModalFieldsDisabled(true);
        
        // Ensure modal is displayed
        modalOverlay.style.display = "flex";
    }

    async function fetchJDDetailsForView(jd_id) {
        try {
            const response = await fetch(`/get_jd/${jd_id}/`);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log("Fetched JD details for view:", data);
            if (data.jd) {
                showPDFModal(data.jd);
            } else {
                alert("JD details not found or invalid data format.");
                console.error("Invalid JD data format:", data);
            }
        } catch (error) {
            console.error("Error fetching JD details for view:", error);
            alert("Failed to load JD details. Please try again.");
        }
    }

    async function fetchJDDetails(jd_id) {
        // Show modal with loading indicator
        showModalLoading();
        
        try {
            const response = await fetch(`/get_jd/${jd_id}/`);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log("Fetched JD details:", data);
            if (data.jd) {
                showModal(data.jd);
            } else {
                hideModalLoading();
                modalOverlay.style.display = "none";
                alert("JD details not found or invalid data format.");
                console.error("Invalid JD data format:", data);
            }
        } catch (error) {
            console.error("Error fetching JD details:", error);
            hideModalLoading();
            modalOverlay.style.display = "none";
            alert("Failed to load JD details. Please try again.");
        }
    }

    // Delegate click for all view and edit buttons (table and card)
    document.addEventListener("click", function(e) {
        // View button - opens PDF-style view modal directly
        if (e.target.classList.contains("jd-btn-view") || (e.target.parentElement && e.target.parentElement.classList.contains("jd-btn-view"))) {
            const btn = e.target.classList.contains("jd-btn-view") ? e.target : e.target.parentElement;
            const jd_id = btn.getAttribute("data-jd");
            
            // Fetch JD details and show PDF modal directly
            fetchJDDetailsForView(jd_id);
        }
        
        // Edit button - opens edit modal
        if (e.target.classList.contains("jd-btn-edit") || (e.target.parentElement && e.target.parentElement.classList.contains("jd-btn-edit"))) {
            const btn = e.target.classList.contains("jd-btn-edit") ? e.target : e.target.parentElement;
            const jd_id = btn.getAttribute("data-jd");
            fetchJDDetails(jd_id);
        }
        
        // Close modal
        if (e.target === closeModalBtn || e.target === closeBtn) {
            modalOverlay.style.display = "none";
        }
    });

    // Close modal when clicking outside content
    modalOverlay.onclick = function(event) {
        if (event.target === modalOverlay) {
            modalOverlay.style.display = "none";
        }
    };

    // PDF-Style View Modal Functions
    function showPDFModal(jd) {
        const pdfModalOverlay = document.getElementById("jd-view-modal-overlay");
        
        // Populate PDF modal with JD data
        document.getElementById("view-jd-summary").textContent = jd.jd_summary || "No summary available";
        document.getElementById("view-jd-id").textContent = jd.jd_id || "";
        document.getElementById("view-company").textContent = jd.company_name || "N/A";
        document.getElementById("view-team").textContent = jd.team_name || "N/A";
        document.getElementById("view-location").textContent = jd.location || "N/A";
        document.getElementById("view-positions").textContent = jd.no_of_positions || "N/A";
        document.getElementById("view-experience").textContent = jd.experience_required || "N/A";
        document.getElementById("view-education").textContent = jd.education_required || "N/A";
        document.getElementById("view-budget").textContent = jd.budget_ctc || "N/A";
        document.getElementById("view-status").textContent = jd.jd_status ? jd.jd_status.charAt(0).toUpperCase() + jd.jd_status.slice(1) : "N/A";
        
        // Set closure date and show/hide section based on whether there's a date
        const closureSection = document.getElementById("view-closure-section");
        const closureDate = document.getElementById("view-closure-date");
        if (jd.closure_date && jd.closure_date.trim()) {
            closureDate.textContent = jd.closure_date;
            closureSection.style.display = "block";
        } else {
            closureSection.style.display = "none";
        }
        
        // Set created date (you might want to add this field to your JD data)
        const createdDateElement = document.getElementById("view-created-date");
        if (createdDateElement) {
            createdDateElement.textContent = jd.created_date || "N/A";
        }
        
        // Handle description with HTML content
        const descriptionElement = document.getElementById("view-jd-description");
        if (jd.jd_description) {
            // Remove Quill-specific classes and clean up HTML
            let cleanDescription = jd.jd_description
                .replace(/<p><br><\/p>/g, '<br>')
                .replace(/<p>/g, '')
                .replace(/<\/p>/g, '<br>')
                .replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<br><br>');
            descriptionElement.innerHTML = cleanDescription;
        } else {
            descriptionElement.textContent = "No description available.";
        }
        
        // Handle skills - convert to list format
        const mustHaveSkills = document.getElementById("view-must-have-skills");
        const goodToHaveSkills = document.getElementById("view-good-to-have-skills");
        
        if (jd.must_have_skills && jd.must_have_skills.trim()) {
            const skillsList = jd.must_have_skills.split('\n').filter(skill => skill.trim());
            if (skillsList.length > 0) {
                mustHaveSkills.innerHTML = skillsList.map(skill => `<li style="margin-bottom: 5px;">${skill.trim()}</li>`).join('');
            } else {
                mustHaveSkills.innerHTML = '<p>No specific skills mentioned</p>';
            }
        } else {
            mustHaveSkills.innerHTML = '<p>No specific skills mentioned</p>';
        }
        
        if (jd.good_to_have_skills && jd.good_to_have_skills.trim()) {
            const skillsList = jd.good_to_have_skills.split('\n').filter(skill => skill.trim());
            if (skillsList.length > 0) {
                goodToHaveSkills.innerHTML = skillsList.map(skill => `<li style="margin-bottom: 5px;">${skill.trim()}</li>`).join('');
            } else {
                goodToHaveSkills.innerHTML = '<p>No additional skills mentioned</p>';
            }
        } else {
            goodToHaveSkills.innerHTML = '<p>No additional skills mentioned</p>';
        }
        
        // Show the PDF modal
        pdfModalOverlay.style.display = "flex";
    }

    // Add event listeners for PDF view modal
    document.addEventListener("click", function(e) {
        // Close PDF modal - updated to match HTML structure
        if (e.target.id === "jd-view-close-modal" || e.target.id === "jd-view-close-btn" || e.target.classList.contains("jd-view-close-modal")) {
            document.getElementById("jd-view-modal-overlay").style.display = "none";
        }
        
        // Edit from view modal - close view modal and show edit modal
        if (e.target.id === "jd-edit-from-view-btn" || (e.target.parentElement && e.target.parentElement.id === "jd-edit-from-view-btn")) {
            document.getElementById("jd-view-modal-overlay").style.display = "none";
            // Get the current JD ID from the view modal and fetch details for edit
            const jdId = document.getElementById("view-jd-id").textContent;
            if (jdId) {
                fetchJDDetails(jdId);
            }
        }
    });

    // Close PDF modal when clicking outside content - updated to match HTML structure
    const pdfModalOverlay = document.getElementById("jd-view-modal-overlay");
    if (pdfModalOverlay) {
        pdfModalOverlay.onclick = function(event) {
            if (event.target === pdfModalOverlay) {
                pdfModalOverlay.style.display = "none";
            }
        };
    }
});