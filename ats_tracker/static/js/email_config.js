// Show/hide modal for instructions
function showInstructionsModal() {
    document.getElementById('instructionsModal').style.display = 'block';
}
function closeInstructionsModal() {
    document.getElementById('instructionsModal').style.display = 'none';
}
// Close modal if user clicks outside content
window.onclick = function(event) {
    var modal = document.getElementById('instructionsModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};
