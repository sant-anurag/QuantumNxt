# ats_tracker/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('teams/add-member/', views.add_member, name='add_member'),
    path('create-team/', views.create_team, name='create_team'),
    path('team-members/<int:team_id>/', views.team_members, name='team_members'),
]