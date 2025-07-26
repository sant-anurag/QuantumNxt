# ats_tracker/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('teams/add-member/', views.add_member, name='add_member'),
]