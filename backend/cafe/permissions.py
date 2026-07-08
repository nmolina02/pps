from rest_framework.permissions import BasePermission


class IsSessionHost(BasePermission):
    """Solo el docente que creó la QuizSession puede administrarla."""

    message = 'Solo el docente que creó la sesión puede administrarla.'

    def has_object_permission(self, request, view, obj):
        session = obj if obj.__class__.__name__ == 'QuizSession' else obj.session
        return bool(request.user and request.user.is_authenticated and session.host_id == request.user.id)
