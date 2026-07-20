# Banco refinado de casos de falla - Sistemas Operativos

Material diseñado para clases teóricas con metodología de aprendizaje activo basada en casos de falla, preguntas guía, formalización conceptual y modelos visuales.

## Criterio de revisión aplicado

El banco original contenía 30 casos. En esta versión se mantuvieron y refinaron esos 30 casos, y se agregaron 30 casos nuevos para cubrir con mayor fidelidad los contenidos de los resúmenes actuales de la materia: repaso de arquitectura, interrupciones, modos de ejecución, syscalls, procesos, hilos, planificación, sincronización, deadlock, memoria real, memoria virtual, filesystem, FAT/EXT2, entrada/salida, planificación de disco, RAID y boot process.

La intención no es que cada caso sea un ejercicio de programación, sino un disparador de clase teórica: cada escenario presenta una falla o situación problemática que obliga al alumno a razonar el concepto antes de recibir la formalización.


## SO-001 - Deadlock en acceso a impresora compartida
**Tema:** Deadlock
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Deadlock: condiciones necesarias y prevención.

**Escenario (caso de falla):** Dos procesos, P1 y P2, deben usar una impresora y un escáner para completar un trabajo. P1 obtiene la impresora y luego solicita el escáner; P2 obtiene el escáner y luego solicita la impresora. Ninguno libera el recurso que ya posee y ambos quedan bloqueados indefinidamente.

**Preguntas guía (análisis):**
- ¿Qué recurso está asignado y qué recurso está siendo solicitado por cada proceso?
- ¿Cómo se verifica la espera circular en el grafo de asignación?
- ¿Cuál de las condiciones de Coffman se rompería si se impone un orden global de adquisición?
- ¿Por qué liberar un recurso antes de pedir el siguiente elimina la retención y espera?

**Teoría (formalización):** El caso cumple exclusión mutua, retención y espera, no apropiación y espera circular. Como las cuatro condiciones de Coffman son necesarias para que exista deadlock, romper cualquiera de ellas evita el interbloqueo. Una prevención simple es exigir un orden global de adquisición de recursos, por ejemplo solicitar siempre primero el escáner y después la impresora.

**Modelo visual:** Grafo de asignación de recursos

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "resource_allocation_graph",
  "procesos": [
    "P1",
    "P2"
  ],
  "recursos": [
    {
      "id": "R1",
      "nombre": "Impresora",
      "instancias": 1
    },
    {
      "id": "R2",
      "nombre": "Escáner",
      "instancias": 1
    }
  ],
  "asignaciones": [
    {
      "recurso": "R1",
      "proceso": "P1"
    },
    {
      "recurso": "R2",
      "proceso": "P2"
    }
  ],
  "solicitudes": [
    {
      "proceso": "P1",
      "recurso": "R2"
    },
    {
      "proceso": "P2",
      "recurso": "R1"
    }
  ],
  "ciclo_detectado": [
    "P1",
    "R2",
    "P2",
    "R1",
    "P1"
  ],
  "condiciones_coffman": [
    "exclusion_mutua",
    "retencion_y_espera",
    "no_apropiacion",
    "espera_circular"
  ],
  "estrategia_prevencion": "orden_global_de_recursos"
}
```

**Notas de revisión:**
- Se enfocó el caso directamente en Deadlock y no solo en procesos.
- Se agregó lectura explícita del grafo: asignaciones, solicitudes y ciclo.
- Se reforzó la relación entre prevención y condiciones de Coffman.

## SO-002 - Starvation de procesos de baja prioridad
**Tema:** Planificación
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Planificación: prioridades, starvation y aging.

**Escenario (caso de falla):** Un sistema usa planificación por prioridades absolutas. Las tareas críticas reciben prioridad alta y las tareas de mantenimiento prioridad baja. Como llegan tareas críticas de forma continua, los procesos de mantenimiento permanecen en Ready durante mucho tiempo, pero nunca son seleccionados por el planificador.

**Preguntas guía (análisis):**
- ¿El proceso de baja prioridad está bloqueado o listo?
- ¿Por qué esto es starvation y no deadlock?
- ¿Qué métrica de planificación se degrada para el proceso postergado?
- ¿Cómo modificaría el aging la prioridad del proceso que espera?

**Teoría (formalización):** La starvation o inanición ocurre cuando un proceso elegible no obtiene CPU durante un tiempo indefinido por la política de planificación. El sistema sigue progresando, por eso no es deadlock. Una solución habitual es aging: aumentar gradualmente la prioridad de los procesos que acumulan tiempo de espera.

**Modelo visual:** Cola de listos con prioridades y aging

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "priority_queue_aging",
  "politica_inicial": "prioridades_absolutas_sin_aging",
  "procesos": [
    {
      "id": "P_mant",
      "prioridad": 1,
      "estado": "ready",
      "espera": 30
    },
    {
      "id": "P_crit1",
      "prioridad": 9,
      "estado": "running"
    },
    {
      "id": "P_crit2",
      "prioridad": 8,
      "estado": "ready"
    }
  ],
  "problema": "P_mant permanece listo pero no ejecuta",
  "metrica_afectada": "tiempo_de_espera",
  "correccion": {
    "tecnica": "aging",
    "regla": "+1 prioridad cada 5 unidades de espera",
    "resultado": "el proceso postergado eventualmente supera el umbral de selección"
  }
}
```

**Notas de revisión:**
- Se aclaró que el proceso está Ready, no Blocked.
- Se vinculó con métricas de planificación y prioridades absolutas.
- Se incorporó aging como mecanismo correctivo.

## SO-003 - Proceso zombie por falta de wait()
**Tema:** Procesos
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Procesos: finalización, exit(), wait() y estados Linux.

**Escenario (caso de falla):** Un servidor crea procesos hijos para atender solicitudes. Los hijos terminan correctamente con exit(), pero el padre nunca ejecuta wait() ni waitpid() para recuperar el estado de salida. Con el tiempo, la tabla de procesos acumula entradas en estado zombie.

**Preguntas guía (análisis):**
- ¿Por qué un proceso finalizado puede seguir teniendo una entrada en la tabla de procesos?
- ¿Qué parte se conserva y qué recursos ya fueron liberados?
- ¿Qué responsabilidad tiene el padre frente al estado de salida del hijo?
- ¿Por qué enviar kill al zombie no corrige el error de diseño del padre?

**Teoría (formalización):** Un zombie no está ejecutando ni consumiendo CPU: ya terminó, liberó sus recursos principales, pero conserva información mínima en la tabla de procesos para que el padre recupere su código de salida. La corrección consiste en que el padre invoque wait()/waitpid() o maneje SIGCHLD adecuadamente.

**Modelo visual:** Árbol de procesos y tabla de procesos

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "process_tree_zombies",
  "padre": {
    "pid": 100,
    "nombre": "servidor",
    "estado": "running"
  },
  "hijos": [
    {
      "pid": 101,
      "estado": "zombie",
      "exit_code": 0
    },
    {
      "pid": 102,
      "estado": "zombie",
      "exit_code": 0
    }
  ],
  "tabla_procesos": {
    "entradas_zombie": 2,
    "dato_conservado": "pid_ppid_exit_code_estado"
  },
  "accion_correctiva": "waitpid(-1, ...) en el padre o handler SIGCHLD"
}
```

**Notas de revisión:**
- Se diferenció zombie de proceso bloqueado o vivo.
- Se agregó la idea de información mínima retenida en la tabla de procesos.
- Se sumó SIGCHLD como alternativa conceptual.

## SO-004 - Proceso huérfano adoptado por el sistema
**Tema:** Procesos
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Procesos hijos, terminación y adopción por init/systemd.

**Escenario (caso de falla):** Un proceso padre crea un hijo para ejecutar una tarea larga y luego finaliza antes de que el hijo termine. El hijo no se convierte en zombie: continúa ejecutándose, pero su PPID cambia porque el sistema lo reasigna a un proceso especial de usuario, como init/systemd.

**Preguntas guía (análisis):**
- ¿Qué diferencia hay entre un proceso huérfano y un proceso zombie?
- ¿Por qué el hijo puede seguir ejecutándose aunque el padre haya terminado?
- ¿Qué rol cumple init/systemd en este escenario?
- ¿En qué casos la terminación en cascada cambiaría el resultado?

**Teoría (formalización):** Un proceso huérfano es un proceso cuyo padre terminó antes que él. En sistemas Unix-like, el sistema reasigna su paternidad para que pueda ser recolectado al finalizar. A diferencia del zombie, el huérfano sigue ejecutándose y conserva sus recursos hasta terminar.

**Modelo visual:** Árbol de procesos antes y después

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "process_reparenting",
  "antes": {
    "relaciones": [
      {
        "padre": 1,
        "hijo": 200
      },
      {
        "padre": 200,
        "hijo": 201
      }
    ],
    "estados": {
      "200": "running",
      "201": "running"
    }
  },
  "evento": "termina PID 200",
  "despues": {
    "relaciones": [
      {
        "padre": 1,
        "hijo": 201
      }
    ],
    "estados": {
      "201": "running"
    }
  },
  "conceptos": [
    "PPID",
    "orphan_process",
    "reparenting"
  ]
}
```

**Notas de revisión:**
- Se eliminó ambigüedad entre huérfano y zombie.
- Se incorporó PPID y reasignación de paternidad.
- Se agregó la variante de terminación en cascada como contraste.

## SO-005 - Efecto convoy en planificación FCFS/FIFO
**Tema:** Planificación
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Planificación: FCFS/FIFO, criterios y ráfagas CPU/E/S.

**Escenario (caso de falla):** Un proceso CPU-bound de ráfaga larga llega primero a la cola de Ready. Detrás de él llegan varios procesos interactivos de ráfagas cortas. Como la política FCFS/FIFO no desaloja, los procesos cortos esperan mucho aunque podrían terminar rápido.

**Preguntas guía (análisis):**
- ¿Por qué una política justa por orden de llegada puede dar mala experiencia al usuario?
- ¿Qué diferencia hay entre tiempo de espera, retorno y respuesta?
- ¿Por qué los procesos I/O-bound o interactivos sufren más el efecto convoy?
- ¿Cómo cambiaría el Gantt con Round Robin o SJF?

**Teoría (formalización):** FCFS/FIFO minimiza overhead y respeta orden de llegada, pero puede generar efecto convoy: un proceso largo retiene la CPU y aumenta la espera de muchos procesos cortos. Esto degrada especialmente el tiempo de respuesta percibido. Algoritmos con desalojo o con preferencia por ráfagas cortas pueden mejorar el caso.

**Modelo visual:** Diagrama de Gantt comparativo

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "gantt_comparativo",
  "procesos": [
    {
      "id": "P1",
      "tipo": "CPU-bound",
      "llegada": 0,
      "cpu": 20
    },
    {
      "id": "P2",
      "tipo": "interactivo",
      "llegada": 1,
      "cpu": 2
    },
    {
      "id": "P3",
      "tipo": "interactivo",
      "llegada": 2,
      "cpu": 1
    },
    {
      "id": "P4",
      "tipo": "interactivo",
      "llegada": 3,
      "cpu": 2
    }
  ],
  "fcfs": [
    {
      "p": "P1",
      "ini": 0,
      "fin": 20
    },
    {
      "p": "P2",
      "ini": 20,
      "fin": 22
    },
    {
      "p": "P3",
      "ini": 22,
      "fin": 23
    },
    {
      "p": "P4",
      "ini": 23,
      "fin": 25
    }
  ],
  "problema": "altos tiempos de espera para procesos cortos",
  "alternativas": [
    "Round Robin",
    "SJF/SRTF"
  ]
}
```

**Notas de revisión:**
- Se vinculó el caso con CPU-bound/I/O-bound.
- Se agregó comparación con alternativas de planificación.
- Se reforzó la diferencia entre equidad formal y respuesta percibida.

## SO-006 - Quantum demasiado pequeño en Round Robin
**Tema:** Planificación
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Planificación: Round Robin y dispatcher.

**Escenario (caso de falla):** Un sistema usa Round Robin con quantum de 1 ms y un cambio de contexto de 0,2 ms. Los procesos responden rápido, pero el rendimiento global baja porque el sistema invierte una fracción importante del tiempo en dispatcher y context switch.

**Preguntas guía (análisis):**
- ¿Qué mejora y qué empeora al achicar el quantum?
- ¿Qué costo introduce cada cambio de contexto?
- ¿Por qué un quantum muy grande se parece a FCFS?
- ¿Cómo se relaciona la latencia del dispatcher con el overhead total?

**Teoría (formalización):** Round Robin reparte CPU en turnos, útil para tiempo compartido. Si el quantum es muy pequeño, crece la cantidad de cambios de contexto y el overhead. Si es muy grande, la política pierde interactividad y se aproxima a FCFS. El quantum debe equilibrar tiempo de respuesta y eficiencia.

**Modelo visual:** Línea de tiempo Round Robin con overhead

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "round_robin_overhead",
  "quantum": 1,
  "cambio_contexto": 0.2,
  "procesos": [
    {
      "id": "P1",
      "cpu": 5
    },
    {
      "id": "P2",
      "cpu": 5
    },
    {
      "id": "P3",
      "cpu": 5
    }
  ],
  "secuencia": [
    "P1",
    "CS",
    "P2",
    "CS",
    "P3",
    "CS",
    "P1",
    "CS",
    "P2",
    "CS",
    "P3"
  ],
  "riesgo": "overhead_alto",
  "comparacion": {
    "quantum_4": "menos_overhead_pero_menor_interactividad"
  }
}
```

