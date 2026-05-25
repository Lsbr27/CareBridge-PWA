-- doctors table: rich profiles for the specialists directory
-- Replaces the static specialists.ts data file

create table public.doctors (
  id                        uuid         primary key default gen_random_uuid(),
  slug                      text         unique not null,
  title                     text         not null,
  name                      text         not null,
  specialty                 text         not null,
  category                  text         not null,
  tagline                   text         not null default '',
  bio_short                 text         not null default '',
  bio_long                  text         not null default '',
  education                 jsonb        not null default '[]',
  certifications            text[]       not null default '{}',
  interests                 text[]       not null default '{}',
  languages                 text[]       not null default '{"Español"}',
  consultation_price        integer      not null default 90000,
  consultation_duration_min integer      not null default 45,
  photo_url                 text         not null default '',
  verified                  boolean      not null default true,
  rating                    numeric(2,1) not null default 4.8,
  review_count              integer      not null default 0,
  years_experience          integer      not null default 5,
  location                  text         not null default 'Bogotá, Colombia',
  consultation_types        text[]       not null default '{"virtual"}',
  conditions_treated        text[]       not null default '{}',
  weekly_schedule           jsonb        not null default '{}',
  created_at                timestamptz  not null default now(),
  updated_at                timestamptz  not null default now()
);

alter table public.doctors enable row level security;

create policy "doctors_select_authenticated"
  on public.doctors for select
  to authenticated
  using (true);

create trigger set_doctors_updated_at
  before update on public.doctors
  for each row execute function public.set_updated_at();

-- ── Seed: 12 doctors (4 migrated + 8 new) ──────────────────────────────────

insert into public.doctors (
  slug, title, name, specialty, category, tagline, bio_short, bio_long,
  education, certifications, interests, languages,
  consultation_price, consultation_duration_min, photo_url,
  verified, rating, review_count, years_experience, location,
  consultation_types, conditions_treated, weekly_schedule
) values

-- 1. Sofía Ramírez Torres — Endocrinología
(
  'sofia-ramirez-torres', 'Dra.', 'Sofía Ramírez Torres',
  'Endocrinología', 'Metabolismo y hormonas',
  'Recupera tu metabolismo con alimentos reales',
  'Combino evidencia clínica con nutrición funcional para tratar el origen metabólico de tus síntomas, no solo los números en tus análisis.',
  'Llevo más de una década acompañando a personas con diabetes, resistencia a la insulina y problemas de tiroides a entender su metabolismo desde adentro. Mi consulta no termina con la receta: quiero que sepas por qué tu cuerpo responde como lo hace y qué puedes hacer más allá de los medicamentos para que los cambios sean sostenibles. Trabajo en la intersección entre la endocrinología clínica y la nutrición funcional, y creo que comer bien no debería ser una penitencia sino una herramienta poderosa.',
  '[
    {"degree": "Médico Cirujano", "institution": "Universidad Nacional de Colombia", "year": 2010},
    {"degree": "Especialista en Endocrinología", "institution": "Universidad de Antioquia", "year": 2015},
    {"degree": "Fellowship en Metabolismo y Diabetes", "institution": "Hospital Universitario San Ignacio", "year": 2017}
  ]'::jsonb,
  ARRAY['Junta de Endocrinología y Diabetes de Colombia', 'Certificación en Nutrición Funcional (IFMCP)'],
  ARRAY['Resistencia a la insulina', 'Tiroides funcional', 'Metabolismo y peso', 'Alimentación real', 'Síndrome metabólico'],
  ARRAY['Español', 'Inglés'],
  120000, 45, '/specialists/sofia-ramirez.jpg',
  true, 4.9, 87, 11, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY['diabetes', 'high_cholesterol'],
  '{"tuesday": ["09:00", "11:30"], "thursday": ["10:00", "14:00"], "saturday": ["08:30", "12:00"]}'::jsonb
),

