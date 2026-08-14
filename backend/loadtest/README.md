# Prueba de estrés de una sesión en vivo

Simula una clase real: un docente conduce un cuestionario mientras N alumnos
se unen, reciben el estado en vivo y contestan. Corre con
[Locust](https://locust.io/), sobre `locustfile.py` en esta misma carpeta.

## 1. Instalar

Necesitás Python 3 y pip. Desde `backend/`:

```bash
python -m venv venv
venv\Scripts\activate          # en Windows; en Linux/Mac: source venv/bin/activate
pip install -r loadtest/requirements.txt
```

## 2. Preparar datos de prueba en el ambiente que vas a probar

**Importante: nunca corras esto contra el backend que usan alumnos de
verdad.** Usá un ambiente de staging con su propia base, o coordiná una
ventana horaria donde no haya nadie más jugando.

Necesitás, en ese ambiente:

1. **Un cuestionario que le pertenezca al docente que vas a usar para loguear**
   (no alcanza con que se lo hayan compartido — para arrancarlo desde acá
   tiene que ser el dueño). Anotá su `QUIZ_ID` (aparece en la URL del editor,
   `/docente/cuestionarios/<ID>/editar`).
2. **Legajos de alumno ya cargados**, tantos como usuarios simulados vayas a
   correr (el script hace *join*, no los crea). Se cargan igual que
   cualquier legajo real, por CSV desde el admin o por `Student.objects.
   create(...)` vía shell — un rango tipo `LOAD0001`..`LOAD0050` o
   `9099900`..`9099949` funciona bien porque es fácil de identificar y
   borrar después.

## 3. Correr la prueba

Las variables (`DOCENTE_USERNAME`, `QUIZ_ID`, etc.) no van en ningún
archivo de configuración — se escriben en la misma terminal donde vas a
correr `locust`, justo antes, línea por línea. Quedan "seteadas" para esa
terminal mientras la tengas abierta.

Desde `backend/`, con el venv activado, elegí la que corresponda a tu
terminal:

**Linux / Mac / Git Bash:**

```bash
export DOCENTE_USERNAME=tu_usuario
export DOCENTE_PASSWORD=tu_clave
export QUIZ_ID=11
export LOCUST_LEGAJO_PREFIX=LOAD
export LOCUST_LEGAJO_COUNT=40

locust -f loadtest/locustfile.py --host https://tu-backend.onrender.com
```

**Windows, PowerShell:**

```powershell
$env:DOCENTE_USERNAME = "tu_usuario"
$env:DOCENTE_PASSWORD = "tu_clave"
$env:QUIZ_ID = "11"
$env:LOCUST_LEGAJO_PREFIX = "LOAD"
$env:LOCUST_LEGAJO_COUNT = "40"

locust -f loadtest/locustfile.py --host https://tu-backend.onrender.com
```

**Windows, cmd.exe (símbolo del sistema clásico):**

```bat
set DOCENTE_USERNAME=tu_usuario
set DOCENTE_PASSWORD=tu_clave
set QUIZ_ID=11
set LOCUST_LEGAJO_PREFIX=LOAD
set LOCUST_LEGAJO_COUNT=40

locust -f loadtest/locustfile.py --host https://tu-backend.onrender.com
```

Si cerrás la terminal, las variables se pierden y hay que volver a
escribirlas la próxima vez (no quedan guardadas en ningún lado).

Después abrís **http://localhost:8089**, elegís cuántos usuarios (= alumnos,
más 1 docente automático) y a qué velocidad se van a ir sumando ("spawn
rate"), y arrancás. Un solo usuario `DocenteUser` conduce toda la sesión sin
importar cuántos le pidas; el resto son todos `AlumnoUser`.

Para correrlo sin la interfaz web y que tire un resumen solo (útil para
mandarlo por chat o dejarlo corriendo en CI):

```bash
locust -f loadtest/locustfile.py --host https://tu-backend.onrender.com \
  --headless -u 41 -r 41 -t 5m --only-summary
```

(`-u` = usuarios totales incluyendo el docente, `-r` = por segundo al
arrancar, `-t` = duración máxima.)

## 4. Variables disponibles

| Variable | Requerida | Default | Qué hace |
|---|---|---|---|
| `DOCENTE_USERNAME` / `DOCENTE_PASSWORD` | sí | — | credenciales del docente que arranca la sesión |
| `QUIZ_ID` | sí | — | id del cuestionario a usar (tiene que pertenecerle al docente) |
| `LOCUST_LEGAJO_PREFIX` | no | `LOAD` | prefijo de los legajos a usar, ej. `LOAD0001`, `LOAD0002`... |
| `LOCUST_LEGAJO_COUNT` | no | `60` | cuántos legajos distintos generar/usar |
| `LOCUST_LEGAJO_START` | no | — | si tus legajos son un rango numérico (ej. `9099900`, `9099901`...) en vez de con prefijo, poné acá el primero y dejá `LOCUST_LEGAJO_PREFIX` de lado |
| `LOCUST_MODE` | no | `poll` | `poll` = sondeo HTTP tradicional (el mecanismo viejo); `sse` = conexión persistente por streaming (el mecanismo actual) |
| `LOCUST_QUESTION_SECONDS` | no | `20` | cuánto deja abierta cada pregunta el docente antes de revelarla |
| `LOCUST_BETWEEN_QUESTIONS_SECONDS` | no | `25` | pausa entre revelar una pregunta y arrancar la siguiente (simula la explicación del docente) |

Con `LOCUST_MODE=sse` y `LOCUST_MODE=poll` corridos con los mismos
parámetros podés comparar directamente el mecanismo nuevo contra el viejo.

## 5. Leer los resultados

Al terminar, además de la tabla de Locust (requests, fallos, latencias por
endpoint), el script imprime dos resúmenes propios:

- **Resumen de intentos de responder**: cuántas respuestas se aceptaron vs.
  se rechazaron por deadline vs. otros errores (429/500). Esto es lo que
  más importa — un alumno que respondió a tiempo y aun así quedó afuera es
  el síntoma real de que el servidor no dio abasto.
- **Reconexiones de stream** (solo en modo `sse`): cuántas veces se tuvo
  que reconectar cada tipo de conexión. Un número alto ahí es señal de que
  las conexiones se están cortando bajo carga.

## 6. Después de correrla

Borrá las sesiones y participantes de prueba que haya creado (desde el
admin de Django, filtrando por el código de sesión que uses o por el rango
de legajos de prueba) para no ensuciar leaderboards ni estadísticas reales.