**Notas de revisión:**
- Se incorporó latencia del dispatcher y overhead.
- Se mejoró la explicación del extremo quantum grande.
- Se dejó un JSON más apto para comparar escenarios.

## SO-007 - Condición de carrera en actualización de saldo
**Tema:** Concurrencia
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Sincronización: condición de carrera y sección crítica.

**Escenario (caso de falla):** Dos hilos del mismo proceso actualizan una cuenta compartida. Ambos leen saldo=1000, cada uno suma 100 y luego escriben. El resultado final queda en 1100 en vez de 1200 porque la operación leer-modificar-escribir fue intercalada.

**Preguntas guía (análisis):**
- ¿Cuál es la sección crítica?
- ¿Por qué la operación saldo = saldo + 100 no es atómica?
- ¿Qué condición de Bernstein se viola?
- ¿Qué primitiva evitaría que ambos hilos entren a la sección crítica simultáneamente?

**Teoría (formalización):** Una condición de carrera aparece cuando el resultado depende del intercalado de accesos concurrentes a datos compartidos. La actualización compuesta leer-modificar-escribir debe protegerse mediante exclusión mutua. Semáforos binarios, mutex o monitores pueden resolver el problema si se usan correctamente.

**Modelo visual:** Intercalado de instrucciones

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "interleaving_trace",
  "variable": "saldo",
  "inicial": 1000,
  "hilos": [
    "T1",
    "T2"
  ],
  "pasos": [
    [
      "T1",
      "read",
      1000
    ],
    [
      "T2",
      "read",
      1000
    ],
    [
      "T1",
      "compute",
      1100
    ],
    [
      "T2",
      "compute",
      1100
    ],
    [
      "T1",
      "write",
      1100
    ],
    [
      "T2",
      "write",
      1100
    ]
  ],
  "esperado": 1200,
  "obtenido": 1100,
  "seccion_critica": [
    "read",
    "compute",
    "write"
  ],
  "solucion": "mutex"
}
```

**Notas de revisión:**
- Se agregó relación con condiciones de Bernstein.
- Se explicitó que la operación compuesta no es atómica.
- Se mantuvo un modelo visual simple para discusión en clase.

## SO-008 - Pérdida de señal en productor-consumidor
**Tema:** Concurrencia
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Sincronización: semáforos, monitores y productor-consumidor.

**Escenario (caso de falla):** Un consumidor verifica que el buffer está vacío y está por dormir. Antes de que quede registrado como esperando, el productor inserta un elemento y emite una señal. La señal se pierde; luego el consumidor duerme aunque el buffer ya tiene datos.

**Preguntas guía (análisis):**
- ¿Por qué se pierde la señal?
- ¿Qué operación debería ser atómica respecto del mutex?
- ¿Por qué no alcanza con verificar la condición fuera de la región protegida?
- ¿Cómo se evita el problema con semáforos o variables de condición?

**Teoría (formalización):** El lost wakeup ocurre cuando la verificación de una condición y el bloqueo no están coordinados atómicamente. La solución exige proteger la condición compartida con mutex y usar semáforos o variables de condición de forma tal que no se pierdan notificaciones entre el chequeo y la espera.

**Modelo visual:** Secuencia temporal productor-consumidor

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "lost_wakeup_timeline",
  "buffer": {
    "capacidad": 1,
    "estado_inicial": "vacio"
  },
  "eventos": [
    {
      "t": 1,
      "actor": "Consumidor",
      "accion": "chequea vacío"
    },
    {
      "t": 2,
      "actor": "Productor",
      "accion": "inserta item"
    },
    {
      "t": 3,
      "actor": "Productor",
      "accion": "signal"
    },
    {
      "t": 4,
      "actor": "Consumidor",
      "accion": "sleep"
    }
  ],
  "fallo": "señal_perdida",
  "correccion": "mutex + condición evaluada en bucle o semáforos contador"
}
```

**Notas de revisión:**
- Se hizo explícito el problema de atomicidad.
- Se agregó que la condición debe evaluarse en bucle/protegida.
- Se adaptó el caso a discusión sobre semáforos y monitores.

## SO-009 - Inversión de prioridades con mutex compartido
**Tema:** Concurrencia y planificación
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Sincronización: inversión de prioridades.

**Escenario (caso de falla):** Un hilo de baja prioridad toma un mutex. Luego llega un hilo de alta prioridad que necesita ese mutex y queda bloqueado. Mientras tanto, hilos de prioridad media ejecutan y evitan que el hilo de baja prioridad avance para liberar el recurso.

**Preguntas guía (análisis):**
- ¿Por qué el hilo de alta prioridad queda esperando indirectamente a los de prioridad media?
- ¿Qué diferencia hay entre bloqueo normal e inversión de prioridades?
- ¿Cómo actúa la herencia de prioridad?
- ¿Por qué este caso es grave en sistemas de tiempo real?

**Teoría (formalización):** La inversión de prioridades ocurre cuando un hilo de alta prioridad queda bloqueado por uno de baja prioridad, y tareas de prioridad intermedia impiden que el de baja prioridad libere el recurso. La herencia de prioridad eleva temporalmente la prioridad del poseedor del mutex.

**Modelo visual:** Línea temporal de prioridades

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "priority_inversion",
  "hilos": [
    {
      "id": "L",
      "prioridad": "baja"
    },
    {
      "id": "M",
      "prioridad": "media"
    },
    {
      "id": "H",
      "prioridad": "alta"
    }
  ],
  "recurso": "mutex_R",
  "eventos": [
    [
      "t0",
      "L toma R"
    ],
    [
      "t1",
      "H solicita R y bloquea"
    ],
    [
      "t2",
      "M ejecuta y desplaza a L"
    ],
    [
      "t3",
      "H sigue bloqueado"
    ]
  ],
  "solucion": {
    "tecnica": "priority_inheritance",
    "efecto": "L hereda prioridad alta hasta liberar R"
  }
}
```

**Notas de revisión:**
- Se conectó con planificación por prioridades y tiempo real.
- Se explicitó la espera indirecta.
- Se fortaleció el modelo de herencia de prioridad.

## SO-010 - Filósofos cenando con toma simultánea de tenedores
**Tema:** Deadlock
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Deadlock: ejemplos y prevención.

**Escenario (caso de falla):** Cinco hilos representan filósofos. Cada uno toma primero el tenedor izquierdo y luego intenta tomar el derecho. Si todos toman el izquierdo al mismo tiempo, nadie puede tomar el derecho y todos quedan esperando indefinidamente.

**Preguntas guía (análisis):**
- ¿Qué representa cada tenedor en términos de recursos?
- ¿Dónde se observa la espera circular?
- ¿Qué condición se rompe si un árbitro limita a cuatro filósofos intentando comer?
- ¿Qué cambia si uno de los filósofos invierte el orden de toma?

**Teoría (formalización):** El problema de los filósofos cenando modela deadlock y starvation. El deadlock aparece cuando todos retienen un recurso y esperan otro en ciclo. Se puede prevenir imponiendo orden de adquisición, usando un árbitro o permitiendo como máximo N-1 filósofos compitiendo simultáneamente.

**Modelo visual:** Grafo circular de recursos

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "dining_philosophers",
  "filosofos": [
    "F0",
    "F1",
    "F2",
    "F3",
    "F4"
  ],
  "tenedores": [
    "T0",
    "T1",
    "T2",
    "T3",
    "T4"
  ],
  "asignaciones": [
    [
      "T0",
      "F0"
    ],
    [
      "T1",
      "F1"
    ],
    [
      "T2",
      "F2"
    ],
    [
      "T3",
      "F3"
    ],
    [
      "T4",
      "F4"
    ]
  ],
  "solicitudes": [
    [
      "F0",
      "T1"
    ],
    [
      "F1",
      "T2"
    ],
    [
      "F2",
      "T3"
    ],
    [
      "F3",
      "T4"
    ],
    [
      "F4",
      "T0"
    ]
  ],
  "estado": "deadlock",
  "prevenciones": [
    "arbitro",
    "orden_global",
    "limitar_a_N_menos_1"
  ]
}
```

**Notas de revisión:**
- Se reforzó la lectura del ciclo.
- Se agregaron varias estrategias de prevención.
- Se mantuvo como caso clásico para clase teórica.

## SO-011 - Starvation de escritores en lectores-escritores
**Tema:** Concurrencia
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Sincronización: lectores-escritores y equidad.

**Escenario (caso de falla):** Un recurso compartido permite múltiples lectores simultáneos o un único escritor exclusivo. Como entran lectores constantemente, siempre hay lectores activos y los escritores nunca obtienen acceso.

**Preguntas guía (análisis):**
- ¿Por qué no hay deadlock si el sistema sigue atendiendo lectores?
- ¿Qué política genera starvation de escritores?
- ¿Qué pasaría si se bloquea el ingreso de nuevos lectores cuando hay escritores esperando?
- ¿Cómo equilibrar concurrencia y equidad?

**Teoría (formalización):** El problema lectores-escritores muestra el conflicto entre maximizar concurrencia de lectura y garantizar progreso de escritura. Si se prioriza siempre a lectores, los escritores pueden sufrir starvation. Una política justa puede cerrar la entrada a nuevos lectores cuando hay escritores esperando.

**Modelo visual:** Cola de lectores y escritores

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "readers_writers",
  "politica": "prioridad_lectores",
  "eventos": [
    [
      "t0",
      "R1 entra"
    ],
    [
      "t1",
      "W1 espera"
    ],
    [
      "t2",
      "R2 entra"
    ],
    [
      "t3",
      "R3 entra"
    ],
    [
      "t4",
      "W1 sigue esperando"
    ]
  ],
  "problema": "starvation_escritor",
  "correccion": "bloquear nuevos lectores si hay escritores esperando"
}
```

**Notas de revisión:**
- Se contrastó starvation con deadlock.
- Se agregó criterio de equidad.
- Se preparó para discusión sobre monitores/semáforos.

## SO-012 - Thrashing por exceso de multiprogramación
**Tema:** Memoria virtual
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Memoria virtual: thrashing, conjunto de trabajo y swapping.

**Escenario (caso de falla):** El sistema aumenta el grado de multiprogramación para mejorar la utilización de CPU. Al principio mejora, pero luego la CPU queda ociosa y el disco permanece saturado atendiendo page faults. Los procesos no conservan en memoria su conjunto de trabajo.

**Preguntas guía (análisis):**
- ¿Por qué agregar procesos puede empeorar el rendimiento?
- ¿Qué relación hay entre working set, page faults y utilización de CPU?
- ¿Qué rol podría cumplir el planificador de mediano plazo?
- ¿Cómo distinguir thrashing de un programa simplemente CPU-bound?

**Teoría (formalización):** El thrashing aparece cuando los procesos no tienen suficientes frames para su working set y pasan más tiempo paginando que ejecutando. El planificador de mediano plazo puede reducir el grado de multiprogramación suspendiendo procesos. También se pueden usar políticas basadas en conjunto de trabajo.

**Modelo visual:** Curva multiprogramación vs utilización de CPU

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "thrashing_curve",
  "eje_x": "grado_multiprogramacion",
  "eje_y": "utilizacion_cpu",
  "puntos": [
    {
      "procesos": 2,
      "cpu": 35,
      "page_faults": "bajo"
    },
    {
      "procesos": 4,
      "cpu": 70,
      "page_faults": "moderado"
    },
    {
      "procesos": 6,
      "cpu": 88,
      "page_faults": "alto_controlado"
    },
    {
      "procesos": 8,
      "cpu": 40,
      "page_faults": "muy_alto"
    },
    {
      "procesos": 10,
      "cpu": 15,
      "page_faults": "critico"
    }
  ],
  "zona_thrashing_desde": 8,
  "accion_correctiva": [
    "swap_out",
    "reducir_multiprogramacion",
    "controlar_working_set"
  ]
}
```

**Notas de revisión:**
- Se conectó con planificador de mediano plazo y swapping.
- Se reforzó working set.
- Se aclaró por qué la CPU puede quedar ociosa aunque haya muchos procesos.

## SO-013 - Page fault interpretado como error fatal
**Tema:** Memoria virtual
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Memoria virtual: paginación bajo demanda y atención de page fault.

**Escenario (caso de falla):** Un proceso accede a una página válida de su espacio de direcciones, pero la página no está presente en RAM. La CPU genera una excepción de page fault. El alumno interpreta que el programa falló, aunque el sistema operativo puede cargar la página y reintentar la instrucción.

