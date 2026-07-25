"""Tests de la importación masiva de alumnos por CSV desde el admin: tanto la
lógica de parseo (_process_csv) como el endpoint real detrás de login."""
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from cafe.admin import StudentAdmin
from cafe.models import Student

User = get_user_model()

# El admin real sirve estáticos con ManifestStaticFilesStorage (whitenoise),
# que resuelve los nombres hasheados desde el manifest que deja
# `collectstatic` — no corremos ese paso acá, así que cualquier template que
# use {% static %} (como el admin base) necesita el storage simple sin
# manifest para poder renderizar en un test.
TEST_STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


def _csv_file(content, name='alumnos.csv'):
    return SimpleUploadedFile(name, content.encode('utf-8'), content_type='text/csv')


class ProcessCsvUnitTests(TestCase):
    def setUp(self):
        self.student_admin = StudentAdmin(Student, admin.site)

    def test_creates_new_students(self):
        created, updated, errors = self.student_admin._process_csv(
            _csv_file('legajo,full_name\n111,Ada Lovelace\n222,Alan Turing\n')
        )
        self.assertEqual((created, updated, errors), (2, 0, []))
        self.assertEqual(Student.objects.count(), 2)

    def test_updates_existing_students_by_legajo(self):
        Student.objects.create(legajo='111', full_name='Nombre viejo')
        created, updated, errors = self.student_admin._process_csv(
            _csv_file('legajo,full_name\n111,Nombre nuevo\n')
        )
        self.assertEqual((created, updated), (0, 1))
        self.assertEqual(Student.objects.get(legajo='111').full_name, 'Nombre nuevo')

    def test_comision_column_is_optional(self):
        created, updated, errors = self.student_admin._process_csv(
            _csv_file('legajo,full_name\n111,Ada Lovelace\n')
        )
        self.assertEqual(Student.objects.get(legajo='111').comision, '')

    def test_comision_column_is_normalized_to_uppercase(self):
        self.student_admin._process_csv(
            _csv_file('legajo,full_name,comision\n111,Ada Lovelace,k3054\n')
        )
        self.assertEqual(Student.objects.get(legajo='111').comision, 'K3054')

    def test_missing_required_columns_returns_error(self):
        created, updated, errors = self.student_admin._process_csv(_csv_file('foo,bar\n1,2\n'))
        self.assertEqual((created, updated), (0, 0))
        self.assertTrue(errors)

    def test_rows_with_blank_legajo_or_name_are_skipped_with_an_error(self):
        created, updated, errors = self.student_admin._process_csv(
            _csv_file('legajo,full_name\n,Sin legajo\n111,\n222,Válido\n')
        )
        self.assertEqual((created, updated), (1, 0))
        self.assertEqual(len(errors), 2)

    def test_column_names_are_matched_case_insensitively(self):
        created, updated, errors = self.student_admin._process_csv(
            _csv_file('Legajo,Full_Name\n111,Ada Lovelace\n')
        )
        self.assertEqual(created, 1)


@override_settings(STORAGES=TEST_STORAGES)
class ImportCsvViewTests(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser(username='admin', password='admin-pass-123', email='a@a.com')
        self.client.login(username='admin', password='admin-pass-123')

    def test_requires_staff_login(self):
        self.client.logout()
        response = self.client.get('/admin/cafe/student/import-csv/')
        self.assertEqual(response.status_code, 302)

    def test_uploading_a_valid_csv_creates_students_and_redirects(self):
        response = self.client.post(
            '/admin/cafe/student/import-csv/',
            {'csv_file': _csv_file('legajo,full_name,comision\n111,Ada Lovelace,k3054\n')},
        )
        self.assertEqual(response.status_code, 302)
        student = Student.objects.get(legajo='111')
        self.assertEqual(student.comision, 'K3054')

    def test_non_csv_file_is_rejected_by_the_form(self):
        bad_file = SimpleUploadedFile('alumnos.txt', b'legajo,full_name\n111,Ada\n', content_type='text/plain')
        response = self.client.post('/admin/cafe/student/import-csv/', {'csv_file': bad_file})
        self.assertEqual(response.status_code, 200)  # re-renders the form with errors
        self.assertFalse(Student.objects.filter(legajo='111').exists())
