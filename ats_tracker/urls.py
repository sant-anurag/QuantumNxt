# ats_tracker/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
]