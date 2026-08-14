from rest_framework.throttling import AnonRateThrottle


class SessionPollThrottle(AnonRateThrottle):
    """El alumno pega /state/ sin login, así que hereda la identidad por IP
    de AnonRateThrottle -- pero en Render todos los alumnos comparten la
    misma IP (el proxy interno reenvía siempre desde 127.0.0.1), y esta
    vista se sondea cada 1-2s por dispositivo. Con el scope 'anon' genérico
    (120/min, compartido con el resto de la API) una clase entera agota el
    balde casi al instante. Este scope propio le da un techo calibrado para
    eso sin sacarle la protección del todo."""

    scope = 'session_poll'
