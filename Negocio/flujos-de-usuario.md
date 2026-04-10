# Flujos de Usuario

## Objetivo del documento

Definir de forma clara los flujos principales del MVP de `CareMosaic` para alinear negocio, UX, frontend y futuras decisiones tecnicas.

Este documento describe:

- quien ejecuta el flujo
- que dispara la accion
- cual es el objetivo del usuario
- que pasos sigue
- que decisiones aparecen
- que datos se capturan
- cual es el resultado esperado

## Actores principales

### Usuario paciente

Persona que quiere entender mejor su bienestar, registrar su estado de salud, organizar medicamentos si los toma, y llegar mejor preparada a una cita de control.

### Doctor

Profesional que recibe informacion del paciente de forma mas ordenada para comprender mejor su estado, seguimiento y evolucion.

## Flujos principales del MVP

1. Onboarding inicial
2. Activacion de recordatorio de medicamentos
3. Seguimiento diario de medicamentos
4. Registro diario de salud y sintomas
5. Agendamiento de consultas y laboratorios
6. Carga de resultados y documentos
7. Preparacion para cita de control
8. Consulta de insights y alertas

---

## 1. Flujo de onboarding inicial

### Objetivo

Permitir que el usuario configure CareMosaic por primera vez y personalice la experiencia segun su contexto.

### Actor principal

Usuario paciente.

### Disparador

El usuario abre la app por primera vez o no ha completado su configuracion inicial.

### Precondiciones

- la app esta instalada o abierta
- el usuario aun no tiene perfil configurado

### Resultado esperado

La app crea un perfil base y deja listo el contexto para mostrar contenido relevante.

### Datos que se deben capturar

- nombre
- edad
- genero
- calidad de sueno
- nivel de ejercicio
- percepcion breve de alimentacion
- si toma medicamentos actualmente
- si tiene un diagnostico actual
- si tiene una cita de control proxima
- si tiene laboratorios pendientes

### Paso a paso

1. El usuario aterriza en la pantalla de bienvenida.
2. La app explica brevemente que CareMosaic ayuda a organizar piezas de salud en un solo lugar.
3. El usuario ingresa nombre, edad y genero.
4. La app hace preguntas cortas sobre bienestar.
5. El usuario responde sobre calidad de sueno, ejercicio y alimentacion.
6. La app pregunta si actualmente toma medicamentos.
7. Si responde que si, la app activa la ruta de recordatorios.
8. La app pregunta si tiene un diagnostico actual.
9. La app pregunta si tiene una cita de control proxima.
10. Si responde que si, la app guarda fecha estimada o fecha exacta.
11. La app pregunta si tiene laboratorios o examenes pendientes.
12. El usuario revisa un resumen corto de su configuracion.
13. La app confirma que el perfil fue creado.
14. El usuario entra al flujo principal de la aplicacion.

### Decisiones clave

- si el usuario toma medicamentos, la app prioriza la feature de recordatorios
- si no toma medicamentos, la app prioriza bienestar y registro diario
- si ya tiene diagnostico, la app puede contextualizar mejor sintomas y seguimiento
- si tiene una cita proxima, la app debe incentivar registro diario para llegar con informacion organizada
- si tiene laboratorios pendientes, la app puede habilitar flujo de agenda y carga de resultados

### Errores o bloqueos posibles

- el usuario abandona por exceso de preguntas
- no sabe aun su lista exacta de medicamentos
- no recuerda fecha exacta de proxima cita

### Recomendaciones UX

- mantener el flujo corto
- permitir "omitir por ahora" en campos no criticos
- usar seleccion guiada en lugar de formularios largos

---

## 2. Flujo de activacion de recordatorio de medicamentos

### Objetivo

Permitir que el usuario cree un recordatorio claro para no olvidar una toma.

### Actor principal

Usuario paciente.

### Disparador

El usuario indica en onboarding o dentro de la app que toma medicamentos y quiere organizar sus tomas.

### Precondiciones

- el usuario ya completo onboarding o ya tiene perfil
- el usuario esta dentro de la app

### Resultado esperado

El medicamento queda guardado con una rutina activa de recordatorios.

