
const jdSearch = document.getElementById('jdSearch');
if (jdSearch) {
    jdSearch.addEventListener('input', function() {
        const val = this.value;
        window.location.href = '?search=' + encodeURIComponent(val);
    });
}

function openJDModal(jd_id) {
    fetch(`/jds/${jd_id}/`)
        .then(res => res.json())
        .then(jd => {
            const form = document.getElementById('jdEditForm');
            form.jd_id.value = jd.jd_id;
            form.jd_summary.value = jd.jd_summary;
            form.jd_description.value = jd.jd_description;
            form.must_have_skills.value = jd.must_have_skills;
            form.good_to_have_skills.value = jd.good_to_have_skills;
            form.total_profiles.value = jd.total_profiles;
            form.jd_status.value = jd.jd_status;
            // Disable all fields initially
            Array.from(form.elements).forEach(el => el.disabled = true);
            form.jd_id.disabled = true;
            form.querySelector('button[type="submit"]').style.display = 'none';
            document.getElementById('jdModal').style.display = 'flex';
        });
}

function enableEditJD() {
    const form = document.getElementById('jdEditForm');
    Array.from(form.elements).forEach(el => el.disabled = false);
    form.jd_id.disabled = true;
    form.querySelector('button[type="submit"]').style.display = '';
}

function closeJDModal() {
    document.getElementById('jdModal').style.display = 'none';
}

jd_edit_form = document.getElementById('jdEditForm');
if (jd_edit_form) {
    jd_edit_form.addEventListener('submit', function(e) {
        e.preventDefault();
        const form = e.target;
        const jd_id = form.jd_id.value;
        const data = new FormData(form);
        fetch(`/jds/${jd_id}/`, {
            method: 'POST',
            body: data,
            headers: {'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value}
        })
        .then(res => res.json())
        .then(resp => {
            if (resp.success) {
                alert('JD updated successfully!');
                window.location.reload();
            }
        });
    });
}