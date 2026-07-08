from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        details = response.data if isinstance(response.data, dict) else {}
        message = details.pop('detail', None) or 'An error occurred'
        response.data = {
            'error': {
                'code': getattr(exc, 'default_code', exc.__class__.__name__.lower()),
                'message': message,
                'details': details,
            }
        }
    return response