-- 2. Valentina Herrera Muñoz — Ginecología
(
  'valentina-herrera-munoz', 'Dra.', 'Valentina Herrera Muñoz',
  'Ginecología', 'Salud de la mujer',
  'Tu salud hormonal, escuchada y comprendida',
  'Especializada en endometriosis y disrupción hormonal, ofrezco un enfoque integrador que valida tu experiencia y busca bienestar real, no solo ausencia de enfermedad.',
  'La salud hormonal femenina es mucho más que ciclos regulares y ausencia de dolor. Me especialicé en endometriosis porque viví de cerca lo que significa que una enfermedad invisible te robe calidad de vida durante años. Hoy acompaño a pacientes con SOP, dolor pélvico crónico y problemas de fertilidad con un enfoque que combina la mejor evidencia clínica con el respeto profundo por tu experiencia subjetiva. Tu historia clínica empieza por escucharte.',
  '[
    {"degree": "Médico Cirujano", "institution": "Pontificia Universidad Javeriana", "year": 2011},
    {"degree": "Especialista en Ginecología y Obstetricia", "institution": "Universidad Nacional de Colombia", "year": 2016},
    {"degree": "Fellowship en Endometriosis y Cirugía Mínimamente Invasiva", "institution": "Clínica Universitaria de Navarra", "year": 2018}
  ]'::jsonb,
  ARRAY['Federación Colombiana de Obstetricia y Ginecología (FECOLSOG)', 'Certificada en Ecografía Ginecológica Avanzada'],
  ARRAY['Endometriosis', 'SOP', 'Salud hormonal', 'Dolor pélvico crónico', 'Fertilidad natural'],
  ARRAY['Español'],
  110000, 45, '/specialists/valentina-herrera.jpg',
  true, 4.8, 124, 10, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY[]::text[],
  '{"monday": ["10:00", "14:00"], "wednesday": ["09:00", "11:00"], "friday": ["13:00"]}'::jsonb
),

-- 3. Mateo Villanueva Ortega — Dermatología
(
  'mateo-villanueva-ortega', 'Dr.', 'Mateo Villanueva Ortega',
  'Dermatología', 'Piel',
  'La piel refleja lo que ocurre por dentro',
  'Trabajo la conexión intestino-piel para tratar dermatitis y condiciones crónicas desde su raíz inflamatoria, con opciones terapéuticas que van más allá de los corticoides.',
  'La piel no es solo lo que ves: es el mapa de lo que pasa en tu intestino, tu sistema inmune y tu nivel de estrés. En mi consulta no solo trato el sarpullido, sino que buscamos juntos la causa raíz del problema cutáneo. He formado mi práctica en dermatología integrativa porque los pacientes con rosácea, psoriasis o dermatitis atópica merecen más que cremas y corticoides de por vida. Hay otras opciones, y quiero mostrártelas.',
  '[
    {"degree": "Médico Cirujano", "institution": "Universidad de los Andes", "year": 2012},
    {"degree": "Especialista en Dermatología", "institution": "Universidad del Rosario", "year": 2017},
    {"degree": "Pasantía en Dermatología Integrativa", "institution": "UNAM, Ciudad de México", "year": 2018}
  ]'::jsonb,
  ARRAY['Asociación Colombiana de Dermatología (AsoColDerma)', 'Dermoscopia Clínica Avanzada (IDS)'],
  ARRAY['Dermatitis atópica', 'Eje intestino-piel', 'Rosácea', 'Psoriasis', 'Dermatología integrativa'],
  ARRAY['Español', 'Inglés'],
  100000, 40, '/specialists/mateo-villanueva.jpg',
  true, 4.7, 95, 9, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY[]::text[],
  '{"monday": ["08:00", "13:00"], "thursday": ["09:00", "11:00"], "saturday": ["10:30", "14:00"]}'::jsonb
),

-- 4. Andrés Fuentes Castillo — Nutrición
(
  'andres-fuentes-castillo', 'Lic.', 'Andrés Fuentes Castillo',
  'Nutrición', 'Metabolismo y hormonas',
  'Recupera tu energía con alimentos que nutren de verdad',
  'Diseño planes alimenticios individualizados centrados en alimentos integrales para combatir la fatiga crónica, equilibrar el azúcar en sangre y restaurar la vitalidad desde adentro.',
  'La nutrición es mi herramienta, pero el objetivo es tu energía y tu bienestar a largo plazo. Trabajo con personas que tienen diagnósticos como diabetes tipo 2, colesterol alto o fatiga crónica y quieren resultados reales sin dietas imposibles de sostener. Mi enfoque está basado en evidencia ortomolecular y nutrición funcional: entendemos primero qué le falta a tu cuerpo y luego construimos un plan que encaje en tu vida real.',
  '[
    {"degree": "Nutricionista Dietista", "institution": "Universidad Nacional de Colombia", "year": 2014},
    {"degree": "Maestría en Nutrición Ortomolecular", "institution": "Instituto Europeo de Nutrición y Salud", "year": 2019}
  ]'::jsonb,
  ARRAY['Colegio Colombiano de Nutricionistas Dietistas (Colnud)', 'Certificado en Nutrición Deportiva Funcional (ISSN)'],
  ARRAY['Fatiga crónica', 'Nutrición ortomolecular', 'Alimentación anti-inflamatoria', 'Salud mitocondrial', 'Nutrición deportiva funcional'],
  ARRAY['Español'],
  85000, 50, '/specialists/andres-fuentes.jpg',
  true, 4.9, 63, 8, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY['diabetes', 'high_cholesterol'],
  '{"tuesday": ["09:30", "14:30"], "wednesday": ["12:00"], "friday": ["08:00", "13:00", "15:00"]}'::jsonb
),

