// Spanish (neutral Latin American, tú). Keys are the exact English text used in the app;
// values are the Spanish. Codes ("code:…") translate calculator/server messages by code.
// Glossary and style: src/i18n/GLOSSARY.md. One file per area of the app.
import { account } from './account.js';
import { codes } from './codes.js';
import { common } from './common.js';
import { eventsFoods } from './eventsFoods.js';
import { rides } from './rides.js';

export const es = {
  ...common,
  ...account,
  ...rides,
  ...eventsFoods,
  ...codes,
};
