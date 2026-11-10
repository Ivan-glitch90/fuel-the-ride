// Server messages in the rider's language. The web app sends Accept-Language with every
// request (its language setting); emails use the account's saved `language`.
// English is the source; Spanish (neutral Latin American, tú) mirrors apps/web/src/i18n/GLOSSARY.md.
import { z } from 'zod';

export const SUPPORTED_LANGUAGES = ['en', 'es'];

/** 'es' when the request asks for Spanish first, else 'en'. */
export function requestLanguage(req) {
  const header = String(req.get?.('accept-language') ?? '').trim().toLowerCase();
  return header.startsWith('es') ? 'es' : 'en';
}

// zod's own Spanish for its standard messages, except number ranges, which read awkwardly
// ("Demasiado pequeño: se esperaba que número fuera >=30") and are what riders hit most.
// Custom messages are translated below.
const zodEs = z.locales.es().localeError;
function zodEsFriendly(issue) {
  if (issue.code === 'too_small' && issue.origin === 'number') {
    return `Debe ser ${issue.inclusive ? 'al menos' : 'mayor que'} ${issue.minimum}`;
  }
  if (issue.code === 'too_big' && issue.origin === 'number') {
    return `Debe ser ${issue.inclusive ? 'como máximo' : 'menor que'} ${issue.maximum}`;
  }
  return zodEs(issue);
}
export const zodErrorMap = (lang) => (lang === 'es' ? zodEsFriendly : undefined);

const ES = {
  // Errors from the API itself
  'Some fields are invalid': 'Algunos datos no son válidos',
  'An account with that email already exists': 'Ya existe una cuenta con ese correo',
  'Check-in not found': 'No se encontró la revisión',
  'Complete your profile to plan this event': 'Completa tu perfil para planear este evento',
  'Complete your profile to plan this ride': 'Completa tu perfil para planear esta salida',
  'Email or password is incorrect': 'El correo o la contraseña no son correctos',
  'Event not found': 'No se encontró el evento',
  'Food not found': 'No se encontró el alimento',
  'Google sign-in failed. Please try again.': 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.',
  'Google sign-in is not available': 'El inicio de sesión con Google no está disponible',
  'Password is incorrect': 'La contraseña no es correcta',
  'Please log in again': 'Inicia sesión de nuevo',
  'Please log in': 'Inicia sesión',
  'Ride not found': 'No se encontró la salida',
  'This ride was already imported': 'Esta salida ya se importó',
  'Some foods were not found in your library': 'Algunos alimentos no están en tu lista',
  'This link is invalid or has expired. Ask for a new one.': 'Este enlace no es válido o ya venció. Pide uno nuevo.',
  'This ride already has a check-in. Edit it instead.': 'Esta salida ya tiene una revisión. Edítala.',
  'User not found': 'No se encontró el usuario',
  'Your Google account email is not verified': 'El correo de tu cuenta de Google no está verificado',
  'Invalid id': 'Identificador no válido',
  'That already exists': 'Eso ya existe',
  'Request body is not valid JSON': 'La solicitud no es JSON válido',
  'Request body is too large': 'La solicitud es demasiado grande',
  'Something went wrong': 'Algo salió mal',
  'Too many attempts. Try again in a few minutes.': 'Demasiados intentos. Inténtalo de nuevo en unos minutos.',

  // Custom validation messages (validators/*)
  'Enter a valid email address': 'Escribe un correo válido',
  'Please confirm you are 16 or older and agree to the Terms and Privacy Policy':
    'Confirma que tienes 16 años o más y que aceptas los Términos y la Política de privacidad',
  'Please reload the page to see the latest Terms and Privacy Policy':
    'Recarga la página para ver los Términos y la Política de privacidad más recientes',
  'Type DELETE to confirm': 'Escribe DELETE para confirmar',
  'Drinks need a fluid amount in ml (e.g. 500 for a bottle)':
    'Las bebidas necesitan una cantidad de líquido en ml (por ejemplo, 500 para una botella)',
  'Only drinks and electrolytes can have a fluid amount': 'Solo las bebidas y los electrolitos pueden tener líquido',
  'Fuel the Ride is for riders aged 16 and over': 'Fuel the Ride es para ciclistas de 16 años o más',

  // Calculator input errors with fixed text (fuel-core)
  "Enter last time's ride data": 'Escribe los datos de la última vez',
  "Last time's duration must be between 15 and 720 minutes": 'La duración de la última vez debe estar entre 15 y 720 minutos',
  "Enter last time's power, kilojoules or average heart rate":
    'Escribe la potencia, los kilojulios o la frecuencia cardiaca promedio de la última vez',
  'Intensity required: enter kJ, power, heart rate or a zone':
    'Falta la intensidad: escribe kJ, potencia, frecuencia cardiaca o una zona',
};

// Calculator input errors with values in them. Shown under the field they belong to, so the
// Spanish leaves out the technical field name.
const ES_PATTERNS = [
  [/^.+ must be between (\S+) and (\S+)$/, 'Debe estar entre $1 y $2'],
  [/^.+ must be 1–(\d+)$/, 'Debe ser de 1 a $1'],
  [/^.+ must be a whole number from 1 to 5$/, 'Debe ser un número entero del 1 al 5'],
  [/^.+ must be (?:a number )?≥ 0$/, 'Debe ser 0 o más'],
  [/^.+ must be one of .+$/, 'Elige una de las opciones'],
  [/^.+ must be (?:easy, moderate or hard|true or false|an array)$/, 'Valor no válido'],
  [/^age is required to .+$/, 'Necesitamos tu año de nacimiento para calcularlo'],
  [/^Unknown food: (.+)$/, 'Alimento desconocido: $1'],
  [/^.+ is required$/, 'Este dato es obligatorio'],
];

/** English API message → the request's language (unknown messages stay in English). */
export function translateMessage(message, lang) {
  if (lang !== 'es' || typeof message !== 'string') return message;
  if (ES[message]) return ES[message];
  for (const [pattern, replacement] of ES_PATTERNS) {
    if (pattern.test(message)) return message.replace(pattern, replacement);
  }
  return message;
}
