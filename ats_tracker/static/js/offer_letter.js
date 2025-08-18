// JavaScript
document.getElementById('salaryForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        candidate_id: form.candidate_id.value,
        basic: form.basic.value,
        hra: form.hra.value,
        special_allowance: form.special_allowance.value || 0,
        pf: form.pf.value || 0,
        gratuity: form.gratuity.value || 0,
        bonus: form.bonus.value || 0,
        other: form.other.value || 0
    };
    fetch('/api/generate_offer/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(resp => {
        if (resp.success) {
            document.getElementById('offerLetterPreview').innerHTML = resp.offer_html;
        } else {
            alert(resp.error || 'Error generating offer letter');
        }
    });
});