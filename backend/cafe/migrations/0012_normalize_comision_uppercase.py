from django.db import migrations


def uppercase_comisiones(apps, schema_editor):
    Student = apps.get_model('cafe', 'Student')
    Quiz = apps.get_model('cafe', 'Quiz')

    for student in Student.objects.exclude(comision=''):
        normalized = student.comision.strip().upper()
        if normalized != student.comision:
            student.comision = normalized
            student.save(update_fields=['comision'])

    for quiz in Quiz.objects.exclude(shared_with_comisiones=[]):
        normalized = sorted({c.strip().upper() for c in quiz.shared_with_comisiones if c.strip()})
        if normalized != quiz.shared_with_comisiones:
            quiz.shared_with_comisiones = normalized
            quiz.save(update_fields=['shared_with_comisiones'])


class Migration(migrations.Migration):

    dependencies = [
        ('cafe', '0011_quiz_shared_with_comisiones_student_comision_and_more'),
    ]

    operations = [
        migrations.RunPython(uppercase_comisiones, migrations.RunPython.noop),
    ]
