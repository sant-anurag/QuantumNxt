// logout.js
// Optionally, you can add a fade-in effect for the card
document.addEventListener('DOMContentLoaded', function() {
    const card = document.querySelector('.logout-card');
    if (card) {
        card.style.opacity = 0;
        setTimeout(() => {
            card.style.transition = 'opacity 0.7s';
            card.style.opacity = 1;
        }, 100);
    }
});