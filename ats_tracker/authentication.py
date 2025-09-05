from functools import wraps
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.conf import settings

# This decorator checks if any user is logged in.
def login_required(view_func):
    """
    Decorator to check if a user is authenticated.
    Redirects to the login page if the user is not authenticated.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Check for the custom 'authenticated' key in the session.
        if 'authenticated' in request.session and request.session['authenticated']:
            return view_func(request, *args, **kwargs)
        
        # Redirect to the login page if not authenticated.
        return redirect('login')
        
    return _wrapped_view

# This decorator checks if the user has a specific role.
def role_required(role_names, is_api=False):
    """
    Decorator to check if the user has one of the specified roles.
    
    Args:
        role_names (str or list): The role(s) required to access the view.
    """
    if not isinstance(role_names, (list, tuple)):
        role_names = [role_names]
        
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            # First, check if the user is authenticated at all.
            if 'authenticated' not in request.session or not request.session['authenticated']:
                return redirect(settings.LOGIN_URL)
            
            # Now, check if the user's role is in the list of required roles.
            user_role = request.session.get('role')
            if user_role and user_role in role_names:
                return view_func(request, *args, **kwargs)
            else:
                if is_api:
                    return JsonResponse({'error': 'You do not have the required permissions.'}, status=403)
                else:
                    return render(request, 'access_denied.html', status=403)
                
        return _wrapped_view
    return decorator
