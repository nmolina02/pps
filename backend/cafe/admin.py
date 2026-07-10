import csv
import io

from django.contrib import admin, messages
from django.shortcuts import redirect, render
from django.urls import path

from .forms import StudentCSVImportForm
from .models import (
    Answer,
    Case,
    Participant,
    Question,
    QuestionOption,
    QuizSession,
    SessionQuestion,
    Student,
    TeacherProfile,
    Topic,
)


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['legajo', 'full_name']
    search_fields = ['legajo', 'full_name']
    change_list_template = 'admin/cafe/student/change_list.html'

    def get_urls(self):
        custom = [
            path(
                'import-csv/',
                self.admin_site.admin_view(self.import_csv),
                name='cafe_student_import_csv',
            ),
        ]
        return custom + super().get_urls()

    def import_csv(self, request):
        if request.method == 'POST':
            form = StudentCSVImportForm(request.POST, request.FILES)
            if form.is_valid():
                created, updated, errors = self._process_csv(request.FILES['csv_file'])
                if created or updated:
                    messages.success(
                        request,
                        f'Importación completa: {created} alumnos nuevos, {updated} actualizados.',
                    )
                for error in errors[:10]:
                    messages.warning(request, error)
                if len(errors) > 10:
                    messages.warning(request, f'... y {len(errors) - 10} filas más con errores.')
                return redirect('admin:cafe_student_changelist')
        else:
            form = StudentCSVImportForm()
        return render(
            request, 'admin/cafe/student/import_csv.html', {'form': form, 'opts': self.model._meta}
        )

    def _process_csv(self, uploaded_file):
        raw = uploaded_file.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(raw))

        field_lookup = {(name or '').strip().lower(): name for name in (reader.fieldnames or [])}
        if not {'legajo', 'full_name'}.issubset(field_lookup):
            return 0, 0, ['El CSV debe tener columnas "legajo" y "full_name" en el encabezado.']

        created = updated = 0
        errors = []
        for line_number, row in enumerate(reader, start=2):
            legajo = (row.get(field_lookup['legajo']) or '').strip()
            full_name = (row.get(field_lookup['full_name']) or '').strip()
            if not legajo or not full_name:
                errors.append(f'Fila {line_number}: legajo o nombre vacío, se omitió.')
                continue
            _, was_created = Student.objects.update_or_create(
                legajo=legajo, defaults={'full_name': full_name}
            )
            created += int(was_created)
            updated += int(not was_created)
        return created, updated, errors


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


class QuestionOptionInline(admin.TabularInline):
    model = QuestionOption
    extra = 2


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ['title', 'topic', 'visual_model']
    list_filter = ['topic', 'visual_model']
    search_fields = ['title', 'scenario']
    prepopulated_fields = {'slug': ('title',)}


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'topic', 'case', 'question_type']
    list_filter = ['topic', 'question_type']
    search_fields = ['text']
    inlines = [QuestionOptionInline]


class SessionQuestionInline(admin.TabularInline):
    model = SessionQuestion
    extra = 1


@admin.register(QuizSession)
class QuizSessionAdmin(admin.ModelAdmin):
    list_display = ['code', 'topic', 'host', 'status', 'created_at']
    list_filter = ['status', 'topic']
    search_fields = ['code']
    inlines = [SessionQuestionInline]


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ['student', 'session', 'joined_at']
    search_fields = ['student__legajo', 'student__full_name']


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ['participant', 'session_question', 'is_correct', 'score', 'submitted_at']
    list_filter = ['is_correct']


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'avatar', 'theme']
