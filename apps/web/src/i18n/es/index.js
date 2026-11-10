// Spanish (neutral Latin American, tú). Keys are the exact English text used in the app;
// values are the Spanish. Codes ("code:…") translate calculator/server messages by code.
// Glossary and style: src/i18n/GLOSSARY.md.
import { codes } from './codes.js';
import { common } from './common.js';

export const es = {
  ...common,
  ...codes,
};