**Preguntas guía (análisis):**
- ¿Todo page fault implica terminar el proceso?
- ¿Qué diferencia hay entre página válida-no presente y dirección inválida?
- ¿Qué pasos realiza el SO para atender un page fault recuperable?
- ¿Por qué la instrucción debe reintentarse después de cargar la página?

**Teoría (formalización):** Un page fault puede ser un evento normal de paginación bajo demanda. El SO revisa la tabla de páginas, valida que la referencia pertenezca al proceso y carga la página desde disco. Si la dirección es inválida o viola permisos, entonces sí ocurre una falla de protección.

**Modelo visual:** Secuencia de atención de page fault

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "page_fault_sequence",
  "referencia": {
    "vpn": 12,
    "presente": false,
    "valida": true,
    "permiso": "R"
  },
  "pasos": [
    "MMU detecta presente=0",
    "trap al SO",
    "validar página",
    "seleccionar frame",
    "leer página de swap/archivo",
    "actualizar tabla",
    "reiniciar instrucción"
  ],
  "resultado": "continua_ejecucion",
  "contraste": "segmentation_fault_si_valida=false_o_permiso_incorrecto"
}
```

**Notas de revisión:**
- Se precisó la diferencia entre page fault recuperable y violación de protección.
- Se alineó con paginación bajo demanda.
- Se mejoró el flujo paso a paso.

## SO-014 - Anomalía de Belady con reemplazo FIFO
**Tema:** Memoria virtual
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Memoria virtual: algoritmos de sustitución FIFO, LRU y óptimo.

**Escenario (caso de falla):** Al simular reemplazo FIFO, los alumnos esperan que aumentar marcos reduzca siempre los fallos. Sin embargo, con una secuencia de referencias particular, pasar de 3 a 4 marcos aumenta la cantidad de fallos.

**Preguntas guía (análisis):**
- ¿Por qué más marcos no garantiza menos fallos con FIFO?
- ¿Qué información ignora FIFO sobre el uso reciente?
- ¿Qué distingue a FIFO de LRU o del óptimo?
- ¿Para qué sirve comparar con el algoritmo óptimo si no es implementable?

**Teoría (formalización):** La anomalía de Belady muestra que FIFO puede producir más page faults al aumentar la memoria asignada. FIFO reemplaza por antigüedad de llegada, no por localidad temporal. Algoritmos como LRU se aproximan mejor a la localidad, mientras el óptimo sirve como referencia teórica.

**Modelo visual:** Tabla de reemplazo de páginas

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "page_replacement_table",
  "algoritmo": "FIFO",
  "referencias": [
    1,
    2,
    3,
    4,
    1,
    2,
    5,
    1,
    2,
    3,
    4,
    5
  ],
  "simulaciones": [
    {
      "marcos": 3,
      "fallos": 9
    },
    {
      "marcos": 4,
      "fallos": 10
    }
  ],
  "concepto": "Belady_anomaly",
  "comparar_con": [
    "LRU",
    "Optimo",
    "Clock"
  ]
}
```

**Notas de revisión:**
- Se agregó comparación con óptimo y LRU.
- Se aclaró el criterio FIFO.
- Se dejó explícito el valor didáctico de la anomalía.

## SO-015 - Fragmentación externa en asignación contigua
**Tema:** Memoria real
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Memoria real: asignación contigua y fragmentación.

**Escenario (caso de falla):** Un sistema usa particiones dinámicas contiguas. Tras cargar y liberar procesos, quedan varios huecos pequeños. La memoria libre total alcanza para un nuevo proceso, pero ningún hueco individual es suficientemente grande.

**Preguntas guía (análisis):**
- ¿Por qué falla la asignación aunque la memoria libre total alcance?
- ¿Qué diferencia hay entre fragmentación externa e interna?
- ¿Qué costo tiene compactar memoria?
- ¿Por qué la paginación reduce este problema?

**Teoría (formalización):** La fragmentación externa ocurre cuando el espacio libre está dividido en huecos no contiguos. En asignación contigua, un proceso necesita un bloque continuo, por lo que puede fallar aunque la suma libre sea suficiente. Compactar mueve procesos y requiere reasignación; paginación permite asignación no contigua.

**Modelo visual:** Mapa de memoria con huecos

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "memory_map_external_fragmentation",
  "unidad": "MB",
  "segmentos": [
    [
      "0-100",
      "P1"
    ],
    [
      "100-140",
      "Libre"
    ],
    [
      "140-260",
      "P2"
    ],
    [
      "260-310",
      "Libre"
    ],
    [
      "310-430",
      "P3"
    ],
    [
      "430-500",
      "Libre"
    ]
  ],
  "solicitud": {
    "proceso": "P4",
    "tam": 120
  },
  "libre_total": 160,
  "bloque_maximo": 70,
  "resultado": "fallo_por_fragmentacion_externa"
}
```

**Notas de revisión:**
- Se especificó particiones dinámicas contiguas.
- Se agregó bloque máximo libre.
- Se conectó compactación con reasignación.

## SO-016 - Fragmentación interna en particiones fijas
**Tema:** Memoria real
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Memoria real: particiones fijas y fragmentación interna.

**Escenario (caso de falla):** Un sistema divide la memoria en particiones fijas de 64 MB. Un proceso de 10 MB ocupa una partición completa, desperdiciando 54 MB dentro de esa partición. Muchos procesos pequeños aumentan el desperdicio interno.

**Preguntas guía (análisis):**
- ¿Por qué el espacio sobrante de la partición no puede ser usado por otro proceso?
- ¿Cómo afecta el tamaño de partición al desperdicio?
- ¿Qué diferencia hay con fragmentación externa?
- ¿También puede existir fragmentación interna en paginación?

**Teoría (formalización):** La fragmentación interna ocurre cuando la unidad asignada es mayor que el tamaño requerido y el sobrante queda inutilizable para otros. En particiones fijas el desperdicio puede ser alto. En paginación puede existir en la última página, pero suele estar acotado por el tamaño de página.

**Modelo visual:** Particiones fijas

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "fixed_partition_map",
  "particion_mb": 64,
  "particiones": [
    {
      "id": "Part1",
      "proceso": "P1",
      "usado": 10,
      "desperdicio": 54
    },
    {
      "id": "Part2",
      "proceso": "P2",
      "usado": 40,
      "desperdicio": 24
    },
    {
      "id": "Part3",
      "proceso": "P3",
      "usado": 63,
      "desperdicio": 1
    }
  ],
  "desperdicio_total": 79,
  "tipo_fragmentacion": "interna"
}
```

**Notas de revisión:**
- Se agregó contraste con paginación.
- Se reforzó unidad asignada vs tamaño real.
- Se mantuvo el ejemplo numérico.

## SO-017 - Violación de protección por escritura en página de solo lectura
**Tema:** Memoria virtual
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Memoria virtual: protección y permisos de página.

**Escenario (caso de falla):** Un proceso intenta escribir una página marcada como solo lectura, por ejemplo código compartido o una página con permisos R-X. La MMU detecta la operación no permitida y genera una excepción.

**Preguntas guía (análisis):**
- ¿Por qué este caso no es igual a un page fault por página ausente?
- ¿Qué bits de la tabla de páginas intervienen?
- ¿Qué debe hacer el SO si no se trata de copy-on-write?
- ¿Cómo protege esto al kernel y a otros procesos?

**Teoría (formalización):** La tabla de páginas incluye bits de presencia, validez y permisos. Si una página está presente pero la operación viola permisos, el problema es de protección. El SO no debe permitir que el proceso continúe como si nada; puede enviar una señal o terminar el proceso. Si la página estaba marcada copy-on-write, se aplica una copia controlada.

**Modelo visual:** Tabla de páginas con permisos

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "page_table_permissions",
  "entrada": {
    "vpn": 12,
    "presente": true,
    "valida": true,
    "frame": 45,
    "permisos": "R-X",
    "cow": false
  },
  "operacion": "write",
  "resultado": "protection_fault",
  "accion_so": [
    "signal",
    "terminar_proceso"
  ],
  "contraste": "COW_si_cow=true"
}
```

**Notas de revisión:**
- Se separó presencia de permisos.
- Se agregó contraste con copy-on-write.
- Se conectó con protección entre procesos.

## SO-018 - Copy-on-write después de fork()
**Tema:** Memoria virtual
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Procesos y memoria virtual: fork() y copy-on-write.

**Escenario (caso de falla):** Un proceso ejecuta fork(). Padre e hijo comparten inicialmente páginas físicas marcadas como solo lectura y copy-on-write. Cuando el hijo escribe una variable, se produce un fault controlado; el SO copia la página y actualiza la tabla del hijo.

**Preguntas guía (análisis):**
- ¿Por qué fork() no copia toda la memoria inmediatamente?
- ¿Por qué una escritura válida produce una excepción controlada?
- ¿Qué entradas cambian en las tablas de páginas?
- ¿Qué ventaja tiene si el hijo pronto ejecuta exec()?

**Teoría (formalización):** Copy-on-write evita copiar páginas hasta que alguna parte realmente escribe. Después de fork(), padre e hijo comparten páginas con permisos restringidos. Ante una escritura, el SO crea una copia privada y habilita escritura solo para quien modificó. Esto reduce costo y memoria usada.

**Modelo visual:** Compartición y copia de páginas

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "copy_on_write",
  "antes": {
    "padre": {
      "VPN5": {
        "frame": 80,
        "perm": "R",
        "cow": true
      }
    },
    "hijo": {
      "VPN5": {
        "frame": 80,
        "perm": "R",
        "cow": true
      }
    }
  },
  "evento": "hijo escribe VPN5",
  "despues": {
    "padre": {
      "VPN5": {
        "frame": 80,
        "perm": "R",
        "cow": true
      }
    },
    "hijo": {
      "VPN5": {
        "frame": 112,
        "perm": "RW",
        "cow": false
      }
    }
  },
  "beneficio": "copia_diferida"
}
```

**Notas de revisión:**
- Se resaltó exec() como caso de ahorro.
- Se explicitó la excepción controlada.
- Se mantuvo el modelo visual comparativo.

## SO-019 - Archivo no persistido por caché de escritura
**Tema:** File System
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** File System: caché, escritura y journaling.

**Escenario (caso de falla):** Una aplicación ejecuta write() y muestra 'guardado correctamente'. Segundos después se corta la energía. Al reiniciar, el archivo está incompleto porque los datos estaban en buffer cache y todavía no se habían escrito físicamente en el disco.

**Preguntas guía (análisis):**
- ¿Write() garantiza persistencia física inmediata?
- ¿Qué diferencia hay entre copiar al buffer del kernel y grabar en el dispositivo?
- ¿Qué función cumple fsync()?
- ¿Qué trade-off existe entre rendimiento y seguridad de datos?

**Teoría (formalización):** Los sistemas de archivos usan caché de escritura para mejorar rendimiento. write() puede retornar luego de copiar datos al kernel, sin garantizar que ya estén persistidos en el dispositivo. fsync(), políticas de flush y journaling reducen pérdida e inconsistencia, a costa de mayor latencia.

**Modelo visual:** Secuencia de escritura con caché

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "write_cache_sequence",
  "eventos": [
    [
      "t0",
      "app",
      "write(datos)"
    ],
    [
      "t1",
      "kernel",
      "buffer_cache"
    ],
    [
      "t2",
      "app",
      "muestra_guardado"
    ],
    [
      "t3",
      "corte_energia"
    ],
    [
      "t4",
      "reinicio",
      "archivo_incompleto"
    ]
  ],
  "correccion": [
    "fsync",
    "journaling",
    "flush_periodico"
  ],
  "concepto": "persistencia_no_equivale_a_write_retorno"
}
```

**Notas de revisión:**
- Se reforzó diferencia entre write y persistencia.
- Se agregó fsync y flush.
- Se conectó con journaling del resumen.

## SO-020 - Inconsistencia de metadatos tras una caída
**Tema:** File System
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** File System: inodos, directorios, espacio libre y journaling.

**Escenario (caso de falla):** El sistema está creando un archivo. Ya asignó bloques de datos, pero todavía no actualizó completamente el directorio, el inodo y los mapas de espacio libre. Se produce una caída y, al reiniciar, las estructuras del filesystem quedan inconsistentes.

**Preguntas guía (análisis):**
- ¿Qué metadatos deben actualizarse además de los datos del archivo?
- ¿Por qué una caída a mitad de operación puede dejar inconsistencias?
- ¿Cómo ayuda journaling?
- ¿Qué diferencia hay entre comprobar coherencia y prevenir inconsistencias?

**Teoría (formalización):** Las operaciones de filesystem involucran datos y metadatos: directorios, inodos, mapas de bloques, tamaño, fechas y permisos. Si una caída interrumpe la operación, pueden quedar referencias inconsistentes. Journaling registra las acciones necesarias para completar o revertir la operación de manera controlada.

**Modelo visual:** Transacción de journaling

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "filesystem_transaction",
  "operacion": "crear_archivo",
  "pasos": [
    "reservar_inodo",
    "asignar_bloques",
    "escribir_datos",
    "actualizar_directorio",
    "actualizar_bitmap",
    "actualizar_atributos"
  ],
  "fallo_en": "actualizar_directorio",
  "recuperacion": {
    "sin_journal": "fsck/chkdsk",
    "con_journal": "replay_or_rollback"
  },
  "metadatos": [
    "inodo",
    "directorio",
    "bitmap",
    "tamaño"
  ]
}
```

