// JSON crudo de ejemplo para cada `tipo` registrado — tal cual lo pegaría un
// docente en el textarea del formulario. Estos son los 60 casos del banco
// "Sistemas Operativos" (uno por `tipo`) más los 6 esquemas legacy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REGISTRY_EXAMPLES: Record<string, any> = {
  resource_allocation_graph: {
    tipo: 'resource_allocation_graph',
    procesos: ['P1', 'P2'],
    recursos: [
      { id: 'R1', nombre: 'Impresora', instancias: 1 },
      { id: 'R2', nombre: 'Escáner', instancias: 1 },
    ],
    asignaciones: [
      { recurso: 'R1', proceso: 'P1' },
      { recurso: 'R2', proceso: 'P2' },
    ],
    solicitudes: [
      { proceso: 'P1', recurso: 'R2' },
      { proceso: 'P2', recurso: 'R1' },
    ],
    ciclo_detectado: ['P1', 'R2', 'P2', 'R1', 'P1'],
    condiciones_coffman: ['exclusion_mutua', 'retencion_y_espera', 'no_apropiacion', 'espera_circular'],
    estrategia_prevencion: 'orden_global_de_recursos',
  },

  dining_philosophers: {
    tipo: 'dining_philosophers',
    filosofos: ['F0', 'F1', 'F2', 'F3', 'F4'],
    tenedores: ['T0', 'T1', 'T2', 'T3', 'T4'],
    asignaciones: [
      ['T0', 'F0'],
      ['T1', 'F1'],
      ['T2', 'F2'],
      ['T3', 'F3'],
      ['T4', 'F4'],
    ],
    solicitudes: [
      ['F0', 'T1'],
      ['F1', 'T2'],
      ['F2', 'T3'],
      ['F3', 'T4'],
      ['F4', 'T0'],
    ],
    estado: 'deadlock',
    prevenciones: ['arbitro', 'orden_global', 'limitar_a_N_menos_1'],
  },

  seven_state_model: {
    tipo: 'seven_state_model',
    estado_inicial: 'Blocked/Suspended',
    evento: 'fin de E/S',
    estado_intermedio: 'Ready/Suspended',
    evento_siguiente: 'swap-in por planificador mediano plazo',
    estado_final: 'Ready',
    estructura_residente: 'PCB',
  },

  state_transition_validation: {
    tipo: 'state_transition_validation',
    transicion_propuesta: 'Ready->Blocked',
    valida: false,
    motivo: 'el proceso no ejecuta instrucciones en Ready',
    secuencia_correcta: ['Ready', 'Running', 'Blocked'],
    evento_bloqueante: 'syscall de E/S',
  },

  gantt_comparativo: {
    tipo: 'gantt_comparativo',
    procesos: [
      { id: 'P1', tipo: 'CPU-bound', llegada: 0, cpu: 20 },
      { id: 'P2', tipo: 'interactivo', llegada: 1, cpu: 2 },
      { id: 'P3', tipo: 'interactivo', llegada: 2, cpu: 1 },
      { id: 'P4', tipo: 'interactivo', llegada: 3, cpu: 2 },
    ],
    fcfs: [
      { p: 'P1', ini: 0, fin: 20 },
      { p: 'P2', ini: 20, fin: 22 },
      { p: 'P3', ini: 22, fin: 23 },
      { p: 'P4', ini: 23, fin: 25 },
    ],
    problema: 'altos tiempos de espera para procesos cortos',
    alternativas: ['Round Robin', 'SJF/SRTF'],
  },

  memory_map_external_fragmentation: {
    tipo: 'memory_map_external_fragmentation',
    unidad: 'MB',
    segmentos: [
      ['0-100', 'P1'],
      ['100-140', 'Libre'],
      ['140-260', 'P2'],
      ['260-310', 'Libre'],
      ['310-430', 'P3'],
      ['430-500', 'Libre'],
    ],
    solicitud: { proceso: 'P4', tam: 120 },
    libre_total: 160,
    bloque_maximo: 70,
    resultado: 'fallo_por_fragmentacion_externa',
  },

  fixed_partition_map: {
    tipo: 'fixed_partition_map',
    particion_mb: 64,
    particiones: [
      { id: 'Part1', proceso: 'P1', usado: 10, desperdicio: 54 },
      { id: 'Part2', proceso: 'P2', usado: 40, desperdicio: 24 },
      { id: 'Part3', proceso: 'P3', usado: 63, desperdicio: 1 },
    ],
    desperdicio_total: 79,
    tipo_fragmentacion: 'interna',
  },

  copy_on_write: {
    tipo: 'copy_on_write',
    antes: {
      padre: { VPN5: { frame: 80, perm: 'R', cow: true } },
      hijo: { VPN5: { frame: 80, perm: 'R', cow: true } },
    },
    evento: 'hijo escribe VPN5',
    despues: {
      padre: { VPN5: { frame: 80, perm: 'R', cow: true } },
      hijo: { VPN5: { frame: 112, perm: 'RW', cow: false } },
    },
    beneficio: 'copia_diferida',
  },

  write_cache_sequence: {
    tipo: 'write_cache_sequence',
    eventos: [
      ['t0', 'app', 'write(datos)'],
      ['t1', 'kernel', 'buffer_cache'],
      ['t2', 'app', 'muestra_guardado'],
      ['t3', 'corte_energia'],
      ['t4', 'reinicio', 'archivo_incompleto'],
    ],
    correccion: ['fsync', 'journaling', 'flush_periodico'],
    concepto: 'persistencia_no_equivale_a_write_retorno',
  },

  filesystem_transaction: {
    tipo: 'filesystem_transaction',
    operacion: 'crear_archivo',
    pasos: ['reservar_inodo', 'asignar_bloques', 'escribir_datos', 'actualizar_directorio', 'actualizar_bitmap', 'actualizar_atributos'],
    fallo_en: 'actualizar_directorio',
    recuperacion: { sin_journal: 'fsck/chkdsk', con_journal: 'replay_or_rollback' },
    metadatos: ['inodo', 'directorio', 'bitmap', 'tamaño'],
  },

  unix_permissions_path: {
    tipo: 'unix_permissions_path',
    ruta: ['/', 'proyectos', 'so', 'parcial.txt'],
    permisos: { proyectos: 'r-x', so: 'r--', 'parcial.txt': 'r--' },
    usuario: 'alumno',
    operacion: 'open_read',
    fallo_en: 'so',
    motivo: 'directorio_sin_execute',
    resultado: 'EACCES',
  },

  io_techniques_comparison: {
    tipo: 'io_techniques_comparison',
    tecnicas: [
      { nombre: 'programada', cpu: 'polling_constante', overhead: 'alto' },
      { nombre: 'interrupciones', cpu: 'continua_otros_procesos', overhead: 'medio' },
      { nombre: 'DMA', cpu: 'programa_transferencia_y_recibe_interrupcion_final', overhead: 'bajo' },
    ],
    fallo: 'cpu_ocupada_sin_trabajo_util',
    correccion: 'interrupciones_o_DMA',
  },

  io_ring_buffer: {
    tipo: 'io_ring_buffer',
    buffer: { capacidad: 4, ocupado: 4 },
    productor: 'NIC',
    consumidor: 'driver/kernel',
    eventos: [
      ['t0', 'llegan paquetes 1-4'],
      ['t1', 'buffer lleno'],
      ['t2', 'llega paquete 5'],
      ['t3', 'drop u overwrite'],
    ],
    correcciones: ['ring_buffer_mayor', 'DMA', 'control_de_flujo', 'priorizar_interrupcion_io'],
  },

  disk_scheduling: {
    tipo: 'disk_scheduling',
    politica: 'SSTF',
    cabezal_inicial: 50,
    solicitudes: [48, 52, 55, 53, 90],
    atendidas: [52, 53, 55, 48],
    postergada: 90,
    problema: 'starvation_solicitud_lejana',
    alternativas: ['SCAN', 'C-SCAN', 'LOOK', 'C-LOOK'],
  },

  file_locking_sequence: {
    tipo: 'file_locking_sequence',
    archivo: 'config.json',
    eventos: [
      ['t0', 'W abre y escribe mitad nueva'],
      ['t1', 'R lee archivo parcial'],
      ['t2', 'W termina'],
    ],
    fallo: 'lectura_inconsistente',
    correcciones: ['lock_exclusivo_para_W', 'lock_compartido_para_R', 'write_temp_plus_rename'],
    locks: ['shared', 'exclusive'],
  },

  setuid_flow: {
    tipo: 'setuid_flow',
    usuario: { uid_real: 'alumno', uid_efectivo_inicial: 'alumno' },
    ejecutable: { owner: 'root', setuid: true },
    durante_ejecucion: { uid_efectivo: 'root' },
    fallo: 'validacion_insuficiente',
    riesgo: 'privilege_escalation',
    controles: ['validar_rutas', 'drop_privileges', 'least_privilege'],
  },

  memory_protection: {
    tipo: 'memory_protection',
    sistema: 'sin_proteccion',
    procesos: [
      { id: 'P1', rango: '0-999' },
      { id: 'P2', rango: '1000-1999' },
    ],
    evento: { proceso: 'P1', write_addr: 1200 },
    resultado: 'corrompe_memoria_de_P2',
    correccion: ['MMU', 'base_limit', 'page_table_permissions', 'modo_usuario'],
  },

  syscall_overhead: {
    tipo: 'syscall_overhead',
    patron_malo: { writes: 10000, bytes_por_write: 4 },
    patron_mejor: { writes: 40, bytes_por_write: 1000 },
    costos: ['mode_switch', 'validacion', 'copias', 'planificacion_io'],
    correcciones: ['buffering', 'writev', 'bloques_mayores'],
  },

  boot_sequence: {
    tipo: 'boot_sequence',
    pasos: [
      { orden: 1, componente: 'firmware/bootloader', estado: 'ok' },
      { orden: 2, componente: 'kernel', estado: 'ok' },
      { orden: 3, componente: 'init/systemd', estado: 'falla' },
      { orden: 4, componente: 'servicios', estado: 'no_iniciados' },
      { orden: 5, componente: 'login', estado: 'no_disponible' },
    ],
    recuperacion: ['modo_rescue', 'init_alternativo', 'rollback_configuracion'],
  },

  privileged_instruction_fault: {
    tipo: 'privileged_instruction_fault',
    modo_inicial: 'usuario',
    instruccion: 'CLI/deshabilitar_interrupciones',
    resultado: 'excepcion',
    psw: { modo: 'user' },
    accion_so: ['registrar_evento', 'enviar_signal', 'terminar_proceso'],
    conceptos: ['modo_usuario', 'modo_kernel', 'instrucciones_privilegiadas'],
  },

  process_state_transition: {
    tipo: 'process_state_transition',
    eventos: [
      ['t0', 'P1', 'Running'],
      ['t1', 'P1 invoca read() bloqueante', 'Blocked'],
      ['t2', 'interrupción de fin de E/S', 'Ready'],
      ['t3', 'scheduler dispatch', 'Running'],
    ],
    transicion_invalida: 'Blocked->Running directo',
    planificador: 'corto_plazo',
  },

  mode_vs_context_switch: {
    tipo: 'mode_vs_context_switch',
    secuencia: [
      { evento: 'P1 en usuario', modo: 'user', proceso: 'P1' },
      { evento: 'syscall time()', modo: 'kernel', proceso: 'P1' },
      { evento: 'retorno', modo: 'user', proceso: 'P1' },
    ],
    cambio_modo: true,
    cambio_proceso: false,
    concepto_clave: 'no_todo_cambio_de_modo_implica_cambio_de_proceso',
  },

  nested_interrupt: {
    tipo: 'nested_interrupt',
    contexto_inicial: 'rutina_syscall',
    interrupcion: { fuente: 'placa_red', prioridad: 'alta' },
    pasos: ['guardar_contexto_syscall', 'ejecutar_interrupt_handler', 'restaurar_contexto_syscall', 'continuar_syscall'],
    estrategias: ['secuencial', 'prioridad', 'deshabilitar_interrupciones'],
  },

  long_term_scheduler: {
    tipo: 'long_term_scheduler',
    grado_maximo: 5,
    activos: ['P1', 'P2', 'P3', 'P4', 'P5'],
    nuevo: 'P6',
    estado_p6: 'New',
    condicion_para_admitir: 'disminuye_grado_multiprogramacion',
    transicion: 'New->Ready',
  },

  ult_blocking_without_jacketing: {
    tipo: 'ult_blocking_without_jacketing',
    klt: 'K1',
    ults: ['U1', 'U2', 'U3'],
    evento: 'U1 invoca read() bloqueante',
    vista_kernel: 'K1 bloqueado',
    resultado: { U1: 'blocked', U2: 'no_ejecuta', U3: 'no_ejecuta' },
    correcciones: ['jacketing', 'usar_KLTs', 'I/O_no_bloqueante'],
  },

  ult_jacketing_sequence: {
    tipo: 'ult_jacketing_sequence',
    evento: 'U1 solicita fwrite_ULT',
    biblioteca: ['convierte a syscall no bloqueante', 'marca U1 como waiting interno', 'planifica U2', 'consulta finalización'],
    kernel: 'no bloquea KLT completo',
    beneficio: 'continua_planificacion_ULT',
  },

  thread_mapping: {
    tipo: 'thread_mapping',
    cores: 4,
    modelo: 'N:1',
    ults: ['U1', 'U2', 'U3', 'U4'],
    klts: ['K1'],
    paralelismo_real: 1,
    correccion: 'modelo_1:1_o_M:N',
  },

  hrrn_table: {
    tipo: 'hrrn_table',
    procesos: [
      { id: 'P_largo', S: 20, W: 80, RR: 5.0 },
      { id: 'P_corto1', S: 3, W: 3, RR: 2.0 },
      { id: 'P_corto2', S: 2, W: 1, RR: 1.5 },
    ],
    seleccion: 'P_largo',
    concepto: 'aging_implicito',
  },

  virtual_round_robin: {
    tipo: 'virtual_round_robin',
    quantum: 5,
    proceso_io: { id: 'Pio', usa_cpu: 1, io: 4, remanente: 4 },
    colas: { auxiliar: ['Pio'], ready: ['Pcpu1', 'Pcpu2'] },
    regla: 'ejecutar_auxiliar_antes_de_ready',
    beneficio: 'mejor_tiempo_respuesta',
  },

  multilevel_feedback_queue: {
    tipo: 'multilevel_feedback_queue',
    colas: [
      { nivel: 0, prioridad: 'alta', quantum: 2 },
      { nivel: 1, prioridad: 'media', quantum: 4 },
      { nivel: 2, prioridad: 'baja', quantum: 8 },
    ],
    eventos: [
      ['Pcpu consume quantum completo', 'degrada'],
      ['Pio bloquea antes del quantum', 'mantiene/promueve'],
    ],
    riesgo: 'starvation_colas_bajas',
    correccion: 'aging_o_boost_periodico',
  },

  livelock_sequence: {
    tipo: 'livelock_sequence',
    procesos: ['P1', 'P2'],
    ciclo: [['P1 cede', 'P2 cede'], ['ambos reintentan'], ['detectan conflicto'], ['ambos ceden']],
    estado: 'actividad_sin_progreso',
    correccion: ['backoff_aleatorio', 'prioridad', 'romper_simetria'],
  },

  bankers_algorithm: {
    tipo: 'bankers_algorithm',
    recursos_totales: { R: 10 },
    procesos: [
      { id: 'P1', asignado: 4, maximo: 7, necesidad: 3 },
      { id: 'P2', asignado: 2, maximo: 5, necesidad: 3 },
      { id: 'P3', asignado: 2, maximo: 4, necesidad: 2 },
    ],
    disponible: 2,
    solicitud: { proceso: 'P2', cantidad: 1 },
    resultado: 'negar_si_no_hay_secuencia_segura',
    concepto: 'estado_inseguro_no_es_deadlock',
  },

  test_and_set_spinlock: {
    tipo: 'test_and_set_spinlock',
    lock_inicial: 0,
    hilos: [
      { id: 'T1', accion: 'test_and_set -> obtiene lock' },
      { id: 'T2', accion: 'test_and_set repetido -> espera activa' },
    ],
    cumple: 'exclusion_mutua',
    problema: 'busy_waiting',
    alternativa: 'mutex_bloqueante_o_semaforo',
  },

  monitor_condition_variable: {
    tipo: 'monitor_condition_variable',
    codigo_incorrecto: 'if vacío: wait(); consumir();',
    codigo_correcto: 'while vacío: wait(); consumir();',
    eventos: [['C1 espera'], ['Productor signal'], ['C2 consume antes'], ['C1 despierta y falla']],
    concepto: 'rechequear_condicion',
  },

  bernstein_conditions: {
    tipo: 'bernstein_conditions',
    sentencias: [
      { id: 'S1', lee: ['a', 'b'], escribe: ['x'] },
      { id: 'S2', lee: ['x'], escribe: ['a'] },
    ],
    violaciones: [{ tipo: 'write_read', variable: 'x', entre: ['S1', 'S2'] }],
    pueden_concurrir: false,
    correccion: 'ordenar_S1_antes_de_S2_o_sincronizar',
  },

  tlb_context_switch: {
    tipo: 'tlb_context_switch',
    antes: { proceso: 'P1', tlb: [{ vpn: 5, frame: 100, asid: 'P1' }] },
    evento: 'context_switch a P2',
    riesgo_sin_asid: 'P2 VPN5 -> frame100 de P1',
    correcciones: ['flush_TLB', 'ASID/PCID'],
    concepto: 'aislamiento_espacio_direcciones',
  },

  buddy_system: {
    tipo: 'buddy_system',
    bloque_inicial_kb: 128,
    solicitud_kb: 33,
    bloque_asignado_kb: 64,
    desperdicio_kb: 31,
    operaciones: ['split 128->64+64', 'asignar 64'],
    al_liberar: 'fusionar_si_buddy_libre',
  },

  segmentation_check: {
    tipo: 'segmentation_check',
    segmentos: [
      { id: 0, nombre: 'codigo', base: 1000, limite: 4096 },
      { id: 1, nombre: 'datos', base: 8000, limite: 8192 },
    ],
    direccion: { segmento: 1, offset: 9000 },
    resultado: 'segmentation_fault',
    motivo: 'offset_mayor_que_limite',
  },

  inverted_page_table_hash: {
    tipo: 'inverted_page_table_hash',
    busqueda: { pid: 'P2', vpn: 12 },
    hash_bucket: [
      { pid: 'P1', vpn: 12, frame: 4 },
      { pid: 'P2', vpn: 12, frame: 9 },
    ],
    resultado: 'frame 9',
    costo: 'recorrer_colisiones',
    beneficio: 'menor_memoria_para_tablas',
  },

  fat_chain: {
    tipo: 'fat_chain',
    archivo: 'notas.txt',
    directorio: { cluster_inicial: 5, tamanio: '12KB' },
    fat: { '5': 8, '8': 'corrupto->999', '13': 'EOF' },
    esperado: [5, 8, 13],
    resultado: 'lectura_falla',
    recuperacion: 'fsck/chkdsk',
  },

  links_inode: {
    tipo: 'links_inode',
    inodo: 321,
    entradas_antes: { 'informe.txt': 321, 'copia.txt': 321, 'acceso.txt': 'symlink->informe.txt' },
    evento: 'rm informe.txt',
    entradas_despues: { 'copia.txt': 321, 'acceso.txt': 'symlink_roto' },
    link_count: 1,
  },

  memory_mapped_file: {
    tipo: 'memory_mapped_file',
    archivo: 'datos.bin',
    mapeo: { vpn: [40, 41], offsets: ['0-4095', '4096-8191'] },
    evento: 'write en memoria VPN40',
    estado: 'pagina_sucia',
    riesgo: 'no_persistido_si_no_sync',
    correccion: ['msync', 'munmap_correcto'],
  },

  io_classification_matrix: {
    tipo: 'io_classification_matrix',
    caso: { sincronica: true, bloqueante: false, retorno: 'EAGAIN/reintentar' },
    contraste: { asincronica_no_bloqueante: 'se_registra_operacion_y_notifica_fin' },
    acciones_app: ['reintentar_luego', 'usar_select_poll_epoll', 'usar_async_io'],
  },

  dma_cache_coherence: {
    tipo: 'dma_cache_coherence',
    actores: ['CPU_cache', 'RAM', 'DMA_device', 'driver'],
    evento: 'DMA escribe buffer en RAM',
    riesgo: 'CPU lee copia vieja en cache',
    correccion: ['invalidate_cache', 'flush_cache', 'buffers_coherentes', 'barreras_memoria'],
  },

  raid_comparison: {
    tipo: 'raid_comparison',
    raid0: { discos: 2, redundancia: false, beneficio: 'rendimiento', falla_un_disco: 'perdida_total' },
    contraste: { raid1: 'espejo', raid5: 'paridad_distribuida' },
    concepto: 'rendimiento_vs_tolerancia_a_fallos',
  },

  kernel_architecture_comparison: {
    tipo: 'kernel_architecture_comparison',
    monolitico: { kernel: ['scheduler', 'filesystem', 'drivers', 'memoria'], overhead: 'menor', aislamiento: 'menor' },
    microkernel: { kernel: ['IPC', 'scheduler', 'memoria_basica'], user_space: ['filesystem', 'drivers'], overhead: 'mayor', aislamiento: 'mayor' },
    tradeoff: 'robustez_vs_overhead',
  },

  prepaging_scenario: {
    tipo: 'prepaging_scenario',
    referencia_inicial: 'pagina_0',
    prepaging_carga: [0, 1, 2, 3],
    uso_real: [0],
    desperdicio: [1, 2, 3],
    beneficio_si_acierta: 'menos_page_faults',
    costo_si_falla: 'frames_ocupados_y_E/S_extra',
  },

  priority_queue_aging: {
    tipo: 'priority_queue_aging',
    politica_inicial: 'prioridades_absolutas_sin_aging',
    procesos: [
      { id: 'P_mant', prioridad: 1, estado: 'ready', espera: 30 },
      { id: 'P_crit1', prioridad: 9, estado: 'running' },
      { id: 'P_crit2', prioridad: 8, estado: 'ready' },
    ],
    problema: 'P_mant permanece listo pero no ejecuta',
    metrica_afectada: 'tiempo_de_espera',
    correccion: { tecnica: 'aging', regla: '+1 prioridad cada 5 unidades de espera', resultado: 'el proceso postergado eventualmente supera el umbral de selección' },
  },

  round_robin_overhead: {
    tipo: 'round_robin_overhead',
    quantum: 1,
    cambio_contexto: 0.2,
    procesos: [
      { id: 'P1', cpu: 5 },
      { id: 'P2', cpu: 5 },
      { id: 'P3', cpu: 5 },
    ],
    secuencia: ['P1', 'CS', 'P2', 'CS', 'P3', 'CS', 'P1', 'CS', 'P2', 'CS', 'P3'],
    riesgo: 'overhead_alto',
    comparacion: { quantum_4: 'menos_overhead_pero_menor_interactividad' },
  },

  interleaving_trace: {
    tipo: 'interleaving_trace',
    variable: 'saldo',
    inicial: 1000,
    hilos: ['T1', 'T2'],
    pasos: [
      ['T1', 'read', 1000],
      ['T2', 'read', 1000],
      ['T1', 'compute', 1100],
      ['T2', 'compute', 1100],
      ['T1', 'write', 1100],
      ['T2', 'write', 1100],
    ],
    esperado: 1200,
    obtenido: 1100,
    seccion_critica: ['read', 'compute', 'write'],
    solucion: 'mutex',
  },

  lost_wakeup_timeline: {
    tipo: 'lost_wakeup_timeline',
    buffer: { capacidad: 1, estado_inicial: 'vacio' },
    eventos: [
      { t: 1, actor: 'Consumidor', accion: 'chequea vacío' },
      { t: 2, actor: 'Productor', accion: 'inserta item' },
      { t: 3, actor: 'Productor', accion: 'signal' },
      { t: 4, actor: 'Consumidor', accion: 'sleep' },
    ],
    fallo: 'señal_perdida',
    correccion: 'mutex + condición evaluada en bucle o semáforos contador',
  },

  priority_inversion: {
    tipo: 'priority_inversion',
    hilos: [
      { id: 'L', prioridad: 'baja' },
      { id: 'M', prioridad: 'media' },
      { id: 'H', prioridad: 'alta' },
    ],
    recurso: 'mutex_R',
    eventos: [
      ['t0', 'L toma R'],
      ['t1', 'H solicita R y bloquea'],
      ['t2', 'M ejecuta y desplaza a L'],
      ['t3', 'H sigue bloqueado'],
    ],
    solucion: { tecnica: 'priority_inheritance', efecto: 'L hereda prioridad alta hasta liberar R' },
  },

  readers_writers: {
    tipo: 'readers_writers',
    politica: 'prioridad_lectores',
    eventos: [
      ['t0', 'R1 entra'],
      ['t1', 'W1 espera'],
      ['t2', 'R2 entra'],
      ['t3', 'R3 entra'],
      ['t4', 'W1 sigue esperando'],
    ],
    problema: 'starvation_escritor',
    correccion: 'bloquear nuevos lectores si hay escritores esperando',
  },

  thrashing_curve: {
    tipo: 'thrashing_curve',
    eje_x: 'grado_multiprogramacion',
    eje_y: 'utilizacion_cpu',
    puntos: [
      { procesos: 2, cpu: 35, page_faults: 'bajo' },
      { procesos: 4, cpu: 70, page_faults: 'moderado' },
      { procesos: 6, cpu: 88, page_faults: 'alto_controlado' },
      { procesos: 8, cpu: 40, page_faults: 'muy_alto' },
      { procesos: 10, cpu: 15, page_faults: 'critico' },
    ],
    zona_thrashing_desde: 8,
    accion_correctiva: ['swap_out', 'reducir_multiprogramacion', 'controlar_working_set'],
  },

  page_fault_sequence: {
    tipo: 'page_fault_sequence',
    referencia: { vpn: 12, presente: false, valida: true, permiso: 'R' },
    pasos: ['MMU detecta presente=0', 'trap al SO', 'validar página', 'seleccionar frame', 'leer página de swap/archivo', 'actualizar tabla', 'reiniciar instrucción'],
    resultado: 'continua_ejecucion',
    contraste: 'segmentation_fault_si_valida=false_o_permiso_incorrecto',
  },

  page_replacement_table: {
    tipo: 'page_replacement_table',
    algoritmo: 'FIFO',
    referencias: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
    simulaciones: [
      { marcos: 3, fallos: 9 },
      { marcos: 4, fallos: 10 },
    ],
    concepto: 'Belady_anomaly',
    comparar_con: ['LRU', 'Optimo', 'Clock'],
  },

  page_table_permissions: {
    tipo: 'page_table_permissions',
    entrada: { vpn: 12, presente: true, valida: true, frame: 45, permisos: 'R-X', cow: false },
    operacion: 'write',
    resultado: 'protection_fault',
    accion_so: ['signal', 'terminar_proceso'],
    contraste: 'COW_si_cow=true',
  },

  open_file_tables: {
    tipo: 'open_file_tables',
    proceso: 'servidor',
    limite_fd: 1024,
    fd_abiertos: 1024,
    fallo: 'open retorna EMFILE',
    causa: 'fuga_de_descriptores',
    recursos_afectados: ['tabla_fd_proceso', 'tabla_global_archivos'],
    correccion: ['close en finally/defer', 'monitorear fd', 'reuse de conexiones'],
  },

  process_tree_zombies: {
    tipo: 'process_tree_zombies',
    padre: { pid: 100, nombre: 'servidor', estado: 'running' },
    hijos: [
      { pid: 101, estado: 'zombie', exit_code: 0 },
      { pid: 102, estado: 'zombie', exit_code: 0 },
    ],
    tabla_procesos: { entradas_zombie: 2, dato_conservado: 'pid_ppid_exit_code_estado' },
    accion_correctiva: 'waitpid(-1, ...) en el padre o handler SIGCHLD',
  },

  process_reparenting: {
    tipo: 'process_reparenting',
    antes: {
      relaciones: [
        { padre: 1, hijo: 200 },
        { padre: 200, hijo: 201 },
      ],
      estados: { '200': 'running', '201': 'running' },
    },
    evento: 'termina PID 200',
    despues: { relaciones: [{ padre: 1, hijo: 201 }], estados: { '201': 'running' } },
    conceptos: ['PPID', 'orphan_process', 'reparenting'],
  },

  // ---- esquemas legacy (6) ----
  process_states: {
    tipo: 'process_states',
    states: [
      { id: 'new', label: 'Nuevo' },
      { id: 'ready', label: 'Listo' },
      { id: 'running', label: 'Corriendo' },
      { id: 'blocked', label: 'Bloqueado' },
      { id: 'terminated', label: 'Terminado' },
    ],
    transitions: [
      { from: 'new', to: 'ready', label: 'admitido' },
      { from: 'ready', to: 'running', label: 'dispatch' },
      { from: 'running', to: 'ready', label: 'interrupción' },
      { from: 'running', to: 'blocked', label: 'espera I/O' },
      { from: 'blocked', to: 'ready', label: 'I/O listo' },
      { from: 'running', to: 'terminated', label: 'exit' },
    ],
    highlight: ['blocked'],
  },
  cpu_timeline: {
    tipo: 'cpu_timeline',
    segments: [
      { process: 'P1', start: 0, end: 4 },
      { process: 'P2', start: 4, end: 7 },
      { process: 'P1', start: 7, end: 9 },
      { process: 'P3', start: 9, end: 13 },
    ],
  },
  resource_graph: {
    tipo: 'resource_graph',
    nodes: [
      { id: 'P1', type: 'process', label: 'Proceso P1' },
      { id: 'P2', type: 'process', label: 'Proceso P2' },
      { id: 'impresora', type: 'resource', label: 'Impresora', instances: 1 },
      { id: 'escaner', type: 'resource', label: 'Escáner', instances: 1 },
    ],
    edges: [
      { from: 'impresora', to: 'P1', kind: 'assignment' },
      { from: 'P1', to: 'escaner', kind: 'request' },
      { from: 'escaner', to: 'P2', kind: 'assignment' },
      { from: 'P2', to: 'impresora', kind: 'request' },
    ],
  },
  memory_map: {
    tipo: 'memory_map',
    totalSize: 64,
    unit: 'KB',
    regions: [
      { label: 'SO', start: 0, size: 8, kind: 'system' },
      { label: 'P1', start: 8, size: 16, kind: 'process' },
      { label: 'libre', start: 24, size: 24, kind: 'free' },
      { label: 'P2', start: 48, size: 16, kind: 'process' },
    ],
  },
  fs_sequence: {
    tipo: 'fs_sequence',
    actors: ['Proceso', 'Cache', 'Disco'],
    steps: [
      { from: 'Proceso', to: 'Cache', label: 'write()' },
      { from: 'Cache', to: 'Disco', label: 'flush (asíncrono)' },
      { from: 'Disco', to: 'Cache', label: 'ack' },
      { from: 'Cache', to: 'Proceso', label: 'return' },
    ],
  },
  priority_queue_timeline: {
    tipo: 'priority_queue_timeline',
    politica: 'prioridad_preemptiva_sin_aging',
    procesos: [
      { id: 'P1', prioridad_inicial: 1, tipo: 'mantenimiento' },
      { id: 'P2', prioridad_inicial: 9, tipo: 'critico' },
      { id: 'P3', prioridad_inicial: 8, tipo: 'critico' },
    ],
    eventos: [
      { t: 0, evento: 'P1 listo' },
      { t: 1, evento: 'P2 listo y ejecuta' },
      { t: 3, evento: 'P3 listo y desplaza a P1' },
      { t: 5, evento: 'llega nueva tarea crítica' },
    ],
    problema: 'P1 permanece ready pero no obtiene CPU',
    correccion: { tecnica: 'aging', regla: 'sumar +1 prioridad cada 5 unidades de espera' },
  },
};
