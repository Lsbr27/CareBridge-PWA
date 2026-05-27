# Labs Analyze API

Endpoint:

`POST /api/labs/analyze`

Body example:

```json
{
  "reportText": "Paciente con panel lipídico y hepático.",
  "labs": [
    { "testName": "Triglicéridos", "value": 240, "unit": "mg/dL", "referenceRange": "0-150" },
    { "testName": "ALT", "value": 68, "unit": "U/L", "referenceRange": "0-40" },
    { "testName": "AST", "value": 55, "unit": "U/L", "referenceRange": "0-40" },
    { "testName": "Glucosa", "value": 92, "unit": "mg/dL", "referenceRange": "70-99" }
  ]
}
```

Expected response:

- `items[]` con status (`low|normal|high|unknown`)
- `patientSummary` en lenguaje sencillo
- `clinicalSummary` técnico
- `alerts[]`
- `urgency` (`routine|urgent`)

Notes:

- Si `ANTHROPIC_API_KEY` está configurada, usa Anthropic para narrativa.
- Si no, usa fallback de reglas clínicas básicas.