**Notas de revisión:**
- Se detallaron estructuras afectadas.
- Se diferenció recuperación por chequeo y journaling.
- Se alineó con escritura atómica conceptual.

## SO-021 - Agotamiento de descriptores de archivo
**Tema:** File System
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** File System: archivos abiertos y tablas asociadas.

**Escenario (caso de falla):** Un servicio abre archivos de log y sockets por cada solicitud, pero ante ciertos errores no ejecuta close(). Tras muchas horas, nuevas llamadas a open() fallan aunque el disco tiene espacio disponible.

**Preguntas guía (análisis):**
- ¿Por qué puede fallar open() si el archivo existe y hay espacio en disco?
- ¿Qué recurso se está agotando: almacenamiento o descriptores?
- ¿Qué estructuras del proceso se relacionan con archivos abiertos?
- ¿Qué práctica evita esta fuga de recursos?

**Teoría (formalización):** Cada proceso tiene una tabla de descriptores de archivo abiertos, y el sistema también mantiene estructuras globales de archivos abiertos. Si una aplicación no cierra los descriptores, puede agotar su límite o el límite global. La solución es cerrar recursos correctamente incluso ante errores.

**Modelo visual:** Tabla de archivos abiertos

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "open_file_tables",
  "proceso": "servidor",
  "limite_fd": 1024,
  "fd_abiertos": 1024,
  "fallo": "open retorna EMFILE",
  "causa": "fuga_de_descriptores",
  "recursos_afectados": [
    "tabla_fd_proceso",
    "tabla_global_archivos"
  ],
  "correccion": [
    "close en finally/defer",
    "monitorear fd",
    "reuse de conexiones"
  ]
}
```

**Notas de revisión:**
- Se aclaró que no es problema de espacio en disco.
- Se agregó límite por proceso/global.
- Se vinculó con estructuras de archivos abiertos.

## SO-022 - Permisos insuficientes pese a ruta correcta
**Tema:** File System y protección
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** File System: protección de archivos en Unix.

**Escenario (caso de falla):** Un usuario intenta abrir /proyectos/so/parcial.txt. El archivo tiene permiso de lectura, pero uno de los directorios intermedios no tiene permiso de ejecución para ese usuario. La ruta existe, pero open() falla con permiso denegado.

**Preguntas guía (análisis):**
- ¿Por qué no alcanza con tener permiso de lectura sobre el archivo?
- ¿Qué significa permiso de ejecución en un directorio Unix?
- ¿En qué componente de la ruta falla la verificación?
- ¿Cómo se diagnostica el problema mirando permisos de cada directorio?

**Teoría (formalización):** En Unix, para acceder a un archivo no solo importan los permisos del archivo final. También se requiere atravesar los directorios de la ruta, lo que exige permiso de ejecución sobre cada directorio intermedio. Un fallo en cualquier componente impide el acceso.

**Modelo visual:** Árbol de directorios con permisos

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "unix_permissions_path",
  "ruta": [
    "/",
    "proyectos",
    "so",
    "parcial.txt"
  ],
  "permisos": {
    "proyectos": "r-x",
    "so": "r--",
    "parcial.txt": "r--"
  },
  "usuario": "alumno",
  "operacion": "open_read",
  "fallo_en": "so",
  "motivo": "directorio_sin_execute",
  "resultado": "EACCES"
}
```

**Notas de revisión:**
- Se agregó el detalle didáctico del permiso x en directorios.
- Se evitó que el caso quede como simple 'archivo sin permiso'.
- Se hizo útil para preguntas conceptuales de protección.

## SO-023 - CPU desperdiciada por espera activa de dispositivo
**Tema:** Entrada/Salida
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Entrada/Salida: E/S programada, interrupciones y DMA.

**Escenario (caso de falla):** Un sistema usa E/S programada para leer un bloque de disco. La CPU inicia la operación y luego consulta repetidamente el estado del dispositivo hasta que termina. Durante ese tiempo no ejecuta trabajo útil de otros procesos.

**Preguntas guía (análisis):**
- ¿Por qué la espera activa desperdicia CPU?
- ¿Qué cambia al usar interrupciones?
- ¿Qué mejora agrega DMA respecto de E/S por interrupciones?
- ¿Cuándo podría aceptarse polling pese a su costo?

**Teoría (formalización):** La E/S programada mantiene a la CPU ocupada consultando el dispositivo. Con interrupciones, la CPU puede ejecutar otra tarea y ser notificada al finalizar. Con DMA, además, el controlador transfiere bloques completos a memoria sin intervención constante de CPU, reduciendo overhead.

**Modelo visual:** Comparación E/S programada, interrupciones y DMA

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "io_techniques_comparison",
  "tecnicas": [
    {
      "nombre": "programada",
      "cpu": "polling_constante",
      "overhead": "alto"
    },
    {
      "nombre": "interrupciones",
      "cpu": "continua_otros_procesos",
      "overhead": "medio"
    },
    {
      "nombre": "DMA",
      "cpu": "programa_transferencia_y_recibe_interrupcion_final",
      "overhead": "bajo"
    }
  ],
  "fallo": "cpu_ocupada_sin_trabajo_util",
  "correccion": "interrupciones_o_DMA"
}
```

**Notas de revisión:**
- Se vinculó con técnicas de E/S del resumen.
- Se agregó comparación con interrupciones y DMA.
- Se reformuló como caso conceptual de eficiencia.

## SO-024 - Pérdida de datos por buffering insuficiente
**Tema:** Entrada/Salida
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Entrada/Salida: IO buffering y drivers.

**Escenario (caso de falla):** Una placa de red recibe paquetes más rápido de lo que el sistema operativo los copia desde el buffer del dispositivo a memoria. El buffer se llena y nuevos paquetes sobrescriben o descartan datos antes de que la aplicación los procese.

**Preguntas guía (análisis):**
- ¿Qué problema intenta resolver el buffering de E/S?
- ¿Por qué el productor puede superar al consumidor?
- ¿Cómo ayuda el doble buffer o un buffer circular?
- ¿Qué rol tienen interrupciones, drivers y planificación en este caso?

**Teoría (formalización):** El buffering desacopla la velocidad del dispositivo y la velocidad de procesamiento del sistema. Si la tasa de llegada supera la capacidad de vaciado, el buffer puede desbordar. Técnicas como doble buffering, buffers circulares, DMA y control de flujo reducen pérdida de datos.

**Modelo visual:** Buffer circular de E/S

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "io_ring_buffer",
  "buffer": {
    "capacidad": 4,
    "ocupado": 4
  },
  "productor": "NIC",
  "consumidor": "driver/kernel",
  "eventos": [
    [
      "t0",
      "llegan paquetes 1-4"
    ],
    [
      "t1",
      "buffer lleno"
    ],
    [
      "t2",
      "llega paquete 5"
    ],
    [
      "t3",
      "drop u overwrite"
    ]
  ],
  "correcciones": [
    "ring_buffer_mayor",
    "DMA",
    "control_de_flujo",
    "priorizar_interrupcion_io"
  ]
}
```

**Notas de revisión:**
- Se reemplazó un caso genérico por uno alineado a IO buffering.
- Se agregó productor/consumidor de dispositivo.
- Se incorporó driver y DMA como elementos de la materia.

## SO-025 - Starvation en planificación de disco SSTF
**Tema:** Entrada/Salida y planificación de disco
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Entrada/Salida: planificación de disco SSTF, SCAN y variantes.

**Escenario (caso de falla):** El brazo del disco atiende siempre la solicitud más cercana a su posición actual. Llegan muchas solicitudes cerca del centro del disco y una solicitud alejada permanece esperando durante mucho tiempo.

**Preguntas guía (análisis):**
- ¿Por qué SSTF puede minimizar movimiento local pero generar starvation?
- ¿Qué solicitud queda postergada y por qué?
- ¿Cómo SCAN o C-SCAN mejoran la equidad?
- ¿Qué métrica se intenta optimizar en planificación de disco?

**Teoría (formalización):** SSTF elige la solicitud más cercana y puede reducir movimiento promedio, pero no garantiza equidad: solicitudes alejadas pueden esperar indefinidamente. SCAN y C-SCAN recorren el disco en una dirección ordenada, reduciendo la posibilidad de starvation.

**Modelo visual:** Recorrido del brazo de disco

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "disk_scheduling",
  "politica": "SSTF",
  "cabezal_inicial": 50,
  "solicitudes": [
    48,
    52,
    55,
    53,
    90
  ],
  "atendidas": [
    52,
    53,
    55,
    48
  ],
  "postergada": 90,
  "problema": "starvation_solicitud_lejana",
  "alternativas": [
    "SCAN",
    "C-SCAN",
    "LOOK",
    "C-LOOK"
  ]
}
```

**Notas de revisión:**
- Se conectó con planificación de brazo de disco.
- Se agregó alternativa SCAN/C-SCAN.
- Se hizo explícita la analogía con starvation de CPU.

## SO-026 - Lectura inconsistente durante escritura concurrente
**Tema:** File System y concurrencia
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** File System: bloqueos/locks y archivos abiertos.

**Escenario (caso de falla):** Un proceso está escribiendo un archivo de configuración mientras otro lo lee para iniciar un servicio. El lector observa una versión parcialmente actualizada: algunos campos pertenecen a la versión nueva y otros a la anterior.

**Preguntas guía (análisis):**
- ¿Por qué los archivos también requieren sincronización?
- ¿Qué diferencia hay entre locks compartidos y exclusivos?
- ¿Qué problema intenta evitar la escritura atómica por reemplazo?
- ¿Cómo se relaciona con consistencia del filesystem?

**Teoría (formalización):** Los archivos son recursos compartidos. Sin bloqueo o estrategia de escritura atómica, un lector puede observar un estado intermedio. Los locks compartidos permiten varios lectores; los exclusivos impiden lecturas/escrituras simultáneas. Otra estrategia es escribir en archivo temporal y renombrar atómicamente.

**Modelo visual:** Lock de archivo y escritura atómica

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "file_locking_sequence",
  "archivo": "config.json",
  "eventos": [
    [
      "t0",
      "W abre y escribe mitad nueva"
    ],
    [
      "t1",
      "R lee archivo parcial"
    ],
    [
      "t2",
      "W termina"
    ]
  ],
  "fallo": "lectura_inconsistente",
  "correcciones": [
    "lock_exclusivo_para_W",
    "lock_compartido_para_R",
    "write_temp_plus_rename"
  ],
  "locks": [
    "shared",
    "exclusive"
  ]
}
```

**Notas de revisión:**
- Se incorporaron locks de filesystem.
- Se sumó escritura atómica como estrategia práctica.
- Se conectó concurrencia con archivos.

## SO-027 - Escalada de privilegios por setuid inseguro
**Tema:** Protección y seguridad
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Protección y seguridad del sistema operativo.

**Escenario (caso de falla):** Un ejecutable con bit setuid root permite que usuarios comunes ejecuten una operación administrativa. El programa no valida correctamente sus parámetros y termina permitiendo modificar archivos fuera del alcance previsto.

**Preguntas guía (análisis):**
- ¿Qué efecto tiene setuid sobre el UID efectivo?
- ¿Por qué setuid no es peligroso por sí solo, sino por una mala validación?
- ¿Qué principio de seguridad se incumple?
- ¿Qué controles deberían aplicarse?

**Teoría (formalización):** El bit setuid permite ejecutar un programa con el UID efectivo del dueño del archivo. Si el dueño es root, el programa corre con privilegios elevados. Debe validar entradas, limitar operaciones y aplicar mínimo privilegio; de lo contrario puede convertirse en vía de escalada.

**Modelo visual:** Flujo de UID real/efectivo

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "setuid_flow",
  "usuario": {
    "uid_real": "alumno",
    "uid_efectivo_inicial": "alumno"
  },
  "ejecutable": {
    "owner": "root",
    "setuid": true
  },
  "durante_ejecucion": {
    "uid_efectivo": "root"
  },
  "fallo": "validacion_insuficiente",
  "riesgo": "privilege_escalation",
  "controles": [
    "validar_rutas",
    "drop_privileges",
    "least_privilege"
  ]
}
```

**Notas de revisión:**
- Se relacionó con UID real/efectivo.
- Se aclaró que el riesgo surge por mala validación.
- Se dejó como caso de protección de SO.

## SO-028 - Aislamiento entre procesos violado por ausencia de protección
**Tema:** Memoria y protección
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Memoria: protección y espacios de direcciones.

**Escenario (caso de falla):** En un sistema hipotético sin MMU ni límites de memoria, un proceso con un puntero incorrecto escribe sobre la zona de memoria de otro proceso. El segundo proceso falla aunque no cometió ningún error propio.

**Preguntas guía (análisis):**
- ¿Por qué el aislamiento entre procesos es responsabilidad del SO y el hardware?
- ¿Qué rol cumplen registros base/límite o tablas de páginas?
- ¿Por qué el bug de un proceso no debería corromper a otro?
- ¿Cómo se relaciona esto con modo usuario y modo kernel?

**Teoría (formalización):** La protección de memoria impide que un proceso acceda a direcciones fuera de su espacio. La MMU, junto con tablas de páginas, segmentación o registros base/límite, valida referencias. Sin protección, un error de un proceso puede corromper otros procesos o al propio kernel.

**Modelo visual:** Espacios de direcciones aislados

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "memory_protection",
  "sistema": "sin_proteccion",
  "procesos": [
    {
      "id": "P1",
      "rango": "0-999"
    },
    {
      "id": "P2",
      "rango": "1000-1999"
    }
  ],
  "evento": {
    "proceso": "P1",
    "write_addr": 1200
  },
  "resultado": "corrompe_memoria_de_P2",
  "correccion": [
    "MMU",
    "base_limit",
    "page_table_permissions",
    "modo_usuario"
  ]
}
```

