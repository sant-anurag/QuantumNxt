document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('result-form');
    const formMessage = document.getElementById('form-message');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const candidateId = document.getElementById('candidate-id').value;
        const level = document.getElementById('level').value;
        const token = document.getElementById('token').value;
        const result = document.getElementById('result').value;
        const comments = document.getElementById('comments').value;
        if (!result) {
            formMessage.textContent = 'Please select a result.';
            return;
        }
        fetch('/submit_interview_result/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                candidate_id: candidateId,
                level: level,
                result: result,
                comments: comments,
                token: token
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                formMessage.style.color = '#27ae60';
                formMessage.textContent = 'Result submitted successfully!';
                setTimeout(() => { window.location.reload(); }, 2000);
            } else {
                formMessage.style.color = '#e74c3c';
                formMessage.textContent = data.error || 'Error submitting result.';
            }
        })
        .catch(() => {
            formMessage.style.color = '#e74c3c';
            formMessage.textContent = 'Network error.';
        });
    });
});