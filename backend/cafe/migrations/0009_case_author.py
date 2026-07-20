from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_author(apps, schema_editor):
    """Los 60 casos existentes se cargaron antes de que hubiera autoría —
    se le asignan al usuario 'nico' (quien los cargó/importó)."""
    Case = apps.get_model('cafe', 'Case')
    User = apps.get_model(settings.AUTH_USER_MODEL)
    if not Case.objects.filter(author__isnull=True).exists():
        return
    nico = User.objects.get(username='nico')
    Case.objects.filter(author__isnull=True).update(author=nico)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('cafe', '0008_remove_case_visual_model_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='case',
            name='author',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name='cases', to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(backfill_author, noop_reverse),
        migrations.AlterField(
            model_name='case',
            name='author',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='cases', to=settings.AUTH_USER_MODEL),
        ),
    ]
