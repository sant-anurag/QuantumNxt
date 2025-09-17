// Function to get CSRF token from cookies
function getCookie(name) {
	let cookieValue = null;
	if (document.cookie && document.cookie !== '') {
		const cookies = document.cookie.split(';');
		for (let i = 0; i < cookies.length; i++) {
			const cookie = cookies[i].trim();
			// Does this cookie string begin with the name we want?
			if (cookie.substring(0, name.length + 1) === (name + '=')) {
				cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
				break;
			}
		}
	}
	return cookieValue;
}
document.addEventListener('DOMContentLoaded', function() {
	const modal = document.getElementById('noteModal');
	const closeModalBtn = document.getElementById('closeNoteModal');
	const modalTitle = document.getElementById('noteModalTitle');
	const modalContent = document.getElementById('noteModalContent');

	document.querySelectorAll('.note-action-btn').forEach(btn => {
		btn.addEventListener('click', function() {
			const customerName = this.getAttribute('data-customer-name');
			const csrftoken = getCookie('csrftoken');
			const note = this.getAttribute('data-customer-note');
			const hasNote = this.getAttribute('data-has-note') === '1';
			modalTitle.textContent = (hasNote ? 'View Note' : 'Add Note') + ' - ' + customerName;
			if (hasNote) {
				modalContent.innerHTML = `<div class="text-gray-700 text-base">${note}</div>`;
			} else {
				modalContent.innerHTML = `<form method="post" class="space-y-4">` +
					`<input type="hidden" name="csrfmiddlewaretoken" value="${csrftoken}">` +
					`<input type="hidden" name="customer_id" value="${this.getAttribute('data-customer-id')}">` +
					`<textarea name="note" rows="4" class="w-full border rounded p-2" required></textarea>` +
					`<button type="submit" class="btn-primary bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Save Note</button>` +
				`</form>`;
			}
			modal.classList.remove('hidden');
		});
	});

	closeModalBtn.addEventListener('click', function() {
		modal.classList.add('hidden');
	});

	window.addEventListener('click', function(e) {
		if (e.target === modal) {
			modal.classList.add('hidden');
		}
	});
});
