document.addEventListener("DOMContentLoaded", function() {
    // Disable button on submit
    const form = document.getElementById("create-team-form");
    if (form) {
        form.addEventListener("submit", function() {
            const btn = form.querySelector("button[type='submit']");
            if (btn) {
                btn.disabled = true;
                btn.textContent = "Creating...";
            }
        });
    }

    // Modal logic
    const modal = document.getElementById("team-members-modal");
    const closeModalBtn = document.getElementById("close-modal");
    document.querySelectorAll(".view-members-link").forEach(link => {
        link.addEventListener("click", function(e) {
            e.preventDefault();
            const teamId = this.getAttribute("data-team-id");
            fetch(`/team-members/${teamId}/`)
                .then(resp => resp.json())
                .then(data => {
                    const container = document.getElementById("modal-members-list");
                    if (data.members && data.members.length > 0) {
                        let html = `<table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Emp ID</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                </tr>
                            </thead>
                            <tbody>`;
                        data.members.forEach(m => {
                            html += `<tr>
                                <td>${m.first_name} ${m.last_name}</td>
                                <td>${m.emp_id}</td>
                                <td>${m.email}</td>
                                <td>${m.phone || "-"}</td>
                            </tr>`;
                        });
                        html += "</tbody></table>";
                        container.innerHTML = html;
                    } else {
                        container.innerHTML = `<div class="no-members">No members in this team.</div>`;
                    }
                    modal.style.display = "flex";
                });
        });
    });
    if (closeModalBtn) {
        closeModalBtn.onclick = function() {
            modal.style.display = "none";
        };
    }
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
});