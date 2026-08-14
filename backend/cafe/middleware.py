from django.utils import timezone


class RequestArrivalTimeMiddleware:
    """Guarda en request.arrived_at el momento en que Django empezó a atender
    la request -- se usa para decidir deadlines (¿llegó a tiempo esta
    respuesta?) contra cuándo el alumno la mandó, no contra cuándo el
    servidor recién pudo procesarla. Bajo carga, una request puede quedar
    en cola varios segundos antes de llegar acá; sin esto, ese delay de cola
    se le cobraba injustamente al alumno como si hubiera contestado tarde."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.arrived_at = timezone.now()
        return self.get_response(request)
