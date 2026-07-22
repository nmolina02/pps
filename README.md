# CAFE — Casos de Falla en Sistemas Operativos

**Plataforma web de enseñanza de Sistemas Operativos basada en incidentes reales**, desarrollada para la Cátedra de Sistemas Operativos — UTN FRBA.

CAFE reemplaza el enfoque tradicional "definición → ejemplo" por uno diagnóstico: cada unidad temática
arranca de un **caso de falla** (un deadlock, un proceso zombie, un mapa de memoria fragmentado, una
condición de carrera) que el alumno explora, diagnostica y contrasta con la teoría — y que el docente
puede además convertir en un **cuestionario interactivo en vivo** para evaluar la clase en tiempo real.

**Producción:** [cafe-so.vercel.app](https://cafe-so.vercel.app)

---

## Tabla de contenidos

- [Visión general](#visión-general)
- [Funcionalidades](#funcionalidades)
- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue en producción](#despliegue-en-producción)
- [Integración continua](#integración-continua)
- [Comandos de administración](#comandos-de-administración)
- [Seguridad](#seguridad)
- [Créditos](#créditos)

---

## Visión general

El sistema modela dos roles con necesidades y permisos distintos:

| Rol | Qué hace en la plataforma |
|---|---|
| **Alumno** | Explora el banco de casos de falla por tema, lee el diagnóstico y la teoría asociada, responde las preguntas conceptuales de cada caso, juega cuestionarios en vivo unido con su legajo, y repasa los cuestionarios que su docente compartió con la comisión, incluyendo revisión de respuestas correctas y de lo que marcó en su momento. |
| **Docente** | Redacta y publica casos de falla (con autoría y permisos de edición propios), arma cuestionarios de opción única/múltiple/completar/encuesta con imágenes, los comparte con otros docentes y con comisiones de alumnos para repaso, corre sesiones en vivo proyectando resultados en tiempo real, y consulta el historial y leaderboard de cada cuestionario. |

Todo el contenido pedagógico (casos, diagramas, preguntas) es **dato**, no código: se carga desde el
panel del docente o desde el admin, y se renderiza mediante un motor genérico de modelos visuales que
no requiere tocar el frontend para agregar un caso nuevo.

## Funcionalidades

### Banco de casos de falla

- Catálogo navegable por tema (`/topics/:slug`), con más de 60 casos documentados cubriendo procesos,
  planificación, memoria, sincronización, filesystem, E/S, arranque, interrupciones y arquitectura de
  kernel.
- Cada caso combina: escenario narrativo del incidente, preguntas guía de diagnóstico, formalización
  teórica, un modelo visual del mecanismo en falla, y preguntas de evaluación conceptual con
  justificación.
- **Motor de modelos visuales genérico y extensible**: cualquier JSON que un docente cargue, identificado
  por un campo `tipo`, se resuelve en cascada — tipo registrado → familia inferida por la forma del
  JSON → formato legacy sin `tipo` → JSON crudo legible — de forma que la previsualización nunca queda
  en blanco. Actualmente hay **66 tipos de caso registrados**, mapeados sobre **7 familias de
  diagramas** reutilizables:

  | Familia | Uso típico |
  |---|---|
  | `GraphDiagram` | Grafos de asignación de recursos, deadlocks, dependencias |
  | `StateDiagram` | Máquinas de estado de procesos/hilos, transiciones válidas e inválidas |
  | `GanttDiagram` | Líneas de tiempo de planificación de CPU, efecto convoy, prioridades |
  | `MapDiagram` | Mapas de memoria/particiones y posicionamiento en recta numérica (brazo de disco) |
  | `SequenceDiagram` | Interleaving, boot sequence, lost wakeup, livelock, protocolos de E/S |
  | `TableDiagram` | Comparaciones tabulares, colas multinivel, algoritmo del banquero |
  | `TreeDiagram` | Jerarquías padre/hijo, fork/COW/reparenting, antes-después |

- **Reproducción paso a paso**: las 7 familias soportan un modo de reproducción incremental (▶ / ⏸ /
  paso manual / reiniciar) que reconstruye el diagrama en el mismo orden causal del incidente, en vez de
  mostrar el resultado final de una — pensado para que el alumno vea *cómo* se llega al estado de falla,
  no solo el estado en sí.
- **Autoría y control de acceso**: cada caso tiene un docente autor; solo ese autor puede editarlo o
  borrarlo, aunque el caso sea visible para todos los docentes y alumnos en la vista general.
- Panel de gestión con búsqueda predictiva (insensible a acentos) y paginación de 20 elementos.

### Cuestionarios en vivo

- Alta de cuestionarios con preguntas de **opción única, opción múltiple, completar** y **encuesta**
  (sin puntaje, para pulso de opinión), cada una con puntaje, duración y margen de gracia configurables.
- Soporte de **imágenes** tanto en el enunciado de la pregunta como en las opciones de encuesta —
  redimensionadas a un data URI liviano en el navegador, sin depender de infraestructura de storage de
  archivos. Se pueden ampliar con un clic (lightbox) tanto en la vista del docente como del alumno.
- **Compartido entre docentes** por username, con verificación de existencia antes de agregarlo a la
  lista.
- Sesión en vivo con código de sala: el docente controla el avance pregunta por pregunta desde un
  dashboard con leaderboard y tally de respuestas en tiempo real; el alumno se une con su legajo y
  responde contra un cronómetro sincronizado con el servidor.
- Cálculo de puntaje por fracción de acierto (con crédito parcial en opción múltiple) y bonus por
  velocidad de respuesta.
- Historial y leaderboard por cuestionario, con opción de que el docente limpie su propio historial de
  partidas jugadas.
- **Compartido con comisiones para repaso**: el docente elige uno o varios cuestionarios y los comparte
  (o deja de compartir) con una o más comisiones de alumnos (ej. `K3054`); cualquier docente con el que
  el cuestionario haya sido compartido puede a su vez distribuirlo a sus propias comisiones. El alumno
  ve estos cuestionarios en una sección de repaso propia, con la totalidad de opciones de cada pregunta:
  las correctas en verde y, si ya lo jugó, marcada también la que él seleccionó; si no lo jugó, solo se
  muestran las correctas.

### Cuentas y perfiles

- Autenticación por token para docentes (`django-rest-framework` `TokenAuthentication`); los alumnos se
  identifican por legajo, cargado previamente por el admin del sistema (sea individualmente o por importación masiva
  vía CSV), con su comisión (ej. `K3054`) como dato asociado para el reparto de cuestionarios compartidos.
- Perfil con selección de avatar y tema claro/oscuro, persistente por usuario.
- Cambio de contraseña autogestionado por el docente (verificando la contraseña actual), sin depender de
  un flujo de recuperación por correo.

### Panel de administración

- Rediseñado con la misma identidad visual del frontend (tipografía, paleta y modo claro/oscuro reales,
  logo y favicon propios), responsive para uso desde dispositivos móviles.
- Importación masiva de alumnos por CSV, gestión de usuarios docentes, y acceso directo de vuelta al
  sitio público.

## Arquitectura

```
┌──────────────────┐        HTTPS / JSON         ┌───────────────────┐        SQL (TLS)        ┌─────────────┐
│   React + Vite    │ ───────────────────────────▶│   Django + DRF     │ ───────────────────────▶│  PostgreSQL │
│  (Vercel, SPA)     │◀─────────────────────────── │  (Render, gunicorn)│◀─────────────────────────│   (Neon)    │
└──────────────────┘      Token Authentication     └───────────────────┘   conexión persistente   └─────────────┘
```

- **Frontend**: SPA en React 19 + TypeScript, sin framework de estado externo — contextos de React para
  sesión de docente/alumno, hooks propios (`useApi`, `usePlayback`) para llamadas asíncronas y
  reproducción paso a paso. Enrutado con React Router; UI construida a mano sin librería de componentes,
  con una identidad visual propia ("terminal/hacker", tipografía monoespaciada, tema claro/oscuro).
- **Backend**: API REST con Django REST Framework, autenticación por token, permisos por objeto
  (autoría de casos, host de sesión), paginación, throttling por IP/usuario, y un manejador de
  excepciones centralizado que normaliza todos los errores a un contrato `{ error: { code, message,
  details } }`.
- **Persistencia**: PostgreSQL gestionado por Neon (serverless), con conexión persistente
  (`CONN_MAX_AGE`) desde el backend para minimizar la latencia del polling de las sesiones en vivo.
- **Comunicación en vivo**: sin WebSockets — el estado de la sesión se sincroniza por *polling* HTTP
  (cada 1-2 segundos), lo que simplifica la infraestructura de despliegue a costa de una latencia
  acotada pero perceptible, asumible para el tamaño de curso objetivo.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router 7 |
| Backend | Django 5.2, Django REST Framework, gunicorn, whitenoise |
| Base de datos | PostgreSQL (Neon) en producción, SQLite en desarrollo |
| Autenticación | DRF Token Authentication |
| Hosting | Vercel (frontend), Render (backend) |
| CI | GitHub Actions (lint + build de frontend; checks, migraciones y tests de backend) |

## Estructura del repositorio

```
pps/
├── backend/                   Proyecto Django
│   ├── config/                Settings, URLs raíz, WSGI/ASGI
│   ├── cafe/                  App principal (modelos, vistas, serializers, permisos, admin)
│   │   ├── management/commands/   Comando de importación del banco de casos
│   │   └── migrations/
│   ├── templates/admin/        Override de templates del admin (branding, favicon)
│   ├── render.yaml             Blueprint de despliegue en Render
│   └── requirements.txt
├── frontend/                  SPA en React + Vite
│   └── src/
│       ├── api/                Cliente HTTP y tipos de la API
│       ├── components/
│       │   └── visualModels/    Motor de modelos visuales (registry + families + playback)
│       ├── context/             Sesión de docente / alumno
│       ├── pages/               Una página por ruta
│       └── hooks/
└── .github/workflows/          CI de backend y frontend
```

## Puesta en marcha local

### Requisitos

- Python 3.11+
- Node.js 22+
- (Opcional) una base PostgreSQL — sin configurar, el backend usa SQLite automáticamente.

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env    # completar según necesidad, los defaults sirven para desarrollo

python manage.py migrate
python manage.py createsuperuser
python manage.py import_failure_cases --author <tu-username>   # carga el banco de 60+ casos
python manage.py runserver
```

### Frontend

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`, consumiendo la API en
`http://127.0.0.1:8000/api/v1`.

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción | Default en desarrollo |
|---|---|---|
| `SECRET_KEY` | Clave secreta de Django | placeholder inseguro (nunca usar en producción) |
| `DEBUG` | Modo debug | `True` |
| `ALLOWED_HOSTS` | Hosts permitidos | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | Orígenes exactos permitidos por CORS | `http://localhost:5173` |
| `CORS_ALLOWED_ORIGIN_REGEXES` | Orígenes por regex (previews de Vercel) | vacío |
| `CSRF_TRUSTED_ORIGINS` | Orígenes confiables para CSRF | vacío |
| `FRONTEND_URL` | URL del frontend (usada por "Ver sitio" en el admin) | `http://localhost:5173` |
| `DATABASE_URL` | Cadena de conexión a Postgres | sin definir → SQLite local |

En producción, `RENDER_EXTERNAL_HOSTNAME` lo define Render automáticamente y se suma solo a
`ALLOWED_HOSTS`/`CSRF_TRUSTED_ORIGINS`; no requiere configuración manual.

### Frontend (`frontend/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_BASE_URL` | Base de la API del backend (incluye `/api/v1`) |

## Despliegue en producción

| Servicio | Rol |
|---|---|
| **Vercel** | Build y hosting del frontend (Vite/SPA), con reescritura de rutas para React Router |
| **Render** | Hosting del backend Django (blueprint en [`backend/render.yaml`](backend/render.yaml)) |
| **Neon** | PostgreSQL serverless, alcanzable tanto desde Render como en tareas puntuales ejecutadas en local |

El pipeline de build de Render corre `collectstatic` y `migrate` en cada deploy; el `SECRET_KEY` de
producción se genera automáticamente y nunca se versiona. La aplicación falla explícitamente al arrancar
si detecta que quedó corriendo con la clave insegura de desarrollo (`ImproperlyConfigured`), como
salvaguarda ante una variable de entorno mal configurada.

## Integración continua

Dos workflows de GitHub Actions, cada uno disparado solo por cambios en su carpeta correspondiente:

- **`backend-ci.yml`**: `manage.py check`, chequeo de migraciones faltantes, y suite de tests.
- **`frontend-ci.yml`**: instalación de dependencias, lint (`oxlint`) y build de producción (`tsc` +
  `vite build`).

## Comandos de administración

| Comando | Descripción |
|---|---|
| `python manage.py import_failure_cases [--file RUTA] [--author USER] [--update]` | Importa (o re-importa) el banco de casos de falla desde el `.md` fuente |
| Importación de alumnos por CSV | Disponible desde el admin (`Students → Importar CSV`), con columnas `legajo`/`full_name` |

## Seguridad

- Contraseñas y tokens nunca se versionan; `.env` está excluido del control de versiones en ambos
  proyectos.
- Cookies y redirecciones seguras (`SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`,
  `SECURE_SSL_REDIRECT`) activas automáticamente cuando `DEBUG=False`.
- Permisos por objeto: solo el autor de un caso puede modificarlo o borrarlo; solo el host de una sesión
  puede controlarla.
- Throttling por IP/usuario en toda la API para mitigar abuso.

## Créditos

Desarrollado por **Nicolás Ariel Molina** para la **Cátedra de Sistemas Operativos — Universidad Tecnológica Nacional, Facultad Regional Buenos Aires (UTN FRBA)**.