-- 5. Carlos Mendoza Restrepo — Cardiología (nuevo)
(
  'carlos-mendoza-restrepo', 'Dr.', 'Carlos Mendoza Restrepo',
  'Cardiología', 'Corazón y circulación',
  'Tu corazón habla, yo te ayudo a escucharlo',
  'Con 15 años en cardiología clínica y preventiva, mi enfoque va más allá del stent o el marcapasos: quiero que entiendas qué le está pasando a tu corazón y puedas tomar decisiones informadas sobre tu tratamiento.',
  'Me dediqué a la cardiología porque el corazón es el órgano que mejor refleja cómo vivimos: nuestro estrés, nuestra alimentación, nuestros hábitos. En mi consulta hacemos diagnóstico preciso con ecocardiografía y electrocardiografía, pero también hablamos de prevención real. He tratado desde arritmias complejas hasta insuficiencia cardíaca, y en todos los casos creo que el paciente informado toma mejores decisiones. Si tienes hipertensión, colesterol alto o antecedentes familiares, no esperes el infarto para venir.',
  '[
    {"degree": "Médico Cirujano", "institution": "Universidad de Antioquia", "year": 2009},
    {"degree": "Especialista en Cardiología Clínica", "institution": "Universidad Nacional de Colombia", "year": 2014},
    {"degree": "Fellowship en Cardiología Intervencionista", "institution": "Instituto Nacional de Cardiología, México", "year": 2016}
  ]'::jsonb,
  ARRAY['American College of Cardiology (ACC)', 'Junta Colombiana de Cardiología y Cirugía Cardiovascular', 'Ecocardiografía Avanzada (SIAC)'],
  ARRAY['Insuficiencia cardíaca', 'Hipertensión arterial', 'Arritmias', 'Prevención cardiovascular', 'Ecocardiografía doppler'],
  ARRAY['Español', 'Inglés'],
  150000, 45, '/specialists/carlos-mendoza.jpg',
  true, 4.9, 203, 15, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY['heart_disease', 'high_bp', 'high_cholesterol'],
  '{"monday": ["08:00", "10:30"], "wednesday": ["09:00", "13:00"], "friday": ["11:00"]}'::jsonb
),

-- 6. Laura Jiménez Vargas — Psicología Clínica (nueva)
(
  'laura-jimenez-vargas', 'Psic.', 'Laura Jiménez Vargas',
  'Psicología Clínica', 'Salud mental',
  'Sanar es posible, y no tienes que hacerlo solo',
  'Trabajo desde la terapia cognitivo-conductual y el EMDR para ayudarte a procesar experiencias difíciles y construir herramientas concretas para manejar la ansiedad, la depresión y el impacto del trauma.',
  'La salud mental no es un lujo ni un signo de debilidad: es la base de todo lo demás. Mi consulta es un espacio sin juicio donde puedes ser honesto sobre lo que estás viviendo. Uso TCC y EMDR porque son los enfoques con mayor evidencia para depresión, ansiedad y trauma, pero los adapto siempre a tu historia y a tu ritmo. He acompañado a más de 170 personas a recuperar su estabilidad emocional, y sé que el cambio es posible cuando hay el acompañamiento correcto.',
  '[
    {"degree": "Psicóloga", "institution": "Pontificia Universidad Javeriana", "year": 2013},
    {"degree": "Maestría en Psicología Clínica", "institution": "Universidad de Los Andes", "year": 2016},
    {"degree": "Especialización en TCC", "institution": "Instituto Beck Colombia", "year": 2018}
  ]'::jsonb,
  ARRAY['Colegio Colombiano de Psicólogos (Colpsic)', 'Certificada en EMDR nivel II (EMDRIA)', 'Formación en Mindfulness Basado en Evidencia (MBSR)'],
  ARRAY['Trastornos del estado de ánimo', 'Ansiedad y estrés', 'Trauma y EMDR', 'Terapia cognitivo-conductual', 'Mindfulness basado en evidencia'],
  ARRAY['Español'],
  90000, 50, '/specialists/laura-jimenez.jpg',
  true, 4.9, 178, 10, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY['depression'],
  '{"monday": ["10:00", "16:00"], "tuesday": ["14:00", "17:00"], "thursday": ["10:00", "15:00"], "saturday": ["09:00", "11:00"]}'::jsonb
),

