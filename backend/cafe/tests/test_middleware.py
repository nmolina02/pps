"""Test unitario de RequestArrivalTimeMiddleware — sin pasar por Django completo."""
from django.test import SimpleTestCase
from django.utils import timezone

from cafe.middleware import RequestArrivalTimeMiddleware


class RequestArrivalTimeMiddlewareTests(SimpleTestCase):
    def test_stamps_arrived_at_before_calling_get_response(self):
        seen = {}

        def get_response(request):
            seen['arrived_at'] = request.arrived_at
            return 'the response'

        class FakeRequest:
            pass

        middleware = RequestArrivalTimeMiddleware(get_response)
        request = FakeRequest()
        before = timezone.now()
        result = middleware(request)
        after = timezone.now()

        self.assertEqual(result, 'the response')
        self.assertTrue(before <= seen['arrived_at'] <= after)
