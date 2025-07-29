document.addEventListener("DOMContentLoaded", function() {
                const tableBody = document.getElementById("jd-table-body");
                const cardList = document.getElementById("jd-card-view");
                const tablePagination = document.getElementById("jd-table-pagination");
                const cardPagination = document.getElementById("jd-card-pagination");
                const searchInput = document.getElementById("jd-search");
                const searchBtn = document.getElementById("jd-search-btn");
                const toggleViewBtn = document.getElementById("toggle-view");
                const toggleLabel = document.getElementById("toggle-view-label");

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
                        created_at: cells[6].textContent.trim(),
                        row: row.cloneNode(true)
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
                        tableBody.appendChild(jd.row.cloneNode(true));
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
                        tablePagination.style.display = "flex";
                        cardPagination.style.display = "none";
                    } else {
                        renderCardPaginated(filtered, 1, 6);
                        tablePagination.style.display = "none";
                        cardPagination.style.display = "flex";
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
                        updateView();
                    } else {
                        cardList.style.display = "none";
                        document.getElementById("jd-table-view").style.display = "block";
                        toggleLabel.textContent = "Table";
                        updateView();
                    }
                });

                // Modal logic
                const modalOverlay = document.getElementById("jd-modal-overlay");
                document.addEventListener("click", function(e) {
                    if (e.target.classList.contains("jd-btn-view")) {
                        e.preventDefault();
                        modalOverlay.style.display = "flex";
                        // Fill modal fields here if needed
                    }
                    if (e.target.id === "jd-close-modal" || e.target.id === "jd-close-btn") {
                        modalOverlay.style.display = "none";
                    }
                });
                window.onclick = function(event) {
                    if (event.target === modalOverlay) {
                        modalOverlay.style.display = "none";
                    }
                };
            });