-- 7. Felipe Torres Ruiz — Medicina General (nuevo)
(
  'felipe-torres-ruiz', 'Dr.', 'Felipe Torres Ruiz',
  'Medicina General', 'Medicina general',
  'Tu médico de confianza para el día a día',
  'Soy médico familiar con enfoque en medicina preventiva y manejo de enfermedades crónicas. Mi consulta es el puente entre tus síntomas cotidianos y los especialistas que puedas necesitar, con tiempo real para escucharte.',
  'La medicina general bien hecha es la piedra angular del sistema de salud. En mi práctica priorizo la escucha, el diagnóstico clínico cuidadoso y la educación al paciente sobre su propia salud. Soy el médico que te orienta cuando no sabes qué especialista necesitas, que te ayuda a manejar la hipertensión, la diabetes o el asma de forma integral, y que coordina tu atención cuando el caso lo requiere. Tengo tiempo para ti en la consulta, porque un diagnóstico apresurado es un diagnóstico incompleto.',
  '[
    {"degree": "Médico Cirujano", "institution": "Universidad del Valle", "year": 2015},
    {"degree": "Especialista en Medicina Familiar", "institution": "UNAM, Ciudad de México", "year": 2019}
  ]'::jsonb,
  ARRAY['Sociedad Colombiana de Medicina Familiar (Somefamco)', 'Certificado en Manejo Integral de Enfermedades Crónicas'],
  ARRAY['Medicina preventiva', 'Enfermedades crónicas', 'Salud familiar', 'Medicina basada en evidencia', 'Control de riesgo cardiovascular'],
  ARRAY['Español'],
  70000, 40, '/specialists/felipe-torres.jpg',
  true, 4.7, 312, 9, 'Cali, Colombia',
  ARRAY['virtual'],
  ARRAY['diabetes', 'high_bp', 'depression', 'asthma'],
  '{"monday": ["08:00", "10:00", "14:00"], "wednesday": ["08:00", "13:00"], "friday": ["09:00", "11:30", "15:00"]}'::jsonb
),

-- 8. Sebastián Castro Pardo — Neurología (nuevo)
(
  'sebastian-castro-pardo', 'Dr.', 'Sebastián Castro Pardo',
  'Neurología', 'Sistema nervioso',
  'La neurología que cuida tu calidad de vida, no solo tus síntomas',
  'Me especializo en el diagnóstico y tratamiento de enfermedades del sistema nervioso con un enfoque en calidad de vida. Desde migraña hasta epilepsia, creo en planes terapéuticos que se adaptan a tu vida real.',
  'El cerebro y el sistema nervioso son fascinantes precisamente porque condicionan todo lo que somos y todo lo que hacemos. En mi consulta veo desde cefaleas crónicas y migraña hasta epilepsia, esclerosis múltiple y trastornos del sueño. Mi filosofía es que el mejor tratamiento neurológico es el que el paciente puede sostener en el tiempo: por eso dedico tiempo a explicar el diagnóstico en detalle y a diseñar estrategias que funcionen dentro de tu estilo de vida.',
  '[
    {"degree": "Médico Cirujano", "institution": "Universidad de Antioquia", "year": 2010},
    {"degree": "Especialista en Neurología Clínica", "institution": "Universidad Nacional de Colombia", "year": 2015},
    {"degree": "Fellowship en Neurología del Sueño", "institution": "Universidad de Barcelona", "year": 2017}
  ]'::jsonb,
  ARRAY['Asociación Colombiana de Neurología (ACN)', 'Certificado en Neurología del Sueño (ESRS)', 'Neurosonología (AAN)'],
  ARRAY['Migraña y cefaleas', 'Epilepsia', 'Trastornos del sueño', 'Esclerosis múltiple', 'Neuropatías periféricas'],
  ARRAY['Español', 'Inglés'],
  140000, 45, '/specialists/sebastian-castro.jpg',
  true, 4.8, 141, 12, 'Medellín, Colombia',
  ARRAY['virtual'],
  ARRAY['depression'],
  '{"tuesday": ["09:00", "11:00"], "thursday": ["10:00", "14:00"], "friday": ["08:30"]}'::jsonb
),

