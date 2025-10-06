
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Quill editor for job description
    let quill = null;
    const editorContainer = document.getElementById('jd_description_editor');
    const hiddenTextarea = document.getElementById('jd_description');
    
    if (editorContainer && hiddenTextarea) {
        quill = new Quill('#jd_description_editor', {
            theme: 'snow',
            placeholder: 'Enter detailed job description with formatting... (Tip: Paste from PDF and line breaks will be preserved)',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    ['link'],
                    [{ 'align': [] }],
                    ['clean']
                ],
                clipboard: {
                    // Allow more HTML tags and attributes when pasting
                    matchVisual: false
                }
            }
        });

        // Handle paste events to preserve line breaks
        quill.clipboard.addMatcher(Node.TEXT_NODE, function(node, delta) {
            // Convert line breaks to proper Quill line breaks
            if (typeof node.data === 'string') {
                const lines = node.data.split('\n');
                const newOps = [];
                
                lines.forEach((line, index) => {
                    if (index > 0) {
                        newOps.push({ insert: '\n' });
                    }
                    if (line.trim()) {
                        newOps.push({ insert: line });
                    }
                });
                
                return { ops: newOps };
            }
            return delta;
        });

        // Better paste handling for formatted content
        quill.clipboard.addMatcher('p', function(node, delta) {
            // Preserve paragraph breaks
            delta.ops.push({ insert: '\n' });
            return delta;
        });

        // Update hidden textarea when Quill content changes
        quill.on('text-change', function() {
            const htmlContent = quill.root.innerHTML;
            hiddenTextarea.value = htmlContent;
        });

        // Add a helper function to convert plain text with line breaks
        quill.on('selection-change', function(range, oldRange, source) {
            if (range === null && oldRange !== null) {
                // Editor lost focus, ensure content is synced
                const htmlContent = quill.root.innerHTML;
                hiddenTextarea.value = htmlContent;
            }
        });

        // Format button functionality
        const formatBtn = document.getElementById('formatTextBtn');
        if (formatBtn) {
            formatBtn.addEventListener('click', function() {
                const currentText = quill.getText();
                if (currentText.trim()) {
                    // Clear the editor
                    quill.setContents([]);
                    
                    // Split by double line breaks first (paragraphs)
                    const paragraphs = currentText.split(/\n\s*\n/);
                    
                    paragraphs.forEach((paragraph, index) => {
                        if (paragraph.trim()) {
                            // Split single line breaks within paragraphs
                            const lines = paragraph.split('\n');
                            lines.forEach((line, lineIndex) => {
                                if (line.trim()) {
                                    quill.insertText(quill.getLength(), line.trim());
                                    if (lineIndex < lines.length - 1) {
                                        // Add line break within paragraph
                                        quill.insertText(quill.getLength(), '\n');
                                    }
                                }
                            });
                            
                            // Add paragraph break
                            if (index < paragraphs.length - 1) {
                                quill.insertText(quill.getLength(), '\n\n');
                            }
                        }
                    });
                    
                    // Update the hidden textarea
                    hiddenTextarea.value = quill.root.innerHTML;
                    
                    // Show success feedback
                    formatBtn.textContent = '✅ Formatted!';
                    formatBtn.style.backgroundColor = '#28a745';
                    setTimeout(() => {
                        formatBtn.textContent = '📝 Format Pasted Text (Convert Line Breaks)';
                        formatBtn.style.backgroundColor = '#6c757d';
                    }, 2000);
                } else {
                    alert('Please paste some text first, then click this button to format it.');
                }
            });
        }
    }

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
            // Validate company selection
            if (!hiddenInput.value) {
                e.preventDefault();
                searchInput.focus();
                searchInput.style.borderColor = '#e53e3e';
                
                // Reset border color after 3 seconds
                setTimeout(() => {
                    searchInput.style.borderColor = '';
                }, 3000);
                
                alert('Please select a valid company from the list.');
                return;
            }
            
            // Validate Quill editor content
            if (quill && quill.getText().trim().length === 0) {
                e.preventDefault();
                alert('Please enter a job description.');
                return;
            }
            
            // Update hidden textarea with Quill content before submission
            if (quill) {
                hiddenTextarea.value = quill.root.innerHTML;
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
            
            // Initialize Quill editor for the edit modal if not already initialized
            if (!window.editQuill) {
                window.editQuill = new Quill('#jdEditDescriptionEditor', {
                    theme: 'snow',
                    placeholder: 'Enter detailed job description with formatting...',
                    modules: {
                        toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            [{ 'indent': '-1'}, { 'indent': '+1' }],
                            ['link'],
                            [{ 'align': [] }],
                            ['clean']
                        ]
                    }
                });

                // Update hidden textarea when Quill content changes
                window.editQuill.on('text-change', function() {
                    const htmlContent = window.editQuill.root.innerHTML;
                    form.jd_description.value = htmlContent;
                });
            }
            
            // Set Quill content
            window.editQuill.root.innerHTML = jd.jd_description || '';
            form.jd_description.value = jd.jd_description;
            
            form.must_have_skills.value = jd.must_have_skills;
            form.good_to_have_skills.value = jd.good_to_have_skills;
            form.total_profiles.value = jd.total_profiles;
            form.jd_status.value = jd.jd_status;
            
            // Disable all fields initially
            Array.from(form.elements).forEach(el => el.disabled = true);
            form.jd_id.disabled = true;
            
            // Disable Quill editor initially
            if (window.editQuill) {
                window.editQuill.enable(false);
            }
            
            form.querySelector('button[type="submit"]').style.display = 'none';
            document.getElementById('jdModal').style.display = 'flex';
        });
}

function enableEditJD() {
    const form = document.getElementById('jdEditForm');
    Array.from(form.elements).forEach(el => el.disabled = false);
    form.jd_id.disabled = true;
    
    // Enable Quill editor
    if (window.editQuill) {
        window.editQuill.enable(true);
    }
    
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
        
        // Update hidden textarea with Quill content before submission
        if (window.editQuill) {
            form.jd_description.value = window.editQuill.root.innerHTML;
        }
        
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
