import random
import string

from .models import QuizSession

_CODE_ALPHABET = string.ascii_uppercase + string.digits
_CODE_LENGTH = 6


def generate_session_code():
    for _ in range(10):
        code = ''.join(random.choices(_CODE_ALPHABET, k=_CODE_LENGTH))
        if not QuizSession.objects.filter(code=code).exists():
            return code
    raise RuntimeError('No se pudo generar un código de sesión único.')