-- 9. Ricardo Salcedo Mora — Traumatología y Ortopedia (nuevo)
(
  'ricardo-salcedo-mora', 'Dr.', 'Ricardo Salcedo Mora',
  'Traumatología y Ortopedia', 'Huesos y articulaciones',
  'Recupera tu movimiento, recupera tu vida',
  'Ortopedista especializado en cirugía artroscópica y lesiones deportivas. Mi objetivo es que vuelvas a hacer lo que amas con el diagnóstico correcto y el plan de rehabilitación adecuado.',
  'El movimiento es vida, y perderlo por una lesión o una articulación desgastada impacta mucho más que la movilidad física. Me especialicé en artroscopia y medicina deportiva porque quiero que las personas puedan volver a correr, escalar, bailar o simplemente caminar sin dolor. Siempre evalúo primero las opciones conservadoras antes de proponer cirugía, y cuando la cirugía es necesaria, me aseguro de que el proceso de rehabilitación esté bien acompañado desde el inicio.',
  '[
    {"degree": "Médico Cirujano", "institution": "Universidad del Rosario", "year": 2011},
    {"degree": "Especialista en Ortopedia y Traumatología", "institution": "Universidad de Antioquia", "year": 2016},
    {"degree": "Fellowship en Cirugía de Rodilla y Artroscopia", "institution": "Hospital Universitario La Paz, Madrid", "year": 2018}
  ]'::jsonb,
  ARRAY['Sociedad Colombiana de Ortopedia y Traumatología (SCCOT)', 'SICOT International Member', 'Artroscopia Avanzada (AAOS)'],
  ARRAY['Cirugía artroscópica de rodilla', 'Lesiones deportivas', 'Artroplastia de cadera y rodilla', 'Medicina deportiva', 'Artroscopia de hombro'],
  ARRAY['Español', 'Inglés'],
  130000, 45, '/specialists/ricardo-salcedo.jpg',
  true, 4.8, 156, 11, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY[]::text[],
  '{"monday": ["07:30", "10:00"], "wednesday": ["08:00", "11:30"], "friday": ["09:00", "14:00"]}'::jsonb
),

-- 10. Alejandra Montes Vega — Neumología (nueva)
(
  'alejandra-montes-vega', 'Dra.', 'Alejandra Montes Vega',
  'Neumología', 'Respiratorio',
  'Respira mejor, vive mejor',
  'Neumóloga con enfoque en enfermedades respiratorias crónicas y del sueño. Trabajo para que el asma, la EPOC o la apnea no sean un límite en tu vida diaria.',
  'Respirar bien es algo que damos por sentado hasta que dejamos de poder hacerlo. Trabajo con pacientes que tienen asma, EPOC, fibrosis pulmonar y apnea del sueño, y mi objetivo siempre es que la enfermedad interfiera lo menos posible con tu vida. Hago diagnóstico funcional respiratorio completo antes de cualquier tratamiento, y me aseguro de que entiendas exactamente qué está pasando en tus pulmones y por qué el tratamiento que te propongo es el correcto para tu caso.',
  '[
    {"degree": "Médico Cirujano", "institution": "Universidad de Caldas", "year": 2012},
    {"degree": "Especialista en Neumología", "institution": "Universidad Nacional de Colombia", "year": 2017},
    {"degree": "Fellowship en Neumología del Sueño", "institution": "Hospital La Fe, Valencia", "year": 2019}
  ]'::jsonb,
  ARRAY['Asociación Colombiana de Neumología y Cirugía de Tórax (Asoneumocito)', 'European Respiratory Society (ERS) Member', 'Polisomnografía Diagnóstica y Terapéutica'],
  ARRAY['Asma y EPOC', 'Fibrosis pulmonar', 'Apnea del sueño', 'Infecciones respiratorias', 'Cesación tabáquica'],
  ARRAY['Español'],
  110000, 45, '/specialists/alejandra-montes.jpg',
  true, 4.8, 97, 9, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY['asthma'],
  '{"tuesday": ["08:00", "10:30"], "thursday": ["09:00", "13:00"], "saturday": ["08:00", "10:00"]}'::jsonb
),

