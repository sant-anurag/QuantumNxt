# ats_tracker/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.login_view, name='login'),  # Root URL shows login page
    path('home/', views.home, name='home'),    # Home page after login
    path('teams/add-member/', views.add_member, name='add_member'),
    path('create-team/', views.create_team, name='create_team'),
    path('team-members/<int:team_id>/', views.team_members, name='team_members'),
    path('teams/', views.view_edit_teams, name='view_edit_teams'),
    path('teams/<int:team_id>/members/', views.team_members_api, name='team_members_api'),
    path('teams/<int:team_id>/add_member/', views.add_member_api, name='add_member_api'),
    path('teams/<int:team_id>/remove_member/', views.remove_member_api, name='remove_member_api'),
    path('jds/', views.jd_list, name='jd_create'),
    path('jds/create/', views.create_jd, name='create_jd'),
    path('jds/<str:jd_id>/', views.jd_detail, name='jd_detail'),
    path('create_customer/', views.create_customer, name='create_customer'),
    path('view_edit_jds/', views.view_edit_jds, name='view_edit_jds'),
    path('get_jd/<str:jd_id>/', views.get_jd, name='get_jd'),
    path('update_jd/<str:jd_id>/', views.update_jd, name='update_jd'),
    path('assign_jd/', views.assign_jd, name='assign_jd'),
    path('assign_jd_data/', views.assign_jd_data, name='assign_jd_data'),
    path('assign_jd_page/', views.assign_jd_page, name='assign_jd_page'),
    path('employee_view/', views.employee_view_page, name='employee_view_page'),
    path('employee_view_data/', views.employee_view_data, name='employee_view_data'),
    path('employee_view_report/', views.employee_view_report, name='employee_view_report'),
    path('upload_resume/', views.upload_resume_page, name='upload_resume_page'),
    path('api/upload_resume/', views.upload_resume, name='api_upload_resume'),
    path('api/recent_resumes/', views.recent_resumes, name='api_recent_resumes'),
    path('download_resume/<int:resume_id>/', views.download_resume, name='download_resume'),
    path('view_parse_resumes_page/', views.view_parse_resumes_page, name='view_parse_resumes_page'),
    path('view_parse_resumes/', views.view_parse_resumes, name='view_parse_resumes'),
    path('update_resume_status/', views.update_resume_status, name='update_resume_status'),
    path('download_resume/<int:resume_id>/', views.download_resume, name='download_resume'),
    path('assign_jd_data/', views.assign_jd_data, name='assign_jd_data'),
    # urls.py
    path('get_candidate_details/', views.get_candidate_details, name='get_candidate_details'),
    path('export_resumes_excel/', views.export_resumes_excel, name='export_resumes_excel'),
    path('parse_resumes/', views.parse_resumes, name='parse_resumes'),
    path('save_candidate_details/', views.save_candidate_details, name='save_candidate_details'),
    path('update_candidate_screen_status/', views.update_candidate_screen_status, name='update_candidate_screen_status'),
    path('get_jd_team_members/', views.get_jd_team_members, name='get_jd_team_members'),
    # urls.py
    path('schedule_interviews/', views.schedule_interviews_page, name='schedule_interviews_page'),
    path('get_candidates_for_jd/', views.get_candidates_for_jd, name='get_candidates_for_jd'),
    path('schedule_interview/', views.schedule_interview, name='schedule_interview'),
    path('record_interview_result/', views.record_interview_result_page, name='record_interview_result_page'),
    path('submit_interview_result/', views.submit_interview_result, name='submit_interview_result'),
]