### Datos que se deben capturar

- nombre del medicamento
- dosis
- tipo de unidad: tableta, capsula, ml, gotas
- horario
- frecuencia
- duracion del tratamiento
- instrucciones especiales

### Paso a paso

1. El usuario entra a la feature de medicamentos.
2. Selecciona la accion "agregar medicamento".
3. La app pide el nombre del medicamento.
4. El usuario ingresa dosis y unidad.
5. La app pide hora o varias horas del dia.
6. El usuario define la frecuencia.
7. La app pregunta si el tratamiento tiene fecha de fin.
8. El usuario agrega instrucciones si aplica.
9. La app muestra una vista previa del recordatorio.
10. El usuario confirma y guarda.

### Decisiones clave

- si la frecuencia es diaria, la app genera rutina estable
- si la frecuencia es solo algunos dias, la app pide dias concretos
- si hay varias tomas en un dia, la app crea multiples eventos

### Errores o bloqueos posibles

- horarios ambiguos
- usuario no conoce dosis exacta
- usuario intenta crear medicamento sin nombre claro

### Recomendaciones UX

- autocompletar o sugerencias de medicamentos cuando sea posible
- usar selectores simples de hora
- mostrar resumen antes de guardar

---

## 3. Flujo de seguimiento diario de medicamentos

### Objetivo

Permitir que el usuario vea su plan del dia y marque si tomo o no cada medicamento.

### Actor principal

Usuario paciente.

### Disparador

Llega la hora de una toma o el usuario revisa su agenda del dia.

### Precondiciones

- existe al menos un medicamento configurado

### Resultado esperado

La app registra adherencia y actualiza el estado del dia.

### Datos que se deben capturar

- estado de la toma: pendiente, tomada, omitida
- hora real de confirmacion
- observaciones opcionales

### Paso a paso

1. El usuario entra a la vista diaria de medicamentos.
2. La app muestra lista de tomas pendientes, completadas y omitidas.
3. El usuario toca una toma programada.
4. La app ofrece acciones simples: tomada, omitida, posponer.
5. El usuario confirma el estado.
6. La app actualiza el historial y el progreso del dia.
7. Si la toma fue omitida, puede pedir una razon opcional.
8. La app refleja la adherencia acumulada.

### Decisiones clave

- si una toma esta vencida y no fue marcada, se mantiene visible como pendiente critica
- si el usuario pospone, la app reajusta el recordatorio
- si el usuario omite con frecuencia, eso alimenta insights futuros

### Errores o bloqueos posibles

- confusion entre "omitida" y "pendiente"
- muchas acciones para una tarea que deberia ser rapida

### Recomendaciones UX

- accion principal en un solo toque
- estados muy visuales
- historial visible pero no invasivo

---

## 4. Flujo de registro diario de salud y sintomas

### Objetivo

Permitir que el usuario registre como se siente y que sintomas o eventos tuvo durante el dia.

### Actor principal

Usuario paciente.

### Disparador

El usuario quiere registrar un cambio en su estado o completar su resumen diario.

### Precondiciones

- el usuario tiene perfil activo

### Resultado esperado

La app guarda una entrada diaria que luego puede alimentar el historial, la preparacion para cita y los insights.

### Datos que se deben capturar

- sintomas
- intensidad
- energia
- estado de animo
- calidad del sueno
- dolor
- nota libre
- fecha y hora
- contexto opcional de proximidad a cita

### Paso a paso

1. El usuario entra a la feature de registro diario.
2. La app pregunta como se siente hoy.
3. El usuario selecciona sintomas o estados relevantes.
4. La app pide intensidad o nivel en escalas simples.
5. El usuario escribe una nota si quiere.
6. La app muestra un resumen breve antes de guardar.
7. El usuario confirma el registro.
8. La app agrega la entrada al historial diario.
9. Si existe una cita proxima, la app asocia el registro a ese periodo de seguimiento.

### Decisiones clave

- si el usuario quiere rapidez, debe poder guardar en menos de un minuto
- si quiere mas detalle, puede expandir campos opcionales
- si registra algo critico, eso puede elevar prioridad en insights
- si el usuario tiene una cita cercana, la app puede reforzar el valor de seguir registrando sintomas