-- 11. Iván Peña Guerrero — Gastroenterología (nuevo)
(
  'ivan-pena-guerrero', 'Dr.', 'Iván Peña Guerrero',
  'Gastroenterología', 'Digestivo',
  'Tu digestión, el centro de tu bienestar',
  'Gastroenterólogo con expertise en endoscopia diagnóstica y microbiota intestinal. Diagnostico y trato desde el reflujo hasta la enfermedad inflamatoria intestinal con un abordaje integral.',
  'El intestino es mucho más que un tubo digestivo: es donde vive el 70% de tu sistema inmune y se producen buena parte de tus neurotransmisores. Me apasiona la microbiota intestinal y su relación con la salud sistémica. Atiendo desde el síndrome de intestino irritable hasta la enfermedad de Crohn, siempre buscando el origen real del problema y no solo el alivio de síntomas. Cuento con entrenamiento avanzado en endoscopia para diagnóstico y tratamiento de patologías del tracto digestivo alto y bajo.',
  '[
    {"degree": "Médico Cirujano", "institution": "Pontificia Universidad Javeriana", "year": 2011},
    {"degree": "Especialista en Gastroenterología y Endoscopia Digestiva", "institution": "Universidad Nacional de Colombia", "year": 2016},
    {"degree": "Fellowship en Endoscopia Avanzada", "institution": "Universidad de São Paulo", "year": 2017}
  ]'::jsonb,
  ARRAY['Asociación Colombiana de Gastroenterología (ACG)', 'Endoscopia Diagnóstica y Terapéutica Avanzada', 'Ultrasonido Endoscópico (ASGE)'],
  ARRAY['Síndrome de intestino irritable', 'Enfermedad inflamatoria intestinal', 'Hígado graso', 'Microbiota intestinal', 'Endoscopia terapéutica'],
  ARRAY['Español', 'Portugués'],
  120000, 45, '/specialists/ivan-pena.jpg',
  true, 4.7, 88, 11, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY[]::text[],
  '{"monday": ["09:00", "11:00"], "thursday": ["10:00", "12:30"], "friday": ["08:00", "14:00"]}'::jsonb
),

-- 12. Camila Ospina Díaz — Reumatología (nueva)
(
  'camila-ospina-diaz', 'Dra.', 'Camila Ospina Díaz',
  'Reumatología', 'Huesos y articulaciones',
  'Las enfermedades autoinmunes no te definen, te entiendo',
  'Reumatóloga con formación en inmunología clínica. Trabajo con artritis reumatoide, lupus y espondiloartritis con un enfoque en diagnóstico temprano y calidad de vida a largo plazo.',
  'Las enfermedades reumatológicas son complejas, invisibles para los demás y muchas veces tardíamente diagnosticadas. Mi misión es cambiar eso: diagnóstico temprano, tratamiento personalizado y acompañamiento continuo para que la enfermedad no dicte cómo vives. Tengo formación avanzada en inmunología clínica y en el uso de terapias biológicas para artritis reumatoide, lupus, espondiloartritis y otras enfermedades autoinmunes. Usamos ultrasonido musculoesquelético para diagnóstico preciso y seguimiento.',
  '[
    {"degree": "Médico Cirujano", "institution": "Universidad de Antioquia", "year": 2012},
    {"degree": "Especialista en Reumatología", "institution": "Universidad Nacional de Colombia", "year": 2017},
    {"degree": "Maestría en Inmunología Clínica", "institution": "Universidad Autónoma de Madrid", "year": 2019}
  ]'::jsonb,
  ARRAY['Asociación Colombiana de Reumatología (Asoreuma)', 'Ultrasonido Musculoesquelético (EULAR)', 'Terapias Biológicas en Enfermedades Autoinmunes (ACR)'],
  ARRAY['Artritis reumatoide', 'Lupus eritematoso sistémico', 'Artritis psoriásica', 'Espondiloartritis', 'Enfermedades autoinmunes'],
  ARRAY['Español'],
  125000, 45, '/specialists/camila-ospina.jpg',
  true, 4.9, 72, 9, 'Bogotá, Colombia',
  ARRAY['virtual'],
  ARRAY[]::text[],
  '{"tuesday": ["09:00", "11:30"], "wednesday": ["14:00"], "friday": ["10:00", "13:00"]}'::jsonb
);
