# ats_tracker/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('teams/add-member/', views.add_member, name='add_member'),
    path('create-team/', views.create_team, name='create_team'),
    path('team-members/<int:team_id>/', views.team_members, name='team_members'),
    path('teams/', views.view_edit_teams, name='view_edit_teams'),
    path('teams/<int:team_id>/members/', views.team_members_api, name='team_members_api'),
    path('teams/<int:team_id>/add_member/', views.add_member_api, name='add_member_api'),
    path('teams/<int:team_id>/remove_member/', views.remove_member_api, name='remove_member_api'),
]