### Errores o bloqueos posibles

- demasiados campos
- escalas confusas
- vocabulario poco claro para sintomas

### Recomendaciones UX

- usar chips, sliders o escalas cortas
- permitir notas opcionales
- mostrar historial de forma cronologica

---

## 5. Flujo de preparacion para cita de control

## 5. Flujo de agendamiento de consultas y laboratorios

### Objetivo

Permitir que el paciente organice sus proximas consultas y laboratorios dentro del seguimiento de su proceso de salud.

### Actor principal

Usuario paciente.

### Disparador

El usuario necesita registrar una consulta de control o un laboratorio pendiente.

### Precondiciones

- el usuario tiene perfil activo

### Resultado esperado

La cita o el laboratorio quedan registrados para dar seguimiento y alimentar recordatorios o preparacion previa.

### Datos que se deben capturar

- tipo de evento: consulta o laboratorio
- fecha
- hora
- profesional o especialidad si aplica
- motivo
- observaciones

### Paso a paso

1. El usuario entra a la seccion de agenda clinica.
2. Selecciona si quiere registrar una consulta o un laboratorio.
3. La app solicita fecha y hora.
4. El usuario registra profesional, especialidad o centro si lo conoce.
5. La app permite agregar motivo o nota.
6. El usuario confirma el evento.
7. La app agrega el evento al seguimiento clinico.

### Decisiones clave

- si es consulta de control, la app debe conectar el evento con registros diarios previos
- si es laboratorio, la app debe permitir luego adjuntar resultados
- si el evento esta cercano, la app debe reforzar registro de sintomas y preparacion

### Errores o bloqueos posibles

- el usuario no tiene fecha exacta
- no sabe el nombre del especialista
- confunde laboratorio con consulta

### Recomendaciones UX

- permitir guardar con informacion minima
- diferenciar claramente consulta y laboratorio
- mostrar la agenda de forma simple

---

## 6. Flujo de carga de resultados y documentos

### Objetivo

Permitir que el paciente guarde resultados relevantes para que esten disponibles antes de la consulta.

### Actor principal

Usuario paciente.

### Disparador

El usuario ya tiene un resultado de laboratorio, examen o documento y quiere cargarlo.

### Precondiciones

- existe un perfil activo

### Resultado esperado

La informacion queda organizada dentro del historial del paciente y disponible para el seguimiento previo a consulta.

### Datos que se deben capturar

- tipo de documento o resultado
- fecha
- nombre del examen o archivo
- nota opcional
- archivo o imagen adjunta

### Paso a paso

1. El usuario entra a resultados o documentos.
2. Selecciona cargar resultado.
3. La app pide tipo de documento.
4. El usuario adjunta archivo, imagen o dato.
5. La app permite agregar una nota corta.
6. El usuario guarda el resultado.
7. La app lo vincula al historial o a un laboratorio previamente agendado.

### Decisiones clave

- si el resultado pertenece a un laboratorio agendado, debe quedar relacionado
- si es un documento suelto, debe guardarse igualmente en historial
- si hay una cita proxima, la app debe incluir ese documento en la preparacion

### Errores o bloqueos posibles

- archivo pesado o formato no soportado
- usuario no sabe como nombrar el resultado
- no hay conexion entre el archivo y el seguimiento

### Recomendaciones UX

- permitir foto, PDF o imagen cuando sea posible
- usar lenguaje simple
- mostrar confirmacion clara de carga

---

## 7. Flujo de preparacion para cita de control

### Objetivo

Permitir que el usuario llegue a su cita con un resumen claro de como se ha sentido, que sintomas ha tenido y que seguimiento ha realizado.

### Actor principal

Usuario paciente.

### Disparador

El usuario tiene una cita de control proxima o quiere revisar su evolucion antes de esa cita.

### Precondiciones

- el usuario tiene una cita cargada o definida
- existen registros diarios o datos acumulados

### Resultado esperado

El usuario obtiene un resumen claro que pueda revisar y eventualmente compartir durante la consulta.

### Datos que se usan

