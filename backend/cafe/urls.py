from django.urls import path

from . import views

urlpatterns = [
    path('topics/', views.TopicListView.as_view(), name='topic-list'),
    path('cases/', views.CaseListView.as_view(), name='case-list'),
    path('cases/<slug:slug>/', views.CaseDetailView.as_view(), name='case-detail'),
    path('sessions/<str:code>/join/', views.JoinSessionView.as_view(), name='session-join'),
    path('sessions/<str:code>/finish/', views.FinishSessionView.as_view(), name='session-finish'),
    path('sessions/<str:code>/cancel/', views.CancelSessionView.as_view(), name='session-cancel'),
    path('sessions/<str:code>/state/', views.SessionStudentStateView.as_view(), name='session-student-state'),
    path('sessions/<str:code>/host-state/', views.SessionHostStateView.as_view(), name='session-host-state'),
    path('sessions/<str:code>/questions/', views.SessionQuestionListView.as_view(), name='session-question-list'),
    path(
        'sessions/<str:code>/questions/<int:order>/start/',
        views.StartQuestionView.as_view(),
        name='session-question-start',
    ),
    path(
        'sessions/<str:code>/questions/<int:order>/reveal/',
        views.RevealQuestionView.as_view(),
        name='session-question-reveal',
    ),
    path(
        'sessions/<str:code>/questions/<int:order>/answer/',
        views.SubmitAnswerView.as_view(),
        name='session-question-answer',
    ),
    path('students/leaderboard/', views.StudentLeaderboardView.as_view(), name='student-leaderboard'),
    path('students/<str:legajo>/profile/', views.StudentProfileView.as_view(), name='student-profile'),
    path('students/<str:legajo>/history/', views.StudentHistoryView.as_view(), name='student-history'),
    path('docente/perfil/', views.TeacherProfileView.as_view(), name='teacher-profile'),
    path('docente/cases/', views.CaseCreateView.as_view(), name='docente-case-create'),
    path('docente/cases/<slug:slug>/', views.CaseUpdateView.as_view(), name='docente-case-update'),
    path('docente/quizzes/', views.QuizListCreateView.as_view(), name='quiz-list-create'),
    path('docente/quizzes/<int:pk>/', views.QuizDetailView.as_view(), name='quiz-detail'),
    path('docente/quizzes/<int:pk>/start/', views.QuizStartView.as_view(), name='quiz-start'),
    path('docente/quizzes/<int:pk>/leaderboard/', views.QuizLeaderboardView.as_view(), name='quiz-leaderboard'),
    path('docente/mi-historial/', views.ClearMyHistoryView.as_view(), name='docente-clear-history'),
]
