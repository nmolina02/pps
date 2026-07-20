from rest_framework.permissions import BasePermission


class IsSessionHost(BasePermission):
    """Solo el docente que creó la QuizSession puede administrarla."""

    message = 'Solo el docente que creó la sesión puede administrarla.'

    def has_object_permission(self, request, view, obj):
        session = obj if obj.__class__.__name__ == 'QuizSession' else obj.session
        return bool(request.user and request.user.is_authenticated and session.host_id == request.user.id)


class IsCaseAuthor(BasePermission):
    """Solo el docente autor de un Case puede editarlo o borrarlo — la lectura
    (listado/detalle) sigue siendo pública para todos los docentes y alumnos."""

    message = 'Solo el docente autor de este caso puede modificarlo.'

    def has_object_permission(self, request, view, obj):
        return bool(request.user and request.user.is_authenticated and obj.author_id == request.user.id)
