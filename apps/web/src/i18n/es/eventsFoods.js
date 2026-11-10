// Events, foods, progress and charts, and shared form controls.
export const eventsFoods = {
  // Shared form controls and units
  Show: 'Mostrar',
  Hide: 'Ocultar',
  'Show password': 'Mostrar contraseña',
  'Hide password': 'Ocultar contraseña',
  Name: 'Nombre',
  Type: 'Tipo',
  Date: 'Fecha',
  Edit: 'Editar',
  'Save changes': 'Guardar cambios',
  'Tap again to delete': 'Toca de nuevo para eliminar',
  'Enter a number': 'Escribe un número',
  'Go to profile': 'Ir al perfil',
  Ride: 'Salida',
  'g/hr': 'g/h',
  '{rate} g/hr': '{rate} g/h',

  // Countdowns and effort sources (lib/format.js)
  today: 'hoy',
  tomorrow: 'mañana',
  '{n} day ago': 'hace {n} día',
  '{n} days ago': 'hace {n} días',
  'in {n} day': 'en {n} día',
  'in {n} days': 'en {n} días',
  'in {n} week': 'en {n} semana',
  'in {n} weeks': 'en {n} semanas',
  kilojoules: 'kilojulios',
  'average power': 'potencia promedio',
  'average heart rate': 'frecuencia cardiaca promedio',
  'power zone': 'zona de potencia',
  'heart-rate zone': 'zona de frecuencia cardiaca',

  // Events list
  'Add event': 'Agregar evento',
  "Races and group rides: plan from last time's numbers, scaled to today's FTP, with a gut-training build-up to race day.":
    'Carreras y salidas en grupo: planea con los datos de la última vez, ajustados a tu FTP de hoy, con un plan de progresión de entrenamiento intestinal hasta el día de la carrera.',
  'No upcoming events.': 'No tienes próximos eventos.',
  'Add your next race or group ride': 'Agrega tu próxima carrera o salida en grupo',
  'Upcoming events': 'Próximos eventos',
  'Hide past events': 'Ocultar eventos pasados',
  'Show past events': 'Mostrar eventos pasados',
  'No past events.': 'No hay eventos pasados.',
  'Past events': 'Eventos pasados',

  // Event form
  Race: 'Carrera',
  'Group ride': 'Salida en grupo',
  Outdoor: 'Exterior',
  'Indoor (trainer, Zwift…)': 'Interior (rodillo, Zwift…)',
  'Event saved.': 'Evento guardado.',
  'Edit event': 'Editar evento',
  'New event': 'Nuevo evento',
  'Add your weight to your profile to plan events.': 'Agrega tu peso en tu perfil para planear eventos.',
  Event: 'Evento',
  'e.g. Spring Gran Fondo': 'ej. Gran Fondo de primavera',
  Where: 'Dónde',
  'Room temperature (optional)': 'Temperatura ambiente (opcional)',
  'Expected temperature (optional)': 'Temperatura esperada (opcional)',
  'Same duration as last time': 'Misma duración que la última vez',
  'Expected duration': 'Duración esperada',
  'Last time': 'La última vez',
  'Your numbers from this event (or a similar one) last time.':
    'Tus datos de este evento (o uno parecido) la última vez.',
  'Race-day carbs': 'Carbohidratos el día de la carrera',
  'Carb goal (optional)': 'Meta de carbohidratos (opcional)',
  'Suggested for this event: {goal} g/hr. Leave empty to use it.':
    'Sugerido para este evento: {goal} g/h. Déjalo vacío para usarlo.',
  'Leave empty to use the suggested goal': 'Déjalo vacío para usar la meta sugerida',
  'Projected effort': 'Esfuerzo previsto',
  'Give the event a name to save it.': 'Ponle un nombre al evento para guardarlo.',
  'Save event': 'Guardar evento',

  // Last time's numbers
  Power: 'Potencia',
  'Heart rate': 'Frecuencia cardiaca',
  "Don't know": 'No sé',
  '1 Bad': '1 Mal',
  '5 Perfect': '5 Perfecto',
  "Fix last time's duration.": 'Corrige la duración de la última vez.',
  "Enter last time's power, kilojoules or heart rate.":
    'Escribe la potencia, los kilojulios o la frecuencia cardiaca de la última vez.',
  'Fill from a logged ride (optional)': 'Llenar con una salida registrada (opcional)',
  'Type it in below…': 'Escríbelo abajo…',
  "Last time's duration": 'Duración de la última vez',
  "Last time's effort": 'Esfuerzo de la última vez',
  'Average power': 'Potencia promedio',
  'Normalized power (optional)': 'Potencia normalizada (opcional)',
  Work: 'Trabajo',
  'Average heart rate': 'Frecuencia cardiaca promedio',
  'FTP back then': 'FTP en ese momento',
  'functional threshold power': 'potencia de umbral funcional',
  "Lets us scale last time's effort to today's FTP":
    'Nos permite ajustar el esfuerzo de la última vez a tu FTP de hoy',
  'Carbs you ate (optional)': 'Carbohidratos que comiste (opcional)',
  'How was your stomach?': '¿Cómo estuvo tu estómago?',
  'I bonked or ran low on energy': 'Me quedé sin energía o me faltó energía',

  // Event detail and forecast
  'That event no longer exists.': 'Ese evento ya no existe.',
  "This event's plan can't be worked out right now.": 'No se puede calcular el plan de este evento en este momento.',
  'Delete event': 'Eliminar evento',
  "Planned from last time's average heart rate of {hr} bpm.":
    'Planeado con la frecuencia cardiaca promedio de la última vez: {hr} bpm.',
  "Planned at last time's {watts} W average.": 'Planeado con el promedio de la última vez: {watts} W.',
  "Last time: <b>{pastW} W</b> average at FTP {pastFtp} W. With today's FTP of {currentFtp} W, the same effort is about <b>{projectedW} W</b>.":
    'La última vez: <b>{pastW} W</b> de promedio con un FTP de {pastFtp} W. Con tu FTP de hoy, {currentFtp} W, el mismo esfuerzo equivale a unos <b>{projectedW} W</b>.',
  'Gut training build-up': 'Plan de progresión de entrenamiento intestinal',
  'Race-day goal <b>{goal} g/hr</b>. Your stomach handles <b>{current} g/hr</b> today.':
    'Meta del día de la carrera: <b>{goal} g/h</b>. Hoy tu estómago tolera <b>{current} g/h</b>.',
  'Week {week}': 'Semana {week}',
  '· from {date}': '· desde el {date}',
  'Practice this on your longest ride of the week': 'Practícalo en tu salida más larga de la semana',
  'Race week': 'Semana de la carrera',
  'Hold steady. Nothing new before race day.': 'Mantente así. Nada nuevo antes del día de la carrera.',
  'Less than a week to go: no time to build up. Race day uses what your stomach handles now.':
    'Falta menos de una semana: no hay tiempo para progresar. El día de la carrera usa lo que tu estómago tolera ahora.',
  'You already handle the race-day goal. Keep practicing it on long rides.':
    'Ya toleras la meta del día de la carrera. Sigue practicándola en salidas largas.',
  'Your trained rate only changes when you accept a suggestion after a check-in, so the build-up is guidance to practice.':
    'Tu tolerancia de carbohidratos solo cambia cuando aceptas una sugerencia después de una revisión, así que el plan de progresión es una guía para practicar.',

  // Foods
  'Your foods': 'Tus alimentos',
  'Add food': 'Agregar alimento',
  'No foods yet.': 'Todavía no tienes alimentos.',
  'Add the gels, bars, drinks and snacks you already eat on the bike.':
    'Agrega los geles, barras, bebidas y snacks que ya comes en la bici.',
  'Add your first food': 'Agrega tu primer alimento',
  'Hide archived foods': 'Ocultar alimentos archivados',
  'Show archived foods': 'Mostrar alimentos archivados',
  'No archived foods.': 'No hay alimentos archivados.',
  'Archived foods': 'Alimentos archivados',
  Restore: 'Restaurar',
  'Remove {name} from favorites': 'Quitar {name} de favoritos',
  'Add {name} to favorites': 'Agregar {name} a favoritos',
  Food: 'Alimento',
  'That food no longer exists.': 'Ese alimento ya no existe.',
  '"{name}" added.': '“{name}” agregado.',
  '"{name}" saved.': '“{name}” guardado.',
  '"{name}" was archived because past rides use it. You can restore it from archived foods.':
    '“{name}” se archivó porque lo usan salidas anteriores. Puedes restaurarlo desde los alimentos archivados.',
  '"{name}" was deleted.': '“{name}” se eliminó.',
  'Edit food': 'Editar alimento',
  'Delete food': 'Eliminar alimento',

  // Food form
  Gel: 'Gel',
  Bar: 'Barra',
  Drink: 'Bebida',
  Electrolyte: 'Electrolitos',
  'Real food': 'Comida',
  Required: 'Obligatorio',
  'Enter a number (0 or more)': 'Escribe un número (0 o más)',
  'Give it a name': 'Ponle un nombre',
  '1 serving': '1 porción',
  'e.g. Oat bar': 'ej. Barra de avena',
  Serving: 'Porción',
  'What one serving is, e.g. "1 gel", "1 bar", "500 ml bottle"':
    'Qué es una porción, por ejemplo “1 gel”, “1 barra”, “botella de 500 ml”',
  Carbs: 'Carbohidratos',
  Calories: 'Calorías',
  Sodium: 'Sodio',
  Fluid: 'Líquidos',
  'Required for drinks': 'Obligatorio para bebidas',
  'Leave empty for tabs or capsules': 'Déjalo vacío para pastillas o cápsulas',
  'Caffeine (optional)': 'Cafeína (opcional)',
  'Favorite (shown first)': 'Favorito (aparece primero)',

  // Progress
  Progress: 'Progreso',
  'Last 30 days': 'Últimos 30 días',
  'Last 90 days': 'Últimos 90 días',
  All: 'Todo',
  'Carb rate': 'Carbohidratos por hora',
  '{change} since {date}': '{change} desde el {date}',
  'Check-ins': 'Revisiones',
  'Eaten vs burned': 'Comido vs. quemado',
  'Gut training': 'Entrenamiento intestinal',
  'The carbs per hour your stomach handles, and what you ate on each ride.':
    'Los carbohidratos por hora que tolera tu estómago y lo que comiste en cada salida.',
  'No check-ins in this period. <link>Check in after your rides</link> to see your gut training here.':
    'No hay revisiones en este periodo. <link>Haz la revisión después de tus salidas</link> para ver aquí tu entrenamiento intestinal.',
  'Calories burned vs eaten': 'Calorías quemadas vs. comidas',
  'Per ride where you logged what you ate.': 'Por cada salida en la que registraste lo que comiste.',
  'No logged rides in this period. Log what you ate on a ride to see it here.':
    'No hay salidas registradas en este periodo. Registra lo que comiste en una salida para verla aquí.',

  // Charts
  'Hide table': 'Ocultar tabla',
  'Show as table': 'Ver como tabla',
  'Trained carb rate: {first} g/hr at the first check-in, {current} g/hr now, over {n} check-in.':
    'Tolerancia de carbohidratos: {first} g/h en la primera revisión, {current} g/h ahora, en {n} revisión.',
  'Trained carb rate: {first} g/hr at the first check-in, {current} g/hr now, over {n} check-ins.':
    'Tolerancia de carbohidratos: {first} g/h en la primera revisión, {current} g/h ahora, en {n} revisiones.',
  'Trained rate': 'Tolerancia',
  'Ate (per ride)': 'Comido (por salida)',
  'Use the left and right arrow keys to read each check-in.':
    'Usa las flechas izquierda y derecha para leer cada revisión.',
  'trained rate': 'tolerancia',
  ate: 'comido',
  'not logged': 'sin registrar',
  plan: 'plan',
  stomach: 'estómago',
  'Trained carb rate and carbs eaten per checked-in ride':
    'Tolerancia de carbohidratos y carbohidratos comidos por salida con revisión',
  Ate: 'Comido',
  Stomach: 'Estómago',
  Burned: 'Quemadas',
  Eaten: 'Comidas',
  'Calories burned and eaten per ride': 'Calorías quemadas y comidas por salida',
  '{ride}, {date}: burned {burned} kcal, ate {eaten} kcal': '{ride}, {date}: quemaste {burned} kcal, comiste {eaten} kcal',
  burned: 'quemadas',
  eaten: 'comidas',
  'of burned': 'de lo quemado',
};
