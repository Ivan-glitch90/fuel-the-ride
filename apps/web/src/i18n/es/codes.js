// Messages translated by code: calculator notes/warnings/flags and carb-rate reasons.
// Templates use the `params` the calculator sends with each message (packages/fuel-core).
// "code:X:one" is the singular form, used when params.count === 1.
export const codes = {
  // Plan warnings
  'code:VERY_HARD': 'Eso es muy duro para tanto tiempo. Revisa los datos.',
  'code:SODIUM_SHORT': 'Te faltan unos {perHour} mg/h de sodio. Agrega una bebida con electrolitos o pastillas.',
  'code:CARBS_OFF_TARGET':
    'No se pueden alcanzar {carbsG} g con estos alimentos. Agrega un gel o una bebida con carbohidratos.',

  // Plan notes
  'code:CAPPED_BY_TRAINED_RATE':
    'Limitado por tu tolerancia de carbohidratos ({trainedGph} g/h). El entrenamiento intestinal puede subirla.',
  'code:MIXED_CARBS_TIP':
    'Por encima de 60 g/h, usa alimentos que combinen glucosa y fructosa (la mayoría de los geles y bebidas deportivas modernos).',
  'code:SODIUM_OPTIONAL': 'El sodio es opcional en esta salida.',
  'code:INDOOR':
    'En interior no hay viento que te refresque, así que sudas más: agregamos {extraMlPerHr} ml/h. Un ventilador ayuda mucho.',
  'code:RACE_DAY':
    'Día de carrera: aliméntate en la parte alta de tu rango, empieza en los primeros 20 minutos y no comas nada que no hayas probado entrenando.',
  'code:GROUP_RIDE':
    'Las salidas en grupo tienen arranques: come según el horario y antes de los tramos duros, no después.',
  'code:NO_FOODS': 'Agrega alimentos para tener un horario.',
  'code:SPREAD_NOTE':
    'Repártelo en la hora: bocados pequeños cada 15–20 min y sorbos cada 10–15 min.',

  // Event forecast notes
  'code:FTP_RATIO_UNKNOWN':
    'Planeado con los mismos vatios que la última vez. Agrega el FTP de la última vez y tu FTP actual para ajustarlo a tu forma de hoy.',
  'code:HR_BASED':
    'Basado en tu frecuencia cardiaca promedio de la última vez. Agrega datos de potencia para un plan más preciso.',
  'code:GOAL_NOT_REACHABLE':
    'Faltan {count} semanas para la carrera: subiendo de forma segura +5–10 g/h por semana puedes llegar a unos {raceDayGph} g/h. El plan usa {raceDayGph}.',
  'code:GOAL_NOT_REACHABLE:one':
    'Falta 1 semana para la carrera: subiendo de forma segura +5–10 g/h por semana puedes llegar a unos {raceDayGph} g/h. El plan usa {raceDayGph}.',
  'code:LAST_TIME_RAN_LOW':
    'La última vez comiste {eatenGph} g/h y te quedaste sin energía. Este plan: {planGph} g/h.',
  'code:LAST_TIME_STOMACH':
    'Tu estómago sufrió la última vez con {eatenGph} g/h. El plan de progresión lo entrena hacia {goalGph} g/h.',

  // Check-in flags
  'code:more-fluid': 'Bebe más la próxima vez.',
  'code:less-fluid': 'Subiste de peso. Puede que estés bebiendo de más, lo cual puede ser peligroso. Bebe según tu sed.',
  'code:more-sodium':
    'Tomaste {eatenMg} mg/h de sodio; el plan era {targetMg}. Agrega sodio la próxima vez.',
  'code:eat-more':
    'Comiste {eatenGph} g/h de carbohidratos; el plan era {targetGph}. Come más cerca de tu plan la próxima vez.',
  'code:drink-more': 'Bebiste el {pct}% del líquido planeado. Bebe más la próxima vez.',
  'code:easy-on-stomach':
    'Tu estómago sufrió. Usa alimentos que ya conoces y sube poco a poco; no agregues más por ahora.',

  // Carb-rate suggestion reasons
  'code:RATE_NOT_TESTED':
    'Esta salida no puso a prueba tu tolerancia de carbohidratos (fue corta o comiste por debajo).',
  'code:RATE_AT_MIN': 'Ya estás en el ritmo mínimo.',
  'code:RATE_AT_MAX': 'Ya estás en el ritmo máximo.',
  'code:RATE_DECREASE': 'Tu estómago sufrió con {actualGph} g/h. Prueba {suggestedGph} g/h por ahora.',
  'code:RATE_NOT_ENOUGH_RIDES': 'Todavía no hay suficientes salidas largas buenas a este ritmo.',
  'code:RATE_COOLDOWN': 'Tu ritmo subió hace menos de {days} días.',
  'code:RATE_INCREASE':
    'Tu estómago toleró bien {trainedGph} g/h en tus últimas {rides} salidas largas. Prueba {suggestedGph} g/h.',
};
