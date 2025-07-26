// ats_tracker/static/js/home.js
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.menu > li > a').forEach(function(menuLink) {
        menuLink.addEventListener('click', function(e) {
            e.preventDefault();
            const parentLi = this.parentElement;
            // Remove 'active' from all menu items except the clicked one
            document.querySelectorAll('.menu > li').forEach(function(li) {
                if (li !== parentLi) li.classList.remove('active');
            });
            // Toggle 'active' on the clicked menu item
            parentLi.classList.toggle('active');
        });
    });
});