- diagnostico actual si existe
- fecha de cita
- sintomas registrados
- notas del dia a dia
- adherencia a medicamentos si aplica
- cambios en bienestar

### Paso a paso

1. El usuario entra a la seccion de seguimiento para cita.
2. La app muestra cuantos dias faltan para la cita.
3. El usuario revisa resumen de sintomas recientes.
4. La app destaca eventos repetidos o cambios relevantes.
5. El usuario revisa si ha seguido o no sus medicamentos, si aplica.
6. La app construye un resumen legible de lo ocurrido antes de la cita.
7. El usuario usa esa informacion como apoyo durante el control medico.

### Decisiones clave

- si no hay suficientes registros, la app debe invitar a registrar mas antes de la cita
- si no hay medicamentos configurados, el resumen debe enfocarse solo en bienestar y sintomas
- si el usuario tiene diagnostico, el resumen puede agruparse alrededor de esa condicion

### Errores o bloqueos posibles

- no hay suficientes datos para mostrar valor
- la informacion se presenta de forma demasiado tecnica
- el resumen es demasiado largo para ser util en consulta

### Recomendaciones UX

- resumen corto y claro
- lenguaje simple
- foco en sintomas, cambios y adherencia

---

## 8. Flujo de consulta de insights y alertas

### Objetivo

Permitir que el usuario entienda patrones, adherencia y alertas relevantes a partir de sus datos.

### Actor principal

Usuario paciente.

### Disparador

El usuario abre la seccion de insights o la app detecta una alerta relevante.

### Precondiciones

- el usuario ya tiene datos de medicamentos o registros diarios

### Resultado esperado

El usuario entiende un patron concreto y recibe una recomendacion accionable.

### Datos que se usan

- historial de adherencia
- sintomas registrados
- frecuencia de olvidos
- horarios recurrentes
- notas o tendencias semanales
- informacion de bienestar
- contexto de cita proxima si existe
- laboratorios y resultados si existen

### Paso a paso

1. El usuario entra a la seccion de insights.
2. La app muestra un resumen semanal o del periodo reciente.
3. El usuario ve metricas principales como adherencia o sintomas frecuentes.
4. La app destaca patrones detectados.
5. El usuario entra al detalle de un insight.
6. La app explica el patron en lenguaje simple.
7. Si aplica, la app muestra una recomendacion o alerta.

### Decisiones clave

- si no hay suficientes datos, la app debe decirlo claramente
- si hay una alerta importante, debe destacarse sobre insights secundarios
- si el patron es repetitivo, puede recomendar cambio de rutina o consulta
- si existe una cita cercana, el insight debe poder conectar con esa preparacion
- si los datos apuntan a algo relevante, el sistema puede sugerir remision o revision por especialista, sin reemplazar criterio medico

### Errores o bloqueos posibles

- mostrar demasiados datos sin interpretacion
- lenguaje que parezca diagnostico medico
- alertas poco accionables

### Recomendaciones UX

- lenguaje claro y no clinico
- foco en una conclusion por insight
- separar alerta, tendencia y recomendacion

---

## Dependencias entre flujos

- `Onboarding` habilita personalizacion
- `Activacion de medicamentos` habilita seguimiento diario
- `Seguimiento diario` alimenta adherencia
- `Registro diario de salud` alimenta contexto clinico cotidiano
- `Agendamiento de consultas y laboratorios` organiza el seguimiento clinico
- `Carga de resultados` agrega contexto objetivo al historial
- `Preparacion para cita` depende de registros, diagnostico y adherencia si aplica
- `Insights y alertas` depende de los datos generados por los flujos anteriores

## Prioridad recomendada

1. Onboarding inicial
2. Activacion de recordatorio de medicamento
3. Seguimiento diario de medicamentos
4. Registro diario de salud
5. Agendamiento de consultas y laboratorios
6. Carga de resultados y documentos
7. Preparacion para cita de control
8. Consulta de insights y alertas

## Siguiente nivel de documentacion sugerido

Despues de este documento, conviene crear uno por cada flujo con:

- pantallas involucradas
- componentes por pantalla
- validaciones
- estados vacios
- estados de error
- eventos de sistema