**Notas de revisión:**
- Se conectó con hardware de protección.
- Se agregó relación con modo usuario/kernel.
- Se hizo más claro el impacto del aislamiento.

## SO-029 - Sobrecarga por muchas escrituras pequeñas
**Tema:** Sistema operativo y E/S
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Sistemas operativos: syscalls, wrappers y cambios de modo.

**Escenario (caso de falla):** Una aplicación escribe un archivo grande haciendo miles de llamadas write() de pocos bytes. Aunque el volumen total de datos no es alto, el rendimiento cae por la gran cantidad de cambios de modo, validaciones y entradas al kernel.

**Preguntas guía (análisis):**
- ¿Por qué muchas syscalls pequeñas pueden ser más costosas que pocas grandes?
- ¿Qué overhead implica pasar de modo usuario a modo kernel?
- ¿Cómo ayudan buffering y escrituras por bloques?
- ¿Qué diferencia hay entre costo de CPU y costo de disco?

**Teoría (formalización):** Cada syscall implica cruzar la interfaz usuario-kernel, validar parámetros y ejecutar código del SO. Muchas operaciones pequeñas aumentan overhead. El buffering en biblioteca o kernel agrupa datos y reduce llamadas, mejorando rendimiento.

**Modelo visual:** Secuencia syscall vs buffering

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "syscall_overhead",
  "patron_malo": {
    "writes": 10000,
    "bytes_por_write": 4
  },
  "patron_mejor": {
    "writes": 40,
    "bytes_por_write": 1000
  },
  "costos": [
    "mode_switch",
    "validacion",
    "copias",
    "planificacion_io"
  ],
  "correcciones": [
    "buffering",
    "writev",
    "bloques_mayores"
  ]
}
```

**Notas de revisión:**
- Se vinculó con syscalls y cambio de modo.
- Se agregó comparación cuantitativa simple.
- Se orientó a discusión teórica sin código.

## SO-030 - Sistema no inicia por fallo en el primer proceso de usuario
**Tema:** Boot Process
**Tipo de material:** Caso existente refinado
**Alineación con el resumen:** Entrada/Salida: boot process y procesos del sistema.

**Escenario (caso de falla):** El bootloader carga el kernel correctamente. El kernel inicializa memoria, drivers básicos y monta el filesystem raíz, pero al intentar iniciar init/systemd falla la configuración. El sistema queda sin servicios ni login disponible.

**Preguntas guía (análisis):**
- ¿Por qué el kernel cargado no alcanza para que el sistema sea utilizable?
- ¿Qué diferencia hay entre kernel y procesos de espacio de usuario?
- ¿Qué rol cumple init/systemd en la jerarquía de procesos?
- ¿Cómo se podría recuperar el sistema?

**Teoría (formalización):** El arranque no termina con la carga del kernel. Luego debe iniciarse el primer proceso de usuario, raíz de la jerarquía, que levanta servicios y gestiona el resto del entorno. Si init/systemd falla, el kernel puede estar vivo pero el sistema no llega a una sesión usable.

**Modelo visual:** Secuencia de arranque

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "boot_sequence",
  "pasos": [
    {
      "orden": 1,
      "componente": "firmware/bootloader",
      "estado": "ok"
    },
    {
      "orden": 2,
      "componente": "kernel",
      "estado": "ok"
    },
    {
      "orden": 3,
      "componente": "init/systemd",
      "estado": "falla"
    },
    {
      "orden": 4,
      "componente": "servicios",
      "estado": "no_iniciados"
    },
    {
      "orden": 5,
      "componente": "login",
      "estado": "no_disponible"
    }
  ],
  "recuperacion": [
    "modo_rescue",
    "init_alternativo",
    "rollback_configuracion"
  ]
}
```

**Notas de revisión:**
- Se relacionó boot process con primer proceso de usuario.
- Se aclaró kernel vs espacio de usuario.
- Se agregó recuperación conceptual.

## SO-031 - Programa de usuario intenta ejecutar una instrucción privilegiada
**Tema:** Arquitectura y modos de ejecución
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Repaso de arquitectura y modos de ejecución.

**Escenario (caso de falla):** Un proceso en modo usuario intenta deshabilitar interrupciones ejecutando una instrucción privilegiada. El procesador no permite la operación, genera una excepción y transfiere el control al sistema operativo.

**Preguntas guía (análisis):**
- ¿Por qué la CPU debe impedir esta instrucción en modo usuario?
- ¿Qué bit o registro permite saber el modo actual de ejecución?
- ¿Qué diferencia hay entre intentar una instrucción privilegiada y pedir un servicio mediante syscall?
- ¿Qué riesgo existiría si cualquier proceso pudiera deshabilitar interrupciones?

**Teoría (formalización):** Los modos de ejecución protegen al sistema. En modo usuario solo se permiten instrucciones no privilegiadas; las operaciones sensibles deben solicitarse al kernel mediante syscalls. Si un proceso intenta ejecutar una instrucción privilegiada, se genera una excepción y el SO decide cómo actuar.

**Modelo visual:** Transición usuario-kernel por excepción

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "privileged_instruction_fault",
  "modo_inicial": "usuario",
  "instruccion": "CLI/deshabilitar_interrupciones",
  "resultado": "excepcion",
  "psw": {
    "modo": "user"
  },
  "accion_so": [
    "registrar_evento",
    "enviar_signal",
    "terminar_proceso"
  ],
  "conceptos": [
    "modo_usuario",
    "modo_kernel",
    "instrucciones_privilegiadas"
  ]
}
```

**Notas de revisión:**
- Nuevo caso para repaso de arquitectura, PSW, modos e instrucciones privilegiadas.

## SO-032 - Syscall bloqueante que no puede pasar directo a Running
**Tema:** Syscalls y estados de proceso
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Procesos: estados, bloqueos e interrupciones de E/S.

**Escenario (caso de falla):** Un proceso en Running invoca read() sobre disco. La operación tardará, por lo que el proceso pasa a Blocked. Cuando el disco termina, una interrupción avisa al SO y el proceso vuelve a Ready, no directamente a Running.

**Preguntas guía (análisis):**
- ¿Por qué el proceso pasa de Running a Blocked?
- ¿Qué evento permite pasar de Blocked a Ready?
- ¿Por qué no puede ir directamente de Blocked a Running?
- ¿Qué planificador decide cuándo volverá a ejecutar?

**Teoría (formalización):** Una syscall bloqueante puede sacar al proceso de la CPU porque necesita esperar un evento de E/S. Al completarse la E/S, el dispositivo genera una interrupción; el SO cambia el proceso a Ready. Luego el planificador de corto plazo decidirá si obtiene CPU.

**Modelo visual:** Diagrama de estados con syscall bloqueante

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "process_state_transition",
  "eventos": [
    [
      "t0",
      "P1",
      "Running"
    ],
    [
      "t1",
      "P1 invoca read() bloqueante",
      "Blocked"
    ],
    [
      "t2",
      "interrupción de fin de E/S",
      "Ready"
    ],
    [
      "t3",
      "scheduler dispatch",
      "Running"
    ]
  ],
  "transicion_invalida": "Blocked->Running directo",
  "planificador": "corto_plazo"
}
```

**Notas de revisión:**
- Nuevo caso para transiciones de estados y syscalls bloqueantes.

## SO-033 - Confusión entre cambio de modo y cambio de proceso
**Tema:** Cambio de modo y cambio de contexto
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Cambio de modo, syscalls y cambio de contexto.

**Escenario (caso de falla):** Un proceso ejecuta una syscall para consultar la hora. El sistema pasa a modo kernel, atiende la solicitud y vuelve al mismo proceso. Un alumno afirma que necesariamente hubo cambio de proceso.

**Preguntas guía (análisis):**
- ¿Hubo cambio de modo?
- ¿Hubo cambio de proceso?
- ¿Puede haber cambio de contexto sin cambiar de proceso?
- ¿Por qué el SO debe ejecutar para atender la syscall?

**Teoría (formalización):** Un cambio de modo no implica necesariamente cambio de proceso. Una syscall cambia de modo usuario a kernel para ejecutar código del SO, pero puede retornar al mismo proceso. El cambio de contexto puede darse para guardar/restaurar estado, atender interrupciones o cambiar de hilo/proceso.

**Modelo visual:** Tabla de eventos modo/contexto

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "mode_vs_context_switch",
  "secuencia": [
    {
      "evento": "P1 en usuario",
      "modo": "user",
      "proceso": "P1"
    },
    {
      "evento": "syscall time()",
      "modo": "kernel",
      "proceso": "P1"
    },
    {
      "evento": "retorno",
      "modo": "user",
      "proceso": "P1"
    }
  ],
  "cambio_modo": true,
  "cambio_proceso": false,
  "concepto_clave": "no_todo_cambio_de_modo_implica_cambio_de_proceso"
}
```

**Notas de revisión:**
- Nuevo caso para atacar una confusión frecuente de parcial.

## SO-034 - Interrupción durante la atención de una syscall
**Tema:** Interrupciones
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Interrupciones: clasificación, prioridades y procesamiento.

**Escenario (caso de falla):** El kernel está atendiendo una syscall cuando llega una interrupción de mayor prioridad del dispositivo de red. El sistema guarda el contexto de la rutina actual, atiende la interrupción y luego vuelve a completar la syscall.

**Preguntas guía (análisis):**
- ¿Por qué puede ocurrir una interrupción mientras se ejecuta código del SO?
- ¿Siempre se espera a que termine la syscall para atenderla?
- ¿Qué estrategias existen para múltiples interrupciones?
- ¿Qué contexto debe guardarse para poder volver?

**Teoría (formalización):** Las interrupciones pueden ocurrir durante la ejecución de código de usuario o de kernel, salvo que estén deshabilitadas o enmascaradas según la política. Para múltiples interrupciones se puede atender en orden, por prioridad, anidar o deshabilitar temporalmente. Esto muestra que cambio de contexto no siempre equivale a cambio de proceso.

**Modelo visual:** Anidamiento de interrupciones

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "nested_interrupt",
  "contexto_inicial": "rutina_syscall",
  "interrupcion": {
    "fuente": "placa_red",
    "prioridad": "alta"
  },
  "pasos": [
    "guardar_contexto_syscall",
    "ejecutar_interrupt_handler",
    "restaurar_contexto_syscall",
    "continuar_syscall"
  ],
  "estrategias": [
    "secuencial",
    "prioridad",
    "deshabilitar_interrupciones"
  ]
}
```

**Notas de revisión:**
- Nuevo caso para múltiples interrupciones y contexto en kernel.

## SO-035 - Proceso queda en New por límite de multiprogramación
**Tema:** Planificación de largo plazo
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Planificación: largo plazo y admisión.

**Escenario (caso de falla):** Un sistema tiene grado máximo de multiprogramación 5. Ya hay 5 procesos activos en Ready/Running/Blocked. Llega un sexto programa para ejecutar, pero queda en New hasta que el planificador de largo plazo admita su ingreso.

**Preguntas guía (análisis):**
- ¿Por qué el proceso todavía no está en Ready?
- ¿Qué planificador controla la admisión?
- ¿Qué estados cuentan para el grado de multiprogramación?
- ¿Qué ocurre cuando un proceso termina o se suspende?

**Teoría (formalización):** El planificador de largo plazo decide qué procesos son admitidos al sistema y controla el grado de multiprogramación. Ready, Running y Blocked ocupan memoria principal; New representa un proceso en preparación o esperando admisión. Al liberar memoria o bajar carga, puede pasar a Ready.

