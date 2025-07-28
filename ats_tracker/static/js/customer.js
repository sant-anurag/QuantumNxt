// Optionally, add client-side validation or UX improvements here
document.getElementById('customerForm').addEventListener('submit', function(e) {
    // Example: Prevent multiple submits
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving...";
});