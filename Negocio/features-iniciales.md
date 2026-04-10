# Features Iniciales de CareMosaic

## Objetivo

Definir las 4 features iniciales del MVP de CareMosaic para comenzar con una base clara de producto.

## Propuesta

### 1. Perfil inicial del paciente

#### Problema que resuelve

Sin contexto del usuario, la experiencia se siente generica y no se puede personalizar.

#### Que debe permitir

- registrar datos base del perfil
- capturar una fotografia inicial del bienestar del usuario
- identificar si toma medicamentos
- identificar si ya tiene diagnostico
- identificar si tiene una cita de control proxima
- identificar si necesita seguimiento por laboratorios o consulta

#### MVP

- nombre del perfil
- edad
- genero
- preguntas breves sobre calidad de sueno
- preguntas breves sobre ejercicio
- preguntas breves sobre alimentacion
- diagnostico actual opcional
- medicamentos actuales opcionales
- cita de control proxima opcional
- laboratorio pendiente opcional

#### Por que es clave

Esta feature activa la personalizacion del resto del producto y da contexto clinico inicial.

### 2. Seguimiento de tratamiento y medicamentos

#### Problema que resuelve

Los usuarios olvidan dosis, horarios o frecuencia de toma.

#### Que debe permitir

- crear medicamentos
- definir dosis, horario y frecuencia
- marcar una toma como completada, omitida o pendiente
- ver el plan del dia
- relacionar el seguimiento con el tratamiento actual

#### MVP

- nombre del medicamento
- dosis
- hora
- frecuencia
- estado de toma
- vista diaria
- seguimiento simple del tratamiento

#### Por que es clave

Es una feature de uso recurrente y de mucho valor practico. Tambien puede convertirse en uno de los principales motores de retencion.

### 3. Registro diario y preparacion para la consulta

#### Problema que resuelve

Los sintomas, habitos y eventos de salud se pierden o se registran de forma desordenada.

#### Que debe permitir

- registrar sintomas
- registrar estado de animo, sueno, energia o dolor
- guardar notas breves
- construir una historia diaria de salud
- preparar informacion util para una futura cita de control
- organizar observaciones previas a consulta

#### MVP

- registro rapido de sintomas
- escalas simples de dolor, energia o animo
- nota libre
- fecha y hora del registro
- relacion opcional con una cita proxima
- resumen acumulado antes de consulta

#### Por que es clave

Convierte a CareMosaic en una herramienta viva y no solo en una app de recordatorios.

### 4. Coordinacion clinica e insights

#### Problema que resuelve

Los usuarios tienen datos, pero no siempre entienden patrones o riesgos.

#### Que debe permitir

- mostrar tendencias basicas
- detectar olvidos repetidos de medicamentos
- resaltar patrones entre sintomas y habitos
- resumir informacion clave antes de una cita de control
- generar alertas o recomendaciones simples
- ayudar a identificar si hay tendencia a un posible diagnostico
- sugerir si podria requerirse remision a un especialista
- organizar laboratorios y consultas

#### MVP

- resumen semanal
- porcentaje de adherencia
- alertas por dosis olvidadas
- patrones simples como "empeora en la noche" o "olvidas la dosis de la tarde"
- resumen breve para mostrar al doctor
- gestion simple de consultas y laboratorios

#### Por que es clave

Es donde el producto empieza a diferenciarse, porque transforma registros en valor real para el usuario.

## Orden recomendado de prioridad

1. Onboarding inteligente
2. Recordatorio de medicamentos
3. Registro de salud diario
4. Insights y alertas

## Razon de este orden

Primero necesitamos contexto del usuario. Luego una accion de alto valor y alta recurrencia. Despues el registro diario que alimenta el sistema. Finalmente los insights, que dependen de tener datos suficientes.

## Que no meteria en la fase 1

- integraciones complejas con wearables
- chat medico en tiempo real
- marketplace o farmacia integrada
- IA clinica avanzada
- perfiles multiinstitucion

## Conclusion

Estas 4 features forman el nucleo inicial de CareMosaic:

- conocer el contexto del paciente
- ayudarle a seguir su tratamiento
- capturar su dia a dia antes de la consulta
- convertir esos datos en apoyo para el doctor y para el seguimiento clinico