**Modelo visual:** Cola de admisión

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "long_term_scheduler",
  "grado_maximo": 5,
  "activos": [
    "P1",
    "P2",
    "P3",
    "P4",
    "P5"
  ],
  "nuevo": "P6",
  "estado_p6": "New",
  "condicion_para_admitir": "disminuye_grado_multiprogramacion",
  "transicion": "New->Ready"
}
```

**Notas de revisión:**
- Nuevo caso sobre largo plazo y grado de multiprogramación.

## SO-036 - Transición imposible de Ready a Blocked
**Tema:** Estados de proceso
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Procesos: estados y transiciones válidas.

**Escenario (caso de falla):** Un alumno dibuja un diagrama donde un proceso pasa de Ready a Blocked porque necesita leer un archivo. Sin embargo, el proceso todavía no estaba ejecutando, por lo que no pudo invocar ninguna syscall de E/S.

**Preguntas guía (análisis):**
- ¿Por qué Ready -> Blocked no es una transición válida directa?
- ¿Qué debe ocurrir antes para que un proceso se bloquee?
- ¿Qué transición representa una syscall bloqueante?
- ¿Cómo corregirías el diagrama?

**Teoría (formalización):** Un proceso en Ready está listo para ejecutar pero no está usando CPU. Para solicitar una E/S bloqueante debe primero pasar a Running. La transición correcta es Ready -> Running por dispatch y luego Running -> Blocked por syscall bloqueante.

**Modelo visual:** Diagrama de estados corregido

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "state_transition_validation",
  "transicion_propuesta": "Ready->Blocked",
  "valida": false,
  "motivo": "el proceso no ejecuta instrucciones en Ready",
  "secuencia_correcta": [
    "Ready",
    "Running",
    "Blocked"
  ],
  "evento_bloqueante": "syscall de E/S"
}
```

**Notas de revisión:**
- Nuevo caso enfocado en errores típicos de diagramas de estados.

## SO-037 - ULT sin jacketing bloquea a todos los hilos de usuario
**Tema:** Hilos
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Hilos: ULT, KLT y operaciones bloqueantes.

**Escenario (caso de falla):** Un proceso tiene una biblioteca de ULTs con tres hilos de usuario sobre un único KLT. Un ULT realiza una syscall bloqueante de E/S sin jacketing. El SO solo ve al KLT, por lo que bloquea todo el proceso/hilo kernel y los otros ULTs no pueden avanzar.

**Preguntas guía (análisis):**
- ¿Por qué el SO no sabe cuál ULT hizo la E/S?
- ¿Qué ve realmente el kernel?
- ¿Por qué se bloquean los hilos pares aunque no hayan pedido E/S?
- ¿Cómo cambiaría el caso usando KLTs o jacketing?

**Teoría (formalización):** Los ULTs son administrados por una biblioteca en modo usuario; el kernel no conoce cada ULT. Si un ULT realiza una operación bloqueante sin revestimiento, el KLT asociado queda bloqueado y con él todos los ULTs multiplexados encima. Esto reduce paralelismo y afecta planificación interna.

**Modelo visual:** Mapeo ULT-KLT sin jacketing

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "ult_blocking_without_jacketing",
  "klt": "K1",
  "ults": [
    "U1",
    "U2",
    "U3"
  ],
  "evento": "U1 invoca read() bloqueante",
  "vista_kernel": "K1 bloqueado",
  "resultado": {
    "U1": "blocked",
    "U2": "no_ejecuta",
    "U3": "no_ejecuta"
  },
  "correcciones": [
    "jacketing",
    "usar_KLTs",
    "I/O_no_bloqueante"
  ]
}
```

**Notas de revisión:**
- Nuevo caso específico de ULTs sin jacketing, tema muy propio de la cursada.

## SO-038 - Jacketing conserva la planificación interna de ULTs
**Tema:** Hilos
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Hilos: jacketing/revestimiento.

**Escenario (caso de falla):** Una biblioteca de ULTs intercepta una llamada fwrite_ULT(). En vez de hacer una syscall bloqueante, solicita E/S no bloqueante al SO y marca internamente al ULT como bloqueado. Mientras espera, la biblioteca planifica otro ULT del mismo proceso.

**Preguntas guía (análisis):**
- ¿Qué problema resuelve el jacketing?
- ¿Quién bloquea al ULT: el SO o la biblioteca?
- ¿Por qué se conserva la planificación interna?
- ¿Qué costo o complejidad introduce esta solución?

**Teoría (formalización):** El jacketing o revestimiento transforma operaciones potencialmente bloqueantes en operaciones no bloqueantes desde el punto de vista del kernel. La biblioteca administra el bloqueo lógico del ULT y puede seguir ejecutando otros ULTs. Así evita que un único ULT bloquee a todos sus pares.

**Modelo visual:** Secuencia de jacketing

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "ult_jacketing_sequence",
  "evento": "U1 solicita fwrite_ULT",
  "biblioteca": [
    "convierte a syscall no bloqueante",
    "marca U1 como waiting interno",
    "planifica U2",
    "consulta finalización"
  ],
  "kernel": "no bloquea KLT completo",
  "beneficio": "continua_planificacion_ULT"
}
```

**Notas de revisión:**
- Nuevo caso complementario al SO-037 para enseñar la solución.

## SO-039 - Falso paralelismo en ULTs sobre un único KLT
**Tema:** Hilos
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Hilos: ULT/KLT y paralelismo.

**Escenario (caso de falla):** Una aplicación crea cuatro ULTs para aprovechar un procesador de cuatro núcleos. Sin embargo, todos los ULTs están multiplexados sobre un único KLT. Aunque el equipo tiene varios núcleos, la aplicación no logra ejecutar los cuatro hilos en paralelo real.

**Preguntas guía (análisis):**
- ¿Por qué tener varios ULTs no garantiza paralelismo físico?
- ¿Qué diferencia hay entre concurrencia y paralelismo?
- ¿Qué ve el planificador del kernel?
- ¿Cómo permitir paralelismo real entre hilos?

**Teoría (formalización):** Los ULTs permiten concurrencia gestionada en modo usuario, pero si todos se apoyan sobre un único KLT, el kernel solo planifica una entidad. Para paralelismo real en múltiples cores se necesitan múltiples KLTs o un modelo M:N que mapee varios ULTs sobre varios KLTs.

**Modelo visual:** Mapeo ULT-KLT y cores

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "thread_mapping",
  "cores": 4,
  "modelo": "N:1",
  "ults": [
    "U1",
    "U2",
    "U3",
    "U4"
  ],
  "klts": [
    "K1"
  ],
  "paralelismo_real": 1,
  "correccion": "modelo_1:1_o_M:N"
}
```

**Notas de revisión:**
- Nuevo caso sobre diferencia entre concurrencia y paralelismo en hilos.

## SO-040 - HRRN evita inanición frente a SJF
**Tema:** Planificación
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Planificación: SJF, starvation y HRRN.

**Escenario (caso de falla):** Un proceso largo espera en Ready mientras llegan continuamente procesos cortos. Con SJF, el largo puede quedar postergado. Al aplicar HRRN, su response ratio aumenta a medida que acumula espera, hasta superar a los nuevos procesos cortos.

**Preguntas guía (análisis):**
- ¿Por qué SJF puede producir starvation?
- ¿Cómo se calcula el response ratio?
- ¿Por qué HRRN favorece a quien esperó mucho?
- ¿Qué criterio combina HRRN: tamaño de ráfaga o tiempo de espera?

**Teoría (formalización):** HRRN selecciona el proceso con mayor (S + W) / S, donde S es la ráfaga estimada y W el tiempo de espera. Como W crece mientras el proceso espera, la prioridad efectiva aumenta, reduciendo la inanición sin ignorar completamente la duración del trabajo.

**Modelo visual:** Tabla de response ratio

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "hrrn_table",
  "procesos": [
    {
      "id": "P_largo",
      "S": 20,
      "W": 80,
      "RR": 5.0
    },
    {
      "id": "P_corto1",
      "S": 3,
      "W": 3,
      "RR": 2.0
    },
    {
      "id": "P_corto2",
      "S": 2,
      "W": 1,
      "RR": 1.5
    }
  ],
  "seleccion": "P_largo",
  "concepto": "aging_implicito"
}
```

**Notas de revisión:**
- Nuevo caso para HRRN, ausente en el banco original.

## SO-041 - Virtual Round Robin y procesos I/O-bound
**Tema:** Planificación
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Planificación: Virtual Round Robin.

**Escenario (caso de falla):** Un proceso interactivo usa poco CPU y se bloquea por E/S antes de consumir todo su quantum. Al desbloquearse, Virtual Round Robin lo coloca en una cola auxiliar para que use el remanente de quantum antes que procesos que ya consumieron su turno completo.

**Preguntas guía (análisis):**
- ¿Por qué Round Robin puro puede perjudicar a procesos I/O-bound?
- ¿Qué representa el quantum remanente?
- ¿Para qué sirve la cola auxiliar de Virtual Round Robin?
- ¿Cómo mejora el tiempo de respuesta?

**Teoría (formalización):** Virtual Round Robin mejora la respuesta de procesos que se bloquean por E/S antes de agotar su quantum. Al volver de E/S, pueden tener prioridad en una cola auxiliar para consumir el quantum restante. Esto favorece interactividad sin abandonar la idea de turnos.

**Modelo visual:** Cola Ready y cola auxiliar

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "virtual_round_robin",
  "quantum": 5,
  "proceso_io": {
    "id": "Pio",
    "usa_cpu": 1,
    "io": 4,
    "remanente": 4
  },
  "colas": {
    "auxiliar": [
      "Pio"
    ],
    "ready": [
      "Pcpu1",
      "Pcpu2"
    ]
  },
  "regla": "ejecutar_auxiliar_antes_de_ready",
  "beneficio": "mejor_tiempo_respuesta"
}
```

**Notas de revisión:**
- Nuevo caso para Virtual Round Robin.

## SO-042 - Colas multinivel retroalimentadas degradan procesos CPU-bound
**Tema:** Planificación
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Planificación: colas multinivel y feedback.

**Escenario (caso de falla):** Un sistema usa colas multinivel con retroalimentación. Un proceso interactivo se bloquea seguido por E/S y vuelve a colas altas. Un proceso CPU-bound consume siempre todo su quantum y es degradado a colas de menor prioridad.

**Preguntas guía (análisis):**
- ¿Por qué el proceso CPU-bound baja de cola?
- ¿Qué comportamiento se intenta premiar?
- ¿Cómo se evita que procesos de colas bajas sufran starvation?
- ¿Qué diferencia hay con colas multinivel no retroalimentadas?

**Teoría (formalización):** Las colas multinivel con feedback ajustan dinámicamente la prioridad según comportamiento. Procesos que consumen mucho CPU bajan de prioridad; procesos interactivos o I/O-bound se mantienen arriba. Para evitar starvation se aplican aging o promociones periódicas.

**Modelo visual:** Colas multinivel con feedback

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "multilevel_feedback_queue",
  "colas": [
    {
      "nivel": 0,
      "prioridad": "alta",
      "quantum": 2
    },
    {
      "nivel": 1,
      "prioridad": "media",
      "quantum": 4
    },
    {
      "nivel": 2,
      "prioridad": "baja",
      "quantum": 8
    }
  ],
  "eventos": [
    [
      "Pcpu consume quantum completo",
      "degrada"
    ],
    [
      "Pio bloquea antes del quantum",
      "mantiene/promueve"
    ]
  ],
  "riesgo": "starvation_colas_bajas",
  "correccion": "aging_o_boost_periodico"
}
```

**Notas de revisión:**
- Nuevo caso para colas multinivel retroalimentadas.

## SO-043 - Livelock por procesos demasiado cooperativos
**Tema:** Deadlock y concurrencia
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Deadlock: comparación con livelock.

**Escenario (caso de falla):** Dos procesos intentan evitar chocar en el uso de un recurso. Cada vez que detectan al otro, ambos liberan y vuelven a intentar al mismo tiempo. No quedan bloqueados, pero repiten acciones sin avanzar.

**Preguntas guía (análisis):**
- ¿Por qué esto no es deadlock?
- ¿Qué significa que el sistema tenga actividad pero no progreso?
- ¿Cómo ayuda introducir aleatoriedad o backoff?
- ¿Qué diferencia hay entre starvation y livelock?

**Teoría (formalización):** En livelock los procesos no están bloqueados: ejecutan y cambian de estado, pero sus acciones se cancelan mutuamente y no hay progreso útil. Puede resolverse introduciendo espera aleatoria, prioridades o un protocolo que rompa la simetría.

