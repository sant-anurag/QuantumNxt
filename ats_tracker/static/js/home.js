// JavaScript
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.menu > li > a').forEach(function(menuLink) {
        menuLink.addEventListener('click', function(e) {
            const parentLi = menuLink.parentElement;
            const submenu = parentLi.querySelector('.submenu');
            if (submenu) {
                // Only prevent default if submenu exists (toggle submenu)
                e.preventDefault();
                document.querySelectorAll('.menu > li').forEach(function(li) {
                    if (li !== parentLi) {
                        li.classList.remove('active');
                    }
                });
                parentLi.classList.toggle('active');
            }
            // If no submenu, allow default navigation (do not preventDefault)
        });
    });
});