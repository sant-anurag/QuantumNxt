// ats_tracker/static/js/view_edit_jds_admin.js
document.addEventListener("DOMContentLoaded", function() {
    // Only run if admin controls exist
    const jdEditForm = document.getElementById("jd-edit-form");
    const editBtn = document.getElementById("jd-edit-btn");
    const saveBtn = document.getElementById("jd-save-btn");
    const modalOverlay = document.getElementById("jd-modal-overlay");

    if (!jdEditForm || !editBtn || !saveBtn || !modalOverlay) return;

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

    // Show/hide Edit/Save buttons when modal is shown
    function showAdminModalButtons() {
        editBtn.style.display = "inline-block";
        saveBtn.style.display = "inline-block";
    }

    // Listen for modal open to enable admin controls
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (modalOverlay.style.display === "flex") {
                setModalFieldsDisabled(true);
                showAdminModalButtons();
            }
        });
    });
    observer.observe(modalOverlay, { attributes: true, attributeFilter: ["style"] });

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
                location.reload();
            } else {
                alert("Failed to update JD.");
            }
        });
    };
});