**Modelo visual:** Secuencia repetitiva sin progreso

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "livelock_sequence",
  "procesos": [
    "P1",
    "P2"
  ],
  "ciclo": [
    [
      "P1 cede",
      "P2 cede"
    ],
    [
      "ambos reintentan"
    ],
    [
      "detectan conflicto"
    ],
    [
      "ambos ceden"
    ]
  ],
  "estado": "actividad_sin_progreso",
  "correccion": [
    "backoff_aleatorio",
    "prioridad",
    "romper_simetria"
  ]
}
```

**Notas de revisión:**
- Nuevo caso para livelock, listado en los resúmenes y ausente en el banco.

## SO-044 - Estado inseguro en algoritmo del banquero
**Tema:** Deadlock
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Deadlock: evasión, prevención y algoritmo del banquero.

**Escenario (caso de falla):** Un sistema posee 10 instancias de un recurso. Aceptar una nueva solicitud no genera deadlock inmediato, pero deja al sistema sin una secuencia segura para que todos los procesos puedan terminar.

**Preguntas guía (análisis):**
- ¿Qué diferencia hay entre estado inseguro y deadlock?
- ¿Por qué el algoritmo del banquero puede negar una solicitud disponible?
- ¿Qué es una secuencia segura?
- ¿Qué información necesita conocer el algoritmo?

**Teoría (formalización):** La evasión de deadlocks intenta no entrar en estados inseguros. El algoritmo del banquero requiere conocer máximos reclamos, asignaciones y necesidades. Aunque un recurso esté disponible, la solicitud se niega si después no existe una secuencia segura de finalización.

**Modelo visual:** Matriz de asignación/necesidad

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "bankers_algorithm",
  "recursos_totales": {
    "R": 10
  },
  "procesos": [
    {
      "id": "P1",
      "asignado": 4,
      "maximo": 7,
      "necesidad": 3
    },
    {
      "id": "P2",
      "asignado": 2,
      "maximo": 5,
      "necesidad": 3
    },
    {
      "id": "P3",
      "asignado": 2,
      "maximo": 4,
      "necesidad": 2
    }
  ],
  "disponible": 2,
  "solicitud": {
    "proceso": "P2",
    "cantidad": 1
  },
  "resultado": "negar_si_no_hay_secuencia_segura",
  "concepto": "estado_inseguro_no_es_deadlock"
}
```

**Notas de revisión:**
- Nuevo caso para evasión de deadlocks y algoritmo del banquero.

## SO-045 - Solución con test-and-set garantiza exclusión pero desperdicia CPU
**Tema:** Sincronización
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Sincronización: soluciones hardware y espera activa.

**Escenario (caso de falla):** Dos hilos usan una variable lock protegida por una instrucción atómica test-and-set. La exclusión mutua funciona, pero el hilo que no obtiene el lock queda girando en un bucle consumiendo CPU.

**Preguntas guía (análisis):**
- ¿Qué aporta test-and-set que no aporta una variable común?
- ¿Por qué hay espera activa?
- ¿Qué requisito de sección crítica se cumple y cuál puede verse afectado?
- ¿Cuándo conviene bloquear en lugar de girar?

**Teoría (formalización):** Las instrucciones atómicas de hardware permiten implementar exclusión mutua porque leer y escribir el lock ocurre indivisiblemente. Sin embargo, un spinlock puede desperdiciar CPU si la espera es larga. En sistemas con espera prolongada conviene bloquear o usar primitivas del SO.

**Modelo visual:** Spinlock con test-and-set

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "test_and_set_spinlock",
  "lock_inicial": 0,
  "hilos": [
    {
      "id": "T1",
      "accion": "test_and_set -> obtiene lock"
    },
    {
      "id": "T2",
      "accion": "test_and_set repetido -> espera activa"
    }
  ],
  "cumple": "exclusion_mutua",
  "problema": "busy_waiting",
  "alternativa": "mutex_bloqueante_o_semaforo"
}
```

**Notas de revisión:**
- Nuevo caso para soluciones hardware de sección crítica.

## SO-046 - Uso de if en lugar de while al esperar una condición
**Tema:** Monitores
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Sincronización: monitores.

**Escenario (caso de falla):** En un monitor, un hilo consumidor hace if(buffer_vacio) wait(). Al despertar, asume que hay datos. Sin embargo, otro consumidor tomó el dato antes o hubo un despertar espurio, y el buffer vuelve a estar vacío.

**Preguntas guía (análisis):**
- ¿Por qué la condición debe re-evaluarse después de wait()?
- ¿Qué diferencia hay entre if y while en un monitor?
- ¿Qué problema aparece con múltiples consumidores?
- ¿Cómo se formula correctamente la espera?

**Teoría (formalización):** En monitores y variables de condición, wait() no garantiza que la condición siga siendo verdadera al despertar. Por eso debe usarse while(condición_no_cumplida) wait(). Esto protege contra despertares espurios y cambios provocados por otros hilos.

**Modelo visual:** Monitor con variable de condición

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "monitor_condition_variable",
  "codigo_incorrecto": "if vacío: wait(); consumir();",
  "codigo_correcto": "while vacío: wait(); consumir();",
  "eventos": [
    [
      "C1 espera"
    ],
    [
      "Productor signal"
    ],
    [
      "C2 consume antes"
    ],
    [
      "C1 despierta y falla"
    ]
  ],
  "concepto": "rechequear_condicion"
}
```

**Notas de revisión:**
- Nuevo caso para monitores y variables de condición.

## SO-047 - Violación de condiciones de Bernstein
**Tema:** Sincronización
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Sincronización: condiciones de Bernstein.

**Escenario (caso de falla):** Dos tareas se ejecutan en paralelo: S1 calcula x = a + b y S2 calcula a = x + 1. Como S2 lee x mientras S1 escribe x, el resultado depende del orden de ejecución.

**Preguntas guía (análisis):**
- ¿Qué conjuntos de lectura y escritura tiene cada sentencia?
- ¿Qué condición de Bernstein se viola?
- ¿Por qué no toda concurrencia es segura?
- ¿Cómo podrías serializar o sincronizar estas tareas?

**Teoría (formalización):** Las condiciones de Bernstein permiten determinar si dos sentencias pueden ejecutarse concurrentemente sin interferencia. Si una sentencia escribe una variable que otra lee o escribe, hay dependencia y el resultado puede variar. En ese caso se requiere ordenamiento o sincronización.

**Modelo visual:** Conjuntos R/W de instrucciones

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "bernstein_conditions",
  "sentencias": [
    {
      "id": "S1",
      "lee": [
        "a",
        "b"
      ],
      "escribe": [
        "x"
      ]
    },
    {
      "id": "S2",
      "lee": [
        "x"
      ],
      "escribe": [
        "a"
      ]
    }
  ],
  "violaciones": [
    {
      "tipo": "write_read",
      "variable": "x",
      "entre": [
        "S1",
        "S2"
      ]
    }
  ],
  "pueden_concurrir": false,
  "correccion": "ordenar_S1_antes_de_S2_o_sincronizar"
}
```

**Notas de revisión:**
- Nuevo caso para condiciones de Bernstein.

## SO-048 - TLB desactualizada tras cambio de contexto
**Tema:** Memoria virtual
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Memoria: traducción de direcciones y tablas de páginas.

**Escenario (caso de falla):** El CPU ejecuta P1 y guarda en la TLB traducciones de sus páginas. Luego cambia a P2. Si la TLB no se limpia ni usa ASID, una dirección virtual de P2 podría traducirse usando un frame perteneciente a P1.

**Preguntas guía (análisis):**
- ¿Por qué dos procesos pueden usar la misma dirección virtual para datos distintos?
- ¿Qué problema aparece si la TLB conserva entradas del proceso anterior?
- ¿Cómo ayudan flush de TLB o ASID?
- ¿Qué relación tiene esto con cambio de contexto?

**Teoría (formalización):** La TLB acelera la traducción de direcciones, pero sus entradas dependen del espacio de direcciones del proceso. En un cambio de contexto, el SO debe invalidar entradas o usar identificadores de espacio de direcciones para distinguir procesos. De lo contrario se viola aislamiento.

**Modelo visual:** TLB antes y después del cambio de contexto

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "tlb_context_switch",
  "antes": {
    "proceso": "P1",
    "tlb": [
      {
        "vpn": 5,
        "frame": 100,
        "asid": "P1"
      }
    ]
  },
  "evento": "context_switch a P2",
  "riesgo_sin_asid": "P2 VPN5 -> frame100 de P1",
  "correcciones": [
    "flush_TLB",
    "ASID/PCID"
  ],
  "concepto": "aislamiento_espacio_direcciones"
}
```

**Notas de revisión:**
- Nuevo caso para TLB, traducción y cambio de contexto.

## SO-049 - Buddy System desperdicia memoria por potencias de dos
**Tema:** Memoria
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Memoria: Buddy System.

**Escenario (caso de falla):** Un proceso solicita 33 KB y el Buddy System le asigna un bloque de 64 KB porque trabaja dividiendo bloques en potencias de dos. La asignación es rápida y facilita combinación de buddies, pero queda memoria interna desperdiciada.

**Preguntas guía (análisis):**
- ¿Por qué se asigna 64 KB para una solicitud de 33 KB?
- ¿Qué ventaja tiene dividir y fusionar buddies?
- ¿Qué tipo de fragmentación aparece?
- ¿Cómo se libera y combina memoria al finalizar el proceso?

**Teoría (formalización):** Buddy System administra memoria dividiendo bloques en mitades hasta encontrar el menor bloque potencia de dos suficiente. Esto facilita búsqueda y coalescing al liberar, pero puede producir fragmentación interna cuando la solicitud no ajusta al tamaño del bloque asignado.

**Modelo visual:** Árbol de Buddy System

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "buddy_system",
  "bloque_inicial_kb": 128,
  "solicitud_kb": 33,
  "bloque_asignado_kb": 64,
  "desperdicio_kb": 31,
  "operaciones": [
    "split 128->64+64",
    "asignar 64"
  ],
  "al_liberar": "fusionar_si_buddy_libre"
}
```

**Notas de revisión:**
- Nuevo caso para Buddy System.

## SO-050 - Violación de límite en segmentación
**Tema:** Memoria
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Memoria: segmentación y protección.

**Escenario (caso de falla):** Un proceso tiene un segmento de código de 4 KB y un segmento de datos de 8 KB. Una instrucción intenta acceder al segmento de datos con desplazamiento 9000. El número de segmento es válido, pero el offset supera el límite.

**Preguntas guía (análisis):**
- ¿Qué valida la tabla de segmentos?
- ¿Por qué el segmento puede existir y aun así fallar el acceso?
- ¿Qué diferencia hay entre base y límite?
- ¿Cómo se compara con paginación?

**Teoría (formalización):** En segmentación, una dirección lógica se compone de número de segmento y desplazamiento. La tabla de segmentos provee base y límite. Si el offset excede el límite, se produce una excepción de protección aunque el segmento exista. Esto evita accesos fuera de la región permitida.

**Modelo visual:** Tabla de segmentos

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "segmentation_check",
  "segmentos": [
    {
      "id": 0,
      "nombre": "codigo",
      "base": 1000,
      "limite": 4096
    },
    {
      "id": 1,
      "nombre": "datos",
      "base": 8000,
      "limite": 8192
    }
  ],
  "direccion": {
    "segmento": 1,
    "offset": 9000
  },
  "resultado": "segmentation_fault",
  "motivo": "offset_mayor_que_limite"
}
```

**Notas de revisión:**
- Nuevo caso para segmentación simple.

## SO-051 - Tabla de páginas invertida con colisiones
**Tema:** Memoria virtual
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Memoria: estructura de tablas de páginas e invertidas.

**Escenario (caso de falla):** Un sistema usa tabla de páginas invertida para ahorrar memoria. Dos entradas distintas generan el mismo hash. La búsqueda no falla, pero debe recorrer una lista de colisiones para encontrar la combinación correcta de PID y página virtual.

**Preguntas guía (análisis):**
- ¿Por qué una tabla invertida tiene una entrada por frame y no por página virtual?
- ¿Qué se busca usando PID + VPN?
- ¿Por qué una colisión de hash no implica error?
- ¿Qué costo agrega resolver colisiones?

**Teoría (formalización):** La tabla de páginas invertida reduce memoria al tener una entrada por marco físico. Como múltiples procesos pueden tener las mismas VPN, se identifica cada entrada con PID/ASID y VPN. Una tabla hash acelera la búsqueda, pero las colisiones agregan recorridos adicionales.

**Modelo visual:** Hash sobre tabla invertida

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "inverted_page_table_hash",
  "busqueda": {
    "pid": "P2",
    "vpn": 12
  },
  "hash_bucket": [
    {
      "pid": "P1",
      "vpn": 12,
      "frame": 4
    },
    {
      "pid": "P2",
      "vpn": 12,
      "frame": 9
    }
  ],
  "resultado": "frame 9",
  "costo": "recorrer_colisiones",
  "beneficio": "menor_memoria_para_tablas"
}
```

**Notas de revisión:**
- Nuevo caso para tablas invertidas y hash.

## SO-052 - Cadena FAT rota por entrada corrupta
**Tema:** File System
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** FAT/EXT2: funcionamiento FAT.

**Escenario (caso de falla):** Un archivo en FAT ocupa los clusters 5 -> 8 -> 13 -> EOF. Una falla corrompe la entrada del cluster 8 y apunta a un cluster inválido. El directorio aún muestra el archivo, pero al leerlo se corta o recupera datos incorrectos.

**Preguntas guía (análisis):**
- ¿Dónde se guarda la cadena de bloques en FAT?
- ¿Por qué el directorio puede existir aunque el contenido esté dañado?
- ¿Qué diferencia hay con un esquema basado en inodos?
- ¿Qué herramienta podría detectar cadenas perdidas o inválidas?

**Teoría (formalización):** En FAT, la tabla mantiene la cadena de clusters de cada archivo. Si una entrada se corrompe, la ruta hacia los datos se rompe aunque el directorio conserve nombre y tamaño. Herramientas de chequeo pueden detectar cadenas inválidas o clusters perdidos.

**Modelo visual:** Cadena de clusters FAT

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "fat_chain",
  "archivo": "notas.txt",
  "directorio": {
    "cluster_inicial": 5,
    "tamanio": "12KB"
  },
  "fat": {
    "5": 8,
    "8": "corrupto->999",
    "13": "EOF"
  },
  "esperado": [
    5,
    8,
    13
  ],
  "resultado": "lectura_falla",
  "recuperacion": "fsck/chkdsk"
}
```

