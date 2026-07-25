"""Tests de integración del banco de casos de falla: listado público, detalle,
alta/edición/borrado docente-only con permiso de autoría."""
from cafe.models import Case
from cafe.tests.base import ApiTestCase


class CaseListViewTests(ApiTestCase):
    def setUp(self):
        self.author = self.make_teacher('autor')
        self.topic_procesos = self.make_topic('Procesos', 'procesos')
        self.topic_memoria = self.make_topic('Memoria', 'memoria')
        self.case1 = self.make_case(self.author, self.topic_procesos, 'Zombie', 'zombie')
        self.case2 = self.make_case(self.author, self.topic_memoria, 'Fragmentación', 'fragmentacion')

    def test_list_is_public(self):
        response = self.client.get('/api/v1/cases/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_filter_by_topic(self):
        response = self.client.get('/api/v1/cases/', {'topic': 'memoria'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([c['slug'] for c in response.data], ['fragmentacion'])

    def test_mine_filter_requires_authentication(self):
        response = self.client.get('/api/v1/cases/', {'mine': 'true'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_mine_filter_only_returns_own_cases(self):
        other = self.make_teacher('otro_docente')
        self.make_case(other, self.topic_procesos, 'Otro caso', 'otro-caso')

        self.auth(self.author)
        response = self.client.get('/api/v1/cases/', {'mine': 'true'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual({c['slug'] for c in response.data}, {'zombie', 'fragmentacion'})


class CaseDetailViewTests(ApiTestCase):
    def test_detail_includes_questions_and_graphic(self):
        author = self.make_teacher()
        case = self.make_case(author)
        response = self.client.get(f'/api/v1/cases/{case.slug}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], case.title)
        self.assertEqual(response.data['author'], author.username)
        self.assertIn('questions', response.data)

    def test_unknown_slug_returns_404(self):
        response = self.client.get('/api/v1/cases/no-existe/')
        self.assertEqual(response.status_code, 404)


class CaseCreateViewTests(ApiTestCase):
    def setUp(self):
        self.topic = self.make_topic()
        self.author = self.make_teacher()

    def _payload(self, **overrides):
        base = {
            'topic': self.topic.id,
            'title': 'Deadlock circular',
            'scenario': 'Dos procesos se esperan mutuamente.',
            'guiding_questions': '¿Qué recurso falta liberar?',
            'theory': 'Condición de espera circular.',
        }
        base.update(overrides)
        return base

    def test_requires_authentication(self):
        response = self.client.post('/api/v1/docente/cases/', self._payload(), format='json')
        self.assertEqual(response.status_code, 401)

    def test_authenticated_teacher_can_create_a_case(self):
        self.auth(self.author)
        response = self.client.post('/api/v1/docente/cases/', self._payload(), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['author'], self.author.username)
        case = Case.objects.get(slug=response.data['slug'])
        self.assertEqual(case.author, self.author)

    def test_created_case_persists_graphic_data(self):
        self.auth(self.author)
        payload = self._payload(graphic_data={'tipo': 'resource_graph', 'nodes': []})
        response = self.client.post('/api/v1/docente/cases/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['graphic']['data'], {'tipo': 'resource_graph', 'nodes': []})


class CaseUpdateDeleteViewTests(ApiTestCase):
    def setUp(self):
        self.author = self.make_teacher('autor')
        self.other = self.make_teacher('otro')
        self.case = self.make_case(self.author)

    def test_author_can_update_their_case(self):
        self.auth(self.author)
        response = self.client.patch(
            f'/api/v1/docente/cases/{self.case.slug}/', {'title': 'Título nuevo'}, format='json'
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.case.refresh_from_db()
        self.assertEqual(self.case.title, 'Título nuevo')

    def test_non_author_cannot_update(self):
        self.auth(self.other)
        response = self.client.patch(
            f'/api/v1/docente/cases/{self.case.slug}/', {'title': 'Hackeado'}, format='json'
        )
        self.assertEqual(response.status_code, 403)
        self.case.refresh_from_db()
        self.assertNotEqual(self.case.title, 'Hackeado')

    def test_unauthenticated_cannot_update(self):
        response = self.client.patch(
            f'/api/v1/docente/cases/{self.case.slug}/', {'title': 'Hackeado'}, format='json'
        )
        self.assertEqual(response.status_code, 401)

    def test_author_can_delete_their_case(self):
        self.auth(self.author)
        response = self.client.delete(f'/api/v1/docente/cases/{self.case.slug}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Case.objects.filter(id=self.case.id).exists())

    def test_non_author_cannot_delete(self):
        self.auth(self.other)
        response = self.client.delete(f'/api/v1/docente/cases/{self.case.slug}/')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Case.objects.filter(id=self.case.id).exists())
