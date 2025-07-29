document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggle-view');
    const tableView = document.getElementById('jd-table-view');
    const cardView = document.getElementById('jd-card-view');
    let isTable = true;

    toggleBtn.addEventListener('click', function() {
        isTable = !isTable;
        if (isTable) {
            tableView.style.display = '';
            cardView.style.display = 'none';
            toggleBtn.innerHTML = '<i class="fas fa-table"></i> <span>Table</span>';
        } else {
            tableView.style.display = 'none';
            cardView.style.display = '';
            toggleBtn.innerHTML = '<i class="fas fa-th-large"></i> <span>Card</span>';
        }
    });

    function openModal(jd_id) {
        fetch(`/get_jd/${jd_id}/`)
            .then(res => res.json())
            .then(data => {
                if (data.jd) {
                    fillModal(data.jd);
                    document.getElementById('jd-modal-overlay').style.display = 'flex';
                }
            });
    }

    function fillModal(jd) {
        document.getElementById('jd_id').value = jd.jd_id;
        document.getElementById('jd_summary').value = jd.jd_summary;
        document.getElementById('jd_description').value = jd.jd_description;
        document.getElementById('must_have_skills').value = jd.must_have_skills || '';
        document.getElementById('good_to_have_skills').value = jd.good_to_have_skills || '';
        document.getElementById('no_of_positions').value = jd.no_of_positions;
        document.getElementById('jd_status').value = jd.jd_status;
        document.getElementById('company_id').value = jd.company_id;
        document.getElementById('team_id').value = jd.team_id;
        document.getElementById('closure_date').value = jd.closure_date || '';
        // Disable all fields initially
        Array.from(document.querySelectorAll('#jd-edit-form input, #jd-edit-form textarea, #jd-edit-form select')).forEach(el => {
            if (el.id !== 'jd_id') el.disabled = true;
        });
        document.getElementById('jd-edit-btn').disabled = false;
        document.getElementById('jd-save-btn').disabled = true;
    }

    document.querySelectorAll('.jd-btn-view').forEach(btn => {
        btn.addEventListener('click', function() {
            openModal(this.dataset.jd);
        });
    });

    document.getElementById('jd-edit-btn').addEventListener('click', function() {
        Array.from(document.querySelectorAll('#jd-edit-form input, #jd-edit-form textarea, #jd-edit-form select')).forEach(el => {
            if (el.id !== 'jd_id') el.disabled = false;
        });
        document.getElementById('jd-save-btn').disabled = false;
        this.disabled = true;
    });

    document.getElementById('jd-close-btn').addEventListener('click', closeModal);
    document.getElementById('jd-close-modal').addEventListener('click', closeModal);

    function closeModal() {
        document.getElementById('jd-modal-overlay').style.display = 'none';
    }

    document.getElementById('jd-edit-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const jd_id = document.getElementById('jd_id').value;
        const payload = {
            jd_summary: document.getElementById('jd_summary').value,
            jd_description: document.getElementById('jd_description').value,
            must_have_skills: document.getElementById('must_have_skills').value,
            good_to_have_skills: document.getElementById('good_to_have_skills').value,
            no_of_positions: document.getElementById('no_of_positions').value,
            jd_status: document.getElementById('jd_status').value,
            company_id: document.getElementById('company_id').value,
            team_id: document.getElementById('team_id').value,
            closure_date: document.getElementById('closure_date').value
        };
        fetch(`/update_jd/${jd_id}/`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken()},
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                closeModal();
                window.location.reload();
            }
        });
    });

    function getCSRFToken() {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            document.cookie.split(';').forEach(function(cookie) {
                const c = cookie.trim();
                if (c.substring(0, 10) === 'csrftoken=') {
                    cookieValue = decodeURIComponent(c.substring(10));
                }
            });
        }
        return cookieValue;
    }
});