**Notas de revisión:**
- Nuevo caso para FAT.

## SO-053 - Hard link conserva datos; soft link queda colgado
**Tema:** File System
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** EXT2: inodos, hardlinks y softlinks.

**Escenario (caso de falla):** Un archivo informe.txt tiene un hard link copia.txt y un soft link acceso.txt. Luego se elimina informe.txt. copia.txt sigue abriendo los datos porque apunta al mismo inodo; acceso.txt falla porque apunta a un nombre de ruta que ya no existe.

**Preguntas guía (análisis):**
- ¿Qué apunta a qué en un hard link?
- ¿Qué guarda un soft link?
- ¿Por qué el inodo no se libera mientras haya hard links?
- ¿Qué significa que un symlink quede colgado?

**Teoría (formalización):** Un hard link es otra entrada de directorio que referencia el mismo inodo. Los datos se liberan cuando el contador de enlaces llega a cero. Un soft link es un archivo especial que contiene una ruta; si la ruta desaparece, el enlace queda roto.

**Modelo visual:** Inodo y enlaces

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "links_inode",
  "inodo": 321,
  "entradas_antes": {
    "informe.txt": 321,
    "copia.txt": 321,
    "acceso.txt": "symlink->informe.txt"
  },
  "evento": "rm informe.txt",
  "entradas_despues": {
    "copia.txt": 321,
    "acceso.txt": "symlink_roto"
  },
  "link_count": 1
}
```

**Notas de revisión:**
- Nuevo caso para hardlinks y softlinks.

## SO-054 - Archivo mapeado a memoria no sincronizado
**Tema:** Memoria virtual y File System
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** File System: archivos mapeados a memoria.

**Escenario (caso de falla):** Una aplicación modifica un archivo usando mmap(). La modificación se ve como escritura en memoria. Antes de sincronizar con msync() o cerrar/desmapear correctamente, el proceso termina abruptamente. Los cambios pueden no quedar persistidos como esperaba el usuario.

**Preguntas guía (análisis):**
- ¿Por qué mmap permite tratar un archivo como memoria?
- ¿Qué relación hay entre páginas sucias y persistencia?
- ¿Qué función cumple msync()?
- ¿En qué se parece y en qué difiere de write()+fsync()?

**Teoría (formalización):** Los archivos mapeados a memoria usan el mecanismo de memoria virtual para acceder a archivos mediante direcciones. Las modificaciones ensucian páginas que luego deben sincronizarse con el almacenamiento. msync() fuerza o coordina esa persistencia.

**Modelo visual:** Mapa archivo-páginas

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "memory_mapped_file",
  "archivo": "datos.bin",
  "mapeo": {
    "vpn": [
      40,
      41
    ],
    "offsets": [
      "0-4095",
      "4096-8191"
    ]
  },
  "evento": "write en memoria VPN40",
  "estado": "pagina_sucia",
  "riesgo": "no_persistido_si_no_sync",
  "correccion": [
    "msync",
    "munmap_correcto"
  ]
}
```

**Notas de revisión:**
- Nuevo caso de mmap y msync.

## SO-055 - Confusión entre E/S asincrónica y no bloqueante
**Tema:** Entrada/Salida
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Entrada/Salida: clasificación de E/S.

**Escenario (caso de falla):** Una aplicación realiza una llamada de E/S no bloqueante. Como el dato aún no está disponible, la llamada retorna inmediatamente con 'reintentar'. Un alumno concluye que eso es lo mismo que E/S asincrónica, aunque no se programó ninguna notificación de finalización.

**Preguntas guía (análisis):**
- ¿Qué significa que una llamada sea no bloqueante?
- ¿Qué significa que una operación sea asincrónica?
- ¿Puede una operación ser sincrónica y no bloqueante?
- ¿Qué debe hacer la aplicación si recibe 'reintentar'?

**Teoría (formalización):** Bloqueante/no bloqueante describe si la llamada espera o retorna. Sincrónica/asincrónica describe cómo se informa o se obtiene la finalización. Una E/S sincrónica no bloqueante puede retornar 'no listo' y exigir polling posterior. En E/S asincrónica, se registra una operación y luego llega una notificación o callback.

**Modelo visual:** Matriz de clasificación de E/S

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "io_classification_matrix",
  "caso": {
    "sincronica": true,
    "bloqueante": false,
    "retorno": "EAGAIN/reintentar"
  },
  "contraste": {
    "asincronica_no_bloqueante": "se_registra_operacion_y_notifica_fin"
  },
  "acciones_app": [
    "reintentar_luego",
    "usar_select_poll_epoll",
    "usar_async_io"
  ]
}
```

**Notas de revisión:**
- Nuevo caso para clasificación de E/S bloqueante/no bloqueante y síncrona/asíncrona.

## SO-056 - DMA escribe en memoria pero CPU lee datos viejos
**Tema:** Entrada/Salida y DMA
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Entrada/Salida: DMA y drivers.

**Escenario (caso de falla):** Un dispositivo usa DMA para copiar datos a memoria. La CPU tenía en caché una versión vieja de esa región y, si no se invalida o sincroniza la caché, el proceso puede leer datos obsoletos.

**Preguntas guía (análisis):**
- ¿Qué ventaja aporta DMA respecto de E/S por interrupciones?
- ¿Por qué aparece un problema de coherencia de caché?
- ¿Qué debe coordinar el driver?
- ¿Qué pasaría si la CPU y el DMA escriben simultáneamente la misma región?

**Teoría (formalización):** DMA reduce intervención de CPU al transferir directamente entre dispositivo y memoria. Pero el driver debe coordinar buffers, permisos y coherencia de caché. Si la CPU mantiene datos cacheados, puede leer valores viejos hasta que se invalide o sincronice la región.

**Modelo visual:** Flujo DMA y caché

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "dma_cache_coherence",
  "actores": [
    "CPU_cache",
    "RAM",
    "DMA_device",
    "driver"
  ],
  "evento": "DMA escribe buffer en RAM",
  "riesgo": "CPU lee copia vieja en cache",
  "correccion": [
    "invalidate_cache",
    "flush_cache",
    "buffers_coherentes",
    "barreras_memoria"
  ]
}
```

**Notas de revisión:**
- Nuevo caso avanzado pero útil para E/S y drivers.

## SO-057 - RAID 0 mejora rendimiento pero aumenta riesgo de pérdida total
**Tema:** Entrada/Salida
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Entrada/Salida: RAID 0, RAID 1 y RAID 5.

**Escenario (caso de falla):** Un sistema usa RAID 0 para dividir datos en franjas entre dos discos. Las lecturas son rápidas porque ambos discos trabajan en paralelo. Un disco falla y el volumen completo queda inutilizable porque cada archivo tenía partes distribuidas.

**Preguntas guía (análisis):**
- ¿Por qué RAID 0 mejora rendimiento?
- ¿Qué información de redundancia guarda RAID 0?
- ¿Por qué falla todo el volumen si se rompe un disco?
- ¿Cómo cambiaría el caso con RAID 1 o RAID 5?

**Teoría (formalización):** RAID 0 usa striping para aumentar rendimiento y capacidad, pero no ofrece redundancia. La falla de un solo disco puede destruir el volumen lógico completo. RAID 1 replica datos y RAID 5 usa paridad distribuida, sacrificando capacidad para tolerancia a fallos.

**Modelo visual:** Distribución de stripes

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "raid_comparison",
  "raid0": {
    "discos": 2,
    "redundancia": false,
    "beneficio": "rendimiento",
    "falla_un_disco": "perdida_total"
  },
  "contraste": {
    "raid1": "espejo",
    "raid5": "paridad_distribuida"
  },
  "concepto": "rendimiento_vs_tolerancia_a_fallos"
}
```

**Notas de revisión:**
- Nuevo caso para RAID.

## SO-058 - Microkernel robusto pero con más cambios de modo
**Tema:** Arquitectura de Kernel
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Introducción: estructura del Sistema Operativo.

**Escenario (caso de falla):** Un equipo migra un servicio de filesystem desde kernel space a user space siguiendo un diseño microkernel. Los fallos del servicio ya no tiran abajo todo el kernel, pero las operaciones de archivo requieren más mensajes y cambios de modo.

**Preguntas guía (análisis):**
- ¿Qué gana el diseño microkernel en robustez?
- ¿Por qué puede aumentar el overhead?
- ¿Qué funcionalidades quedan mínimas en kernel?
- ¿Cómo contrasta con un kernel monolítico?

**Teoría (formalización):** En un microkernel se dejan en modo kernel funciones básicas como IPC, planificación y memoria, moviendo servicios a espacio de usuario. Esto mejora aislamiento y robustez, pero puede aumentar overhead por IPC y cambios de modo. En un monolítico, más servicios corren dentro del kernel.

**Modelo visual:** Capas monolítico vs microkernel

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "kernel_architecture_comparison",
  "monolitico": {
    "kernel": [
      "scheduler",
      "filesystem",
      "drivers",
      "memoria"
    ],
    "overhead": "menor",
    "aislamiento": "menor"
  },
  "microkernel": {
    "kernel": [
      "IPC",
      "scheduler",
      "memoria_basica"
    ],
    "user_space": [
      "filesystem",
      "drivers"
    ],
    "overhead": "mayor",
    "aislamiento": "mayor"
  },
  "tradeoff": "robustez_vs_overhead"
}
```

**Notas de revisión:**
- Nuevo caso para arquitectura de kernel.

## SO-059 - Prepaging carga páginas que nunca se usan
**Tema:** Memoria virtual
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Memoria virtual: paginación bajo demanda y adelantada.

**Escenario (caso de falla):** Al iniciar un proceso, el SO usa prepaging y trae varias páginas contiguas porque asume localidad espacial. El proceso finalmente usa solo la primera; las demás ocupan frames que podrían necesitar otros procesos.

**Preguntas guía (análisis):**
- ¿Qué intenta aprovechar prepaging?
- ¿Cuándo se convierte en una desventaja?
- ¿Cómo se diferencia de paginación bajo demanda?
- ¿Qué impacto puede tener sobre page faults y frames libres?

**Teoría (formalización):** Prepaging anticipa referencias futuras cargando páginas antes de ser pedidas. Puede reducir page faults si acierta, pero desperdicia memoria y E/S si trae páginas que no se usarán. La paginación bajo demanda carga solo al producirse la necesidad.

**Modelo visual:** Comparación demand paging vs prepaging

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "prepaging_scenario",
  "referencia_inicial": "pagina_0",
  "prepaging_carga": [
    0,
    1,
    2,
    3
  ],
  "uso_real": [
    0
  ],
  "desperdicio": [
    1,
    2,
    3
  ],
  "beneficio_si_acierta": "menos_page_faults",
  "costo_si_falla": "frames_ocupados_y_E/S_extra"
}
```

**Notas de revisión:**
- Nuevo caso para paginación adelantada vs bajo demanda.

## SO-060 - Proceso bloqueado suspendido se desbloquea pero sigue fuera de RAM
**Tema:** Planificación y suspensión
**Tipo de material:** Caso nuevo agregado en la revisión
**Alineación con el resumen:** Procesos y planificación: siete estados, swap y suspensión.

**Escenario (caso de falla):** Un proceso estaba Blocked/Suspended porque esperaba E/S y sus estructuras fueron enviadas a swap. La E/S termina, por lo que pasa a Ready/Suspended, pero todavía no puede ejecutar hasta que el planificador de mediano plazo lo traiga nuevamente a RAM.

**Preguntas guía (análisis):**
- ¿Por qué no pasa directamente a Ready?
- ¿Qué significa que un proceso esté suspendido?
- ¿Qué planificador decide el swap-in?
- ¿Qué estructuras permanecen disponibles aunque el proceso esté suspendido?

**Teoría (formalización):** En el modelo de siete estados, suspensión significa que las estructuras del proceso están fuera de memoria principal, salvo información necesaria como el PCB. Si un evento esperado termina, el proceso deja de estar bloqueado pero continúa suspendido: pasa a Ready/Suspended hasta que el planificador de mediano plazo realice swap-in.

**Modelo visual:** Diagrama de siete estados

**Datos del modelo visual (JSON):**

```json
{
  "tipo": "seven_state_model",
  "estado_inicial": "Blocked/Suspended",
  "evento": "fin de E/S",
  "estado_intermedio": "Ready/Suspended",
  "evento_siguiente": "swap-in por planificador mediano plazo",
  "estado_final": "Ready",
  "estructura_residente": "PCB"
}
```

**Notas de revisión:**
- Nuevo caso para estados suspendidos y planificador de mediano plazo.
