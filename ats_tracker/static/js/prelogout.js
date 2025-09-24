$(document).ready(function() {
    $('#email-select').select2({
        placeholder: "Select or type email(s)",
        tags: true,
        tokenSeparators: [',', ' '],
        createTag: function (params) {
            var term = $.trim(params.term);
            // Basic email validation
            if (term.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                return {
                    id: term,
                    text: term,
                    newTag: true
                };
            }
            return null;
        }
    });
});