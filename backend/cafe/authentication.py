def authenticate_token(request):
    """Réplica manual y mínima de TokenAuthentication.authenticate_credentials,
    para las vistas de streaming (django.views.View planas, no APIView -- ver
    cafe/streaming.py para el porqué). El stream del docente sí manda el
    header Authorization de siempre (usa fetch + ReadableStream a mano, no
    EventSource, justo para poder seguir mandándolo)."""
    from rest_framework.authtoken.models import Token

    auth = request.headers.get('Authorization', '').split()
    if len(auth) != 2 or auth[0].lower() != 'token':
        return None
    token = Token.objects.select_related('user').filter(key=auth[1]).first()
    if token is None or not token.user.is_active:
        return None
    return token.user
