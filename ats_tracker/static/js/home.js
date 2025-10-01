// JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Submenu Toggle Functionality
    document.querySelectorAll('.menu > li > a').forEach(function(menuLink) {
        menuLink.addEventListener('click', function(e) {
            const parentLi = menuLink.parentElement;
            const submenu = parentLi.querySelector('.submenu');
            if (submenu) {
                // Only prevent default if submenu exists (toggle submenu)
                e.preventDefault();
                
                // If sidebar is collapsed, expand it first
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('collapsed')) {
                    // Expand sidebar first
                    sidebar.classList.remove('collapsed');
                    sidebar.classList.add('expanding');
                    
                    // Remove expanding class after animation completes
                    setTimeout(() => {
                        sidebar.classList.remove('expanding');
                    }, 400); // Match the animation duration
                    
                    // Update text visibility
                    const menuTextElements = document.querySelectorAll('.menu > li > a span');
                    menuTextElements.forEach(function(span) {
                        span.style.display = '';
                        span.style.width = '';
                        span.style.opacity = '1';
                    });
                    
                    // Save the expanded state to localStorage
                    localStorage.setItem('sidebarCollapsed', 'false');
                    
                    // Small delay before showing submenu to allow sidebar expansion animation to complete
                    setTimeout(() => {
                        document.querySelectorAll('.menu > li').forEach(function(li) {
                            if (li !== parentLi) {
                                li.classList.remove('active');
                            }
                        });
                        parentLi.classList.add('active');
                    }, 300);
                } else {
                    // Sidebar is already expanded, just toggle submenu
                    document.querySelectorAll('.menu > li').forEach(function(li) {
                        if (li !== parentLi) {
                            li.classList.remove('active');
                        }
                    });
                    parentLi.classList.toggle('active');
                }
            }
            // If no submenu, allow default navigation (do not preventDefault)
        });
    });

    // Sidebar Toggle Functionality
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    // Always start with expanded sidebar by default
    // Remove collapsed class if it exists
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
    }
    
    // Ensure text is visible by default
    const menuTextElements = document.querySelectorAll('.menu > li > a span');
    menuTextElements.forEach(function(span) {
        span.style.display = '';
        span.style.width = '';
        span.style.opacity = '1';
    });
    
    // Reset localStorage to always default to expanded
    localStorage.setItem('sidebarCollapsed', 'false');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            const wasCollapsed = sidebar.classList.contains('collapsed');
            sidebar.classList.toggle('collapsed');
            
            // Close any open submenus when toggling
            document.querySelectorAll('.menu > li.active').forEach(function(li) {
                li.classList.remove('active');
            });
            
            // Handle text visibility in menu items
            const menuTextElements = document.querySelectorAll('.menu > li > a span');
            menuTextElements.forEach(function(span) {
                if (sidebar.classList.contains('collapsed')) {
                    span.style.display = 'none';
                    span.style.width = '0';
                    span.style.opacity = '0';
                } else {
                    span.style.display = '';
                    span.style.width = '';
                    span.style.opacity = '1';
                    
                    // Add expanding animation class only when transitioning from collapsed to expanded
                    if (wasCollapsed) {
                        sidebar.classList.add('expanding');
                        setTimeout(() => {
                            sidebar.classList.remove('expanding');
                        }, 400); // Match the animation duration
                    }
                }
            });
            
            // Save preference to localStorage
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }
    
    // Handle submenu positioning in collapsed mode
    if (sidebar) {
        // Position submenus when hovering in collapsed mode
        document.querySelectorAll('.menu > li').forEach(function(menuItem) {
            menuItem.addEventListener('mouseenter', function() {
                if (sidebar.classList.contains('collapsed')) {
                    const submenu = menuItem.querySelector('.submenu');
                    if (submenu) {
                        // Position the submenu at the same height as the parent menu item
                        const menuItemRect = menuItem.getBoundingClientRect();
                        submenu.style.top = menuItemRect.top + 'px';
                    }
                }
            });
            
            // Remove hover effect when mouse leaves
            menuItem.addEventListener('mouseleave', function() {
                if (sidebar.classList.contains('collapsed')) {
                    const submenu = menuItem.querySelector('.submenu');
                    if (submenu) {
                        // Reset position when mouse leaves
                        submenu.style.top = '';
                    }
                }
            });
        });
    }
});


document.addEventListener('DOMContentLoaded', function() {
    const bell = document.getElementById('notification-bell');
    const panel = document.querySelector('.notifications-panel');
    let hideTimeout = null;
    let mouseOverPanel = false;

    // Show panel on bell click with dissolve and pop-in
    if (bell && panel) {
        bell.addEventListener('click', function() {
            // Dissolve bell
            bell.classList.add('dissolving');
            setTimeout(() => {
                bell.style.display = 'none';
                // Pop-in panel
                panel.classList.add('popin');
                panel.classList.add('visible');
                setTimeout(() => {
                    panel.classList.remove('popin');
                }, 500);
            }, 500);
            if (hideTimeout) clearTimeout(hideTimeout);
            if (!mouseOverPanel) {
                hideTimeout = setTimeout(() => {
                    if (!mouseOverPanel) {
                        panel.classList.remove('visible');
                        // Show bell again
                        bell.classList.remove('dissolving');
                        bell.style.display = '';
                    }
                }, 10000);
            }
        });
    }

    // Manual close button for notification panel
    const closeBtn = document.getElementById('notification-panel-close');
    if (closeBtn && panel) {
        closeBtn.addEventListener('click', function() {
            panel.classList.remove('visible');
            if (bell) {
                bell.classList.remove('dissolving');
                bell.style.display = '';
            }
        });
    }

    // Keep panel open if mouse is over it
    if (panel) {
        panel.addEventListener('mouseenter', function() {
            mouseOverPanel = true;
            if (hideTimeout) clearTimeout(hideTimeout);
        });
        panel.addEventListener('mouseleave', function() {
            mouseOverPanel = false;
            hideTimeout = setTimeout(() => {
                if (!mouseOverPanel) {
                    panel.classList.remove('visible');
                    // Show bell again
                    if (bell) {
                        bell.classList.remove('dissolving');
                        bell.style.display = '';
                    }
                }
            }, 10000);
        });
        // Also, when panel is hidden by any means, show bell
        panel.addEventListener('transitionend', function(e) {
            if (!panel.classList.contains('visible')) {
                if (bell) {
                    bell.classList.remove('dissolving');
                    bell.style.display = '';
                }
            }
        });
    }
});
