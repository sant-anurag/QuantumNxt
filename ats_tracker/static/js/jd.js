
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('companySearch');
    const hiddenInput = document.getElementById('companyId');
    const dropdown = document.getElementById('companyDropdown');
    
    if (!searchInput || !hiddenInput || !dropdown) {
        return; // Exit if elements don't exist on this page
    }
    
    const dropdownOptions = dropdown.querySelectorAll('.dropdown-option');
    
    let selectedIndex = -1;
    
    // Show dropdown when input is focused
    searchInput.addEventListener('focus', function() {
        dropdown.classList.add('show');
        resetSelection();
    });
    
    // Filter options based on search input
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        let visibleCount = 0;
        selectedIndex = -1;
        
        dropdownOptions.forEach(function(option, index) {
            const text = option.textContent.toLowerCase().trim();
            if (text.includes(searchTerm)) {
                option.classList.remove('hidden');
                visibleCount++;
            } else {
                option.classList.add('hidden');
                option.classList.remove('selected');
            }
        });
        
        // Clear hidden input if no exact match
        let exactMatch = false;
        dropdownOptions.forEach(function(option) {
            if (!option.classList.contains('hidden') && 
                option.textContent.toLowerCase().trim() === searchTerm) {
                exactMatch = true;
                hiddenInput.value = option.dataset.value;
            }
        });
        
        if (!exactMatch) {
            hiddenInput.value = '';
        }
        
        dropdown.classList.toggle('show', visibleCount > 0);
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        const visibleOptions = Array.from(dropdownOptions).filter(option => 
            !option.classList.contains('hidden'));
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, visibleOptions.length - 1);
            updateSelection(visibleOptions);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection(visibleOptions);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && visibleOptions[selectedIndex]) {
                selectOption(visibleOptions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('show');
            searchInput.blur();
        }
    });
    
    // Handle option click
    dropdownOptions.forEach(function(option) {
        option.addEventListener('click', function() {
            selectOption(this);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.searchable-select')) {
            dropdown.classList.remove('show');
        }
    });
    
    function selectOption(option) {
        searchInput.value = option.textContent.trim();
        hiddenInput.value = option.dataset.value;
        dropdown.classList.remove('show');
        resetSelection();
        
        // Trigger change event for validation
        const event = new Event('change', { bubbles: true });
        hiddenInput.dispatchEvent(event);
    }
    
    function updateSelection(visibleOptions) {
        // Clear all selections
        dropdownOptions.forEach(option => option.classList.remove('selected'));
        
        // Highlight selected option
        if (selectedIndex >= 0 && visibleOptions[selectedIndex]) {
            visibleOptions[selectedIndex].classList.add('selected');
            visibleOptions[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    function resetSelection() {
        selectedIndex = -1;
        dropdownOptions.forEach(option => option.classList.remove('selected'));
    }
    
    // Form validation
    const form = document.getElementById('jdForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            if (!hiddenInput.value) {
                e.preventDefault();
                searchInput.focus();
                searchInput.style.borderColor = '#e53e3e';
                
                // Reset border color after 3 seconds
                setTimeout(() => {
                    searchInput.style.borderColor = '';
                }, 3000);
                
                alert('Please select a valid company from the list.');
            }
        });
    }
});

const jdSearch = document.getElementById('jdSearch');
if (jdSearch) {
    jdSearch.addEventListener('input', function() {
        const val = this.value;
        window.location.href = '?search=' + encodeURIComponent(val);
    });
}

function openJDModal(jd_id) {
    fetch(`/jds/${jd_id}/`)
        .then(res => res.json())
        .then(jd => {
            const form = document.getElementById('jdEditForm');
            form.jd_id.value = jd.jd_id;
            form.jd_summary.value = jd.jd_summary;
            form.jd_description.value = jd.jd_description;
            form.must_have_skills.value = jd.must_have_skills;
            form.good_to_have_skills.value = jd.good_to_have_skills;
            form.total_profiles.value = jd.total_profiles;
            form.jd_status.value = jd.jd_status;
            // Disable all fields initially
            Array.from(form.elements).forEach(el => el.disabled = true);
            form.jd_id.disabled = true;
            form.querySelector('button[type="submit"]').style.display = 'none';
            document.getElementById('jdModal').style.display = 'flex';
        });
}

function enableEditJD() {
    const form = document.getElementById('jdEditForm');
    Array.from(form.elements).forEach(el => el.disabled = false);
    form.jd_id.disabled = true;
    form.querySelector('button[type="submit"]').style.display = '';
}

function closeJDModal() {
    document.getElementById('jdModal').style.display = 'none';
}

jd_edit_form = document.getElementById('jdEditForm');
if (jd_edit_form) {
    jd_edit_form.addEventListener('submit', function(e) {
        e.preventDefault();
        const form = e.target;
        const jd_id = form.jd_id.value;
        const data = new FormData(form);
        fetch(`/jds/${jd_id}/`, {
            method: 'POST',
            body: data,
            headers: {'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value}
        })
        .then(res => res.json())
        .then(resp => {
            if (resp.success) {
                alert('JD updated successfully!');
                window.location.reload();
            }
        });
    });
}
