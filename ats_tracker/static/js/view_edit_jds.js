// ats_tracker/static/js/view_edit_jds.js
document.addEventListener("DOMContentLoaded", function() {
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
    const editBtn = document.getElementById("jd-edit-btn");
    const saveBtn = document.getElementById("jd-save-btn");
    const closeBtn = document.getElementById("jd-close-btn");

    // Parse JDs from table rows
    let allJDs = [];
    tableBody.querySelectorAll("tr").forEach(row => {
        if (row.querySelector(".jd-no-data")) return;
        const cells = row.children;
        allJDs.push({
            jd_id: cells[0].textContent.trim(),
            jd_summary: cells[1].textContent.trim(),
            jd_status: cells[2].textContent.trim(),
            no_of_positions: cells[3].textContent.trim(),
            company: cells[4].textContent.trim(),
            team: cells[5].textContent.trim(),
            created_at: cells[6].textContent.trim()
        });
    });

    function renderCards(jds) {
        cardList.innerHTML = "";
        if (jds.length === 0) {
            cardList.innerHTML = `<div class="jd-no-data">No JDs found.</div>`;
            return;
        }
        jds.forEach(jd => {
            const card = document.createElement("div");
            card.className = "jd-card";
            card.innerHTML = `
                <div class="jd-card-header">
                    <span class="jd-id">${jd.jd_id}</span>
                    <span class="jd-status ${jd.jd_status.toLowerCase()}">${jd.jd_status}</span>
                </div>
                <div class="jd-card-body">
                    <h3>${jd.jd_summary}</h3>
                    <p><b>Positions:</b> ${jd.no_of_positions}</p>
                    <p><b>Company:</b> ${jd.company}</p>
                    <p><b>Team:</b> ${jd.team}</p>
                    <p><b>Created:</b> ${jd.created_at}</p>
                </div>
                <div class="jd-card-actions">
                    <button class="jd-btn-view" data-jd="${jd.jd_id}"><i class="fas fa-eye"></i> View/Edit</button>
                </div>
            `;
            cardList.appendChild(card);
        });
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
        jds.slice(start, end).forEach(jd => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${jd.jd_id}</td>
                <td>${jd.jd_summary}</td>
                <td>${jd.jd_status}</td>
                <td>${jd.no_of_positions}</td>
                <td>${jd.company}</td>
                <td>${jd.team}</td>
                <td>${jd.created_at}</td>
                <td>
                    <button class="jd-btn-view" data-jd="${jd.jd_id}"><i class="fas fa-eye"></i> View/Edit</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        let pagHtml = "";
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                pagHtml += `<button type="button" class="${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
            }
        }
        tablePagination.innerHTML = pagHtml;
        tablePagination.querySelectorAll("button").forEach(btn => {
            btn.onclick = function() {
                renderTable(jds, parseInt(this.getAttribute("data-page")), perPage);
            };
        });
    }

    function renderCardPaginated(jds, page = 1, perPage = 6) {
        cardList.innerHTML = "";
        if (jds.length === 0) {
            cardList.innerHTML = `<div class="jd-no-data">No JDs found.</div>`;
            cardPagination.innerHTML = "";
            return;
        }
        const totalPages = Math.ceil(jds.length / perPage);
        const start = (page - 1) * perPage;
        const end = start + perPage;
        renderCards(jds.slice(start, end));
        let pagHtml = "";
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                pagHtml += `<button type="button" class="${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
            }
        }
        cardPagination.innerHTML = pagHtml;
        cardPagination.style.display = "flex";
        cardPagination.querySelectorAll("button").forEach(btn => {
            btn.onclick = function() {
                renderCardPaginated(jds, parseInt(this.getAttribute("data-page")), perPage);
            };
        });
    }

    function filterJDs(term) {
        term = term.trim().toLowerCase();
        if (!term) return allJDs;
        return allJDs.filter(jd =>
            jd.jd_id.toLowerCase().includes(term) ||
            jd.team.toLowerCase().includes(term) ||
            jd.jd_summary.toLowerCase().includes(term) ||
            jd.company.toLowerCase().includes(term)
        );
    }

    function updateView() {
        const term = searchInput.value;
        const filtered = filterJDs(term);
        if (cardList.style.display === "none") {
            renderTable(filtered, 1, 10);
        } else {
            renderCardPaginated(filtered, 1, 6);
        }
    }

    // Initial render
    renderTable(allJDs, 1, 10);

    searchInput.addEventListener("input", updateView);
    searchBtn.addEventListener("click", updateView);

    toggleViewBtn.addEventListener("click", function() {
        if (cardList.style.display === "none") {
            cardList.style.display = "flex";
            document.getElementById("jd-table-view").style.display = "none";
            toggleLabel.textContent = "Cards";
            renderCardPaginated(filterJDs(searchInput.value), 1, 6);
        } else {
            cardList.style.display = "none";
            document.getElementById("jd-table-view").style.display = "block";
            toggleLabel.textContent = "Table";
            renderTable(filterJDs(searchInput.value), 1, 10);
        }
    });

    function setModalFieldsDisabled(disabled) {
        jdEditForm.querySelectorAll("input, textarea, select").forEach(el => {
            if (el.id === "jd_id") {
                el.readOnly = true;
                el.disabled = true;
            } else {
                el.disabled = disabled;
            }
        });
        saveBtn.disabled = disabled;
    }

    function showModal(jd) {
        document.getElementById("jd_id").value = jd.jd_id || "";
        document.getElementById("jd_summary").value = jd.jd_summary || "";
        document.getElementById("jd_description").value = jd.jd_description || "";
        document.getElementById("must_have_skills").value = jd.must_have_skills || "";
        document.getElementById("good_to_have_skills").value = jd.good_to_have_skills || "";
        document.getElementById("experience_range").value = jd.experience_range || "";
        document.getElementById("education").value = jd.education || "";
        document.getElementById("no_of_positions").value = jd.no_of_positions || "";
        document.getElementById("jd_status").value = jd.jd_status || "active";
        document.getElementById("company_id").value = jd.company_id || "";
        document.getElementById("team_id").value = jd.team_id || "";
        document.getElementById("closure_date").value = jd.closure_date || "";
        setModalFieldsDisabled(true);
        modalOverlay.style.display = "flex";
    }

    function fetchJDDetails(jd_id) {
        fetch(`/get_jd/${jd_id}/`)
            .then(resp => resp.json())
            .then(data => {
                if (data.jd) {
                    showModal(data.jd);
                } else {
                    alert("JD not found.");
                }
            });
    }

    // Delegate click for all .jd-btn-view buttons (table and card)
    document.addEventListener("click", function(e) {
        // View/Edit button
        if (e.target.classList.contains("jd-btn-view") || (e.target.parentElement && e.target.parentElement.classList.contains("jd-btn-view"))) {
            const btn = e.target.classList.contains("jd-btn-view") ? e.target : e.target.parentElement;
            const jd_id = btn.getAttribute("data-jd");
            fetchJDDetails(jd_id);
        }
        // Close modal
        if (e.target === closeModalBtn || e.target === closeBtn) {
            modalOverlay.style.display = "none";
        }
    });

    // Edit button enables fields
    editBtn.onclick = function() {
        setModalFieldsDisabled(false);
    };

    // Save button submits changes
    jdEditForm.onsubmit = function(e) {
        e.preventDefault();
        const jd_id = document.getElementById("jd_id").value;
        const data = {
            jd_summary: document.getElementById("jd_summary").value,
            jd_description: document.getElementById("jd_description").value,
            must_have_skills: document.getElementById("must_have_skills").value,
            good_to_have_skills: document.getElementById("good_to_have_skills").value,
            experience_range: document.getElementById("experience_range").value,
            education: document.getElementById("education").value,
            no_of_positions: document.getElementById("no_of_positions").value,
            jd_status: document.getElementById("jd_status").value,
            company_id: document.getElementById("company_id").value,
            team_id: document.getElementById("team_id").value,
            closure_date: document.getElementById("closure_date").value
        };
        fetch(`/update_jd/${jd_id}/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
        .then(resp => resp.json())
        .then(res => {
            if (res.success) {
                setModalFieldsDisabled(true);
                saveBtn.disabled = true;
                alert("JD updated successfully.");
                modalOverlay.style.display = "none";
                // Optionally, refresh the page or update the JD in the table/card
                location.reload();
            } else {
                alert("Failed to update JD.");
            }
        });
    };

    // Close modal when clicking outside content
    modalOverlay.onclick = function(event) {
        if (event.target === modalOverlay) {
            modalOverlay.style.display = "none";
        }
    };
});