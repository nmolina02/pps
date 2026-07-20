import json
import re
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify

from cafe.models import Case, Topic
from cafe.serializers import CaseWriteSerializer

DEFAULT_FILE = Path(__file__).resolve().parent / 'data' / 'banco_casos_falla_so.md'

CASE_RE = re.compile(r'^## SO-\d+ - (?P<title>.+?)\s*$\n(?P<body>.*?)(?=^## SO-\d+ - |\Z)', re.DOTALL | re.MULTILINE)
FIELD_RE = {
    'tema': re.compile(r'\*\*Tema:\*\*\s*(.+?)(?=\n\*\*|\Z)', re.DOTALL),
    'scenario': re.compile(r'\*\*Escenario \(caso de falla\):\*\*\s*(.+?)(?=\n\*\*|\Z)', re.DOTALL),
    'guiding_questions': re.compile(r'\*\*Preguntas guía \(análisis\):\*\*\s*(.+?)(?=\n\*\*|\Z)', re.DOTALL),
    'theory': re.compile(r'\*\*Teoría \(formalización\):\*\*\s*(.+?)(?=\n\*\*|\Z)', re.DOTALL),
}
JSON_RE = re.compile(r'```json\s*(.*?)```', re.DOTALL)


def parse_bank(text):
    """Parsea el banco de casos en markdown a una lista de dicts con los campos
    que necesita `CaseWriteSerializer`. Es el único lugar que conoce el formato
    del .md — si el formato cambia, sólo hay que tocar esta función."""
    cases = []
    for m in CASE_RE.finditer(text):
        title = m.group('title').strip()
        body = m.group('body')

        fields = {}
        for name, pattern in FIELD_RE.items():
            field_match = pattern.search(body)
            if not field_match:
                raise CommandError(f'"{title}": no se encontró el campo "{name}"')
            fields[name] = field_match.group(1).strip()

        json_match = JSON_RE.search(body)
        if not json_match:
            raise CommandError(f'"{title}": no se encontró el bloque ```json``` del modelo visual')
        try:
            graphic_data = json.loads(json_match.group(1))
        except json.JSONDecodeError as exc:
            raise CommandError(f'"{title}": el JSON del modelo visual es inválido ({exc})') from exc

        cases.append({
            'title': title,
            'tema': fields['tema'],
            'scenario': fields['scenario'],
            'guiding_questions': fields['guiding_questions'],
            'theory': fields['theory'],
            'graphic_data': graphic_data,
        })
    return cases


def primary_tema(tema):
    """Temas compuestos ("Deadlock y concurrencia") mapean al primer segmento
    ("Deadlock") para no generar un Topic nuevo por cada combinación."""
    return tema.split(' y ')[0].strip()


# El banco de casos usa nombres de tema más finos que los Topic ya sembrados en
# la base (ej. "Memoria virtual" vs. el Topic existente "Memoria Virtual").
# Sin este mapeo, get_or_create crearía un Topic paralelo por cada variante de
# mayúsculas/redacción, fragmentando el mismo tema en dos filas — o peor, puede
# chocar por slug (mismo slug, `name` con distinta capitalización). Los temas
# que no aparecen acá son genuinamente nuevos (Hilos, Interrupciones, ...) y sí
# generan su propio Topic.
TEMA_ALIASES = {
    'Memoria virtual': 'Memoria Virtual',
    'Memoria real': 'Memoria',
    'File System': 'Filesystem',
    'Entrada/Salida': 'I/O',
    'Protección': 'Seguridad y Protección',
    'Sistema operativo': 'Syscalls',
    'Cambio de modo': 'Syscalls',
    'Arquitectura': 'Syscalls',
    'Boot Process': 'Arranque y Servicios',
    'Estados de proceso': 'Procesos',
    'Planificación de largo plazo': 'Planificación',
    'Monitores': 'Concurrencia',
    'Sincronización': 'Concurrencia',
}


def resolve_topic_name(tema):
    name = primary_tema(tema)
    return TEMA_ALIASES.get(name, name)


class Command(BaseCommand):
    help = 'Importa el banco de casos de falla (.md) como Case + CaseGraphic, creando los Topic que falten.'

    def add_arguments(self, parser):
        parser.add_argument('--file', default=str(DEFAULT_FILE), help='Ruta al .md del banco de casos.')
        parser.add_argument('--update', action='store_true', help='Si un caso con el mismo título ya existe, actualizarlo en vez de saltearlo.')
        parser.add_argument('--author', default='nico', help='Username al que se le asigna la autoría de los casos que se creen.')

    def handle(self, *args, **options):
        path = Path(options['file'])
        if not path.exists():
            raise CommandError(f'no existe el archivo: {path}')

        User = get_user_model()
        try:
            author = User.objects.get(username=options['author'])
        except User.DoesNotExist as exc:
            raise CommandError(f'no existe el usuario "{options["author"]}" — pasá --author con un username válido') from exc

        cases = parse_bank(path.read_text(encoding='utf-8'))
        self.stdout.write(f'{len(cases)} casos encontrados en {path.name}')

        created = skipped = updated = failed = 0
        for case_data in cases:
            tema_name = resolve_topic_name(case_data['tema'])
            topic, _ = Topic.objects.get_or_create(name=tema_name, defaults={'slug': slugify(tema_name)})

            existing = Case.objects.filter(title=case_data['title']).first()
            payload = {
                'topic': topic.id,
                'title': case_data['title'],
                'scenario': case_data['scenario'],
                'guiding_questions': case_data['guiding_questions'],
                'theory': case_data['theory'],
                'graphic_data': case_data['graphic_data'],
            }

            if existing and not options['update']:
                skipped += 1
                continue

            serializer = CaseWriteSerializer(instance=existing, data=payload)
            if not serializer.is_valid():
                self.stderr.write(f'"{case_data["title"]}": {serializer.errors}')
                failed += 1
                continue
            # El autor solo se fija al crear — un --update no debe reasignar
            # la autoría de un caso ya existente.
            serializer.save() if existing else serializer.save(author=author)
            updated += 1 if existing else 0
            created += 0 if existing else 1

        self.stdout.write(self.style.SUCCESS(
            f'creados: {created} · actualizados: {updated} · salteados (ya existían): {skipped} · fallidos: {failed}'
        ))
