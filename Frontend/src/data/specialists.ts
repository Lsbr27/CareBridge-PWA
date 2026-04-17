export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  schedule_time: string;
}

export interface TimeSlot {
  date: string;
  time: string;
}

export interface Specialist {
  id: string;
  name: string;
  specialty: string;
  tagline: string;
  approach: string;
  interests: string[];
  availableSlots: TimeSlot[];
  photo: string;
  medications: Medication[];
}

const specialists: Specialist[] = [
  {
    id: "spec-001",
    name: "Dra. Sofía Ramírez Torres",
    specialty: "Endocrinología",
    tagline: "Recupera tu metabolismo con alimentos reales",
    approach:
      "Combino evidencia clínica con nutrición funcional para tratar el origen metabólico de tus síntomas, no solo los números en tus análisis.",
    interests: [
      "Resistencia a la insulina",
      "Tiroides funcional",
      "Metabolismo y peso",
      "Alimentación real",
      "Síndrome metabólico",
    ],
    availableSlots: [
      { date: "2026-04-17", time: "09:00" },
      { date: "2026-04-17", time: "11:30" },
      { date: "2026-04-18", time: "10:00" },
      { date: "2026-04-19", time: "08:30" },
      { date: "2026-04-20", time: "12:00" },
      { date: "2026-04-21", time: "09:30" },
      { date: "2026-04-22", time: "11:00" },
      { date: "2026-04-23", time: "10:30" },
    ],
    photo: "/specialists/sofia-ramirez.jpg",
    medications: [
      {
        name: "Metformina",
        dosage: "500 mg",
        frequency: "Dos veces al día",
        schedule_time: "08:00",
      },
      {
        name: "Levotiroxina",
        dosage: "50 mcg",
        frequency: "Una vez al día",
        schedule_time: "07:00",
      },
      {
        name: "Vitamina D3",
        dosage: "2000 UI",
        frequency: "Una vez al día",
        schedule_time: "13:00",
      },
    ],
  },
  {
    id: "spec-002",
    name: "Dra. Valentina Herrera Muñoz",
    specialty: "Ginecología",
    tagline: "Tu salud hormonal, escuchada y comprendida",
    approach:
      "Especializada en endometriosis y disrupción hormonal, ofrezco un enfoque integrador que valida tu experiencia y busca bienestar real, no solo ausencia de enfermedad.",
    interests: [
      "Endometriosis",
      "SOP",
      "Salud hormonal",
      "Dolor pélvico crónico",
      "Fertilidad natural",
    ],
    availableSlots: [
      { date: "2026-04-17", time: "10:00" },
      { date: "2026-04-18", time: "09:00" },
      { date: "2026-04-18", time: "14:00" },
      { date: "2026-04-19", time: "11:00" },
      { date: "2026-04-20", time: "09:30" },
      { date: "2026-04-21", time: "13:00" },
      { date: "2026-04-22", time: "10:00" },
      { date: "2026-04-23", time: "09:00" },
    ],
    photo: "/specialists/valentina-herrera.jpg",
    medications: [
      {
        name: "Dienogest",
        dosage: "2 mg",
        frequency: "Una vez al día",
        schedule_time: "21:00",
      },
      {
        name: "Ibuprofeno",
        dosage: "400 mg",
        frequency: "Según necesidad",
        schedule_time: "08:00",
      },
      {
        name: "Progesterona micronizada",
        dosage: "200 mg",
        frequency: "Una vez al día",
        schedule_time: "22:00",
      },
    ],
  },
  {
    id: "spec-003",
    name: "Dr. Mateo Villanueva Ortega",
    specialty: "Dermatología",
    tagline: "La piel refleja lo que ocurre por dentro",
    approach:
      "Trabajo la conexión intestino-piel para tratar dermatitis y condiciones crónicas desde su raíz inflamatoria, con opciones terapéuticas que van más allá de los corticoides.",
    interests: [
      "Dermatitis atópica",
      "Eje intestino-piel",
      "Rosácea",
      "Psoriasis",
      "Dermatología integrativa",
    ],
    availableSlots: [
      { date: "2026-04-17", time: "08:00" },
      { date: "2026-04-17", time: "13:00" },
      { date: "2026-04-18", time: "11:00" },
      { date: "2026-04-19", time: "09:00" },
      { date: "2026-04-20", time: "10:30" },
      { date: "2026-04-21", time: "08:30" },
      { date: "2026-04-22", time: "14:00" },
      { date: "2026-04-23", time: "11:30" },
    ],
    photo: "/specialists/mateo-villanueva.jpg",
    medications: [
      {
        name: "Dupilumab",
        dosage: "300 mg",
        frequency: "Cada dos semanas",
        schedule_time: "09:00",
      },
      {
        name: "Tacrolimus tópico",
        dosage: "0.1%",
        frequency: "Dos veces al día",
        schedule_time: "08:00",
      },
      {
        name: "Cetirizina",
        dosage: "10 mg",
        frequency: "Una vez al día",
        schedule_time: "22:00",
      },
    ],
  },
  {
    id: "spec-005",
    name: "Lic. Andrés Fuentes Castillo",
    specialty: "Nutrición",
    tagline: "Recupera tu energía con alimentos que nutren de verdad",
    approach:
      "Diseño planes alimenticios individualizados centrados en alimentos integrales para combatir la fatiga crónica, equilibrar el azúcar en sangre y restaurar la vitalidad desde adentro.",
    interests: [
      "Fatiga crónica",
      "Nutrición ortomolecular",
      "Alimentación anti-inflamatoria",
      "Salud mitocondrial",
      "Nutrición deportiva funcional",
    ],
    availableSlots: [
      { date: "2026-04-17", time: "09:30" },
      { date: "2026-04-17", time: "14:30" },
      { date: "2026-04-18", time: "12:00" },
      { date: "2026-04-19", time: "08:00" },
      { date: "2026-04-19", time: "13:00" },
      { date: "2026-04-20", time: "10:00" },
      { date: "2026-04-21", time: "11:30" },
      { date: "2026-04-22", time: "09:00" },
    ],
    photo: "/specialists/andres-fuentes.jpg",
    medications: [
      {
        name: "Complejo B activo",
        dosage: "1 cápsula",
        frequency: "Una vez al día",
        schedule_time: "08:00",
      },
      {
        name: "Magnesio bisglicinato",
        dosage: "300 mg",
        frequency: "Una vez al día",
        schedule_time: "21:00",
      },
      {
        name: "Omega-3 (EPA/DHA)",
        dosage: "1 g",
        frequency: "Dos veces al día",
        schedule_time: "13:00",
      },
    ],
  },
];

export default specialists;
