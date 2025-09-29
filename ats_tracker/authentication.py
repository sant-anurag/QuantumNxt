from functools import wraps
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.conf import settings
from django.contrib import messages

# This decorator checks if any user is logged in.
def login_required(view_func):
    """
    Decorator to check if a user is authenticated.
    Redirects to the login page if the user is not authenticated.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Check for the custom 'authenticated' key in the session.
        session = request.session
        is_authenticated = session.get('authenticated', False)
        print("User authentication status:", is_authenticated)
        if is_authenticated:
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
    if 'SuperUser' not in role_names:
        role_names.append('SuperUser')  # Always allow superuser access. 
    
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            # First, check if the user is authenticated at all.
            print("User authentication status in role_required:", request.session.get('authenticated', False))
            if 'authenticated' not in request.session or not request.session['authenticated']:
                return redirect(settings.LOGIN_URL)
            
            # Now, check if the user's role is in the list of required roles.
            user_role = request.session.get('role')
            if user_role and user_role in role_names:
                return view_func(request, *args, **kwargs)
            else:
                if is_api:
                    messages.error(request, "You don't have the required permissions.")
                    return JsonResponse({'error': 'You do not have the required permissions.'}, status=403)
                else:
                    return render(request, 'access_denied.html', status=403)
                
        return _wrapped_view
    return decorator



# This decorator checks that user is not logged in.
def anonymous_required(view_func):
    """
    Decorator to ensure that the user is not authenticated.
    Redirects to the home page if the user is authenticated.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Check for the custom 'authenticated' key in the session.
        session = request.session
        is_authenticated = session.get('authenticated', False)
        print("User authentication status:", is_authenticated)
        if is_authenticated:
            return redirect('home')  # Redirect to home if already logged in.
        
        return view_func(request, *args, **kwargs)
        
    return _wrapped_view     