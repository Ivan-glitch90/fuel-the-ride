import { Link } from 'react-router';
import { t, tx } from '../../i18n/index.js';
import { FoodPicker } from './FoodPicker.jsx';

const PROFILE_HINT = {
  fast: 'Hard effort: gels and drinks first, they are quick and easy on the stomach.',
  mixed: 'Moderate effort: bars and gels first.',
  steady: 'Easy effort: real food and bars first.',
};

/**
 * Which foods the plan uses (FUELING_RULES.md §7.0).
 * picked === null → the app picks from the library (shown with the reason); otherwise the rider's own picks.
 */
export function FoodsForToday({ library, picked, onChangePicked, foodSelection, units }) {
  const byId = new Map(library.map((f) => [f.id, f]));
  const active = library.filter((f) => !f.archived);

  if (active.length === 0) {
    return (
      <section className="card" aria-labelledby="foods-today-title">
        <h2 id="foods-today-title">{t('Foods for today')}</h2>
        <p className="muted">
          {tx(
            'Your library is empty. <link>Add the foods you eat on the bike</link> and the app will pick from them for each ride.',
            { link: (text) => <Link to="/foods/new">{text}</Link> },
          )}
        </p>
      </section>
    );
  }

  if (picked === null) {
    const names = (foodSelection?.foodIds ?? []).map((id) => byId.get(id)?.name).filter(Boolean);
    const hint = foodSelection && PROFILE_HINT[foodSelection.profile];
    return (
      <section className="card" aria-labelledby="foods-today-title">
        <h2 id="foods-today-title">{t('Foods for today')}</h2>
        {foodSelection ? (
          <>
            <p>
              {tx(
                'Picked from your library: <b>{names}</b>',
                { b: (text) => <strong>{text}</strong> },
                { names: names.join(', ') },
              )}
            </p>
            <p className="muted small">{hint && t(hint)}</p>
          </>
        ) : (
          <p className="muted">{t('The app will pick from your library once the ride details are in.')}</p>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onChangePicked(foodSelection?.foodIds ?? [])}
        >
          {t('Change foods')}
        </button>
      </section>
    );
  }

  const toggle = (id) => onChangePicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  return (
    <section className="card" aria-labelledby="foods-today-title">
      <h2 id="foods-today-title">{t('Foods for today')}</h2>
      <p className="muted small">{t('Your picks, in order of preference. Tap to add or remove.')}</p>
      <FoodPicker foods={active} selectedIds={picked} onToggle={toggle} units={units} />
      <button type="button" className="btn btn--ghost" onClick={() => onChangePicked(null)}>
        {t('Let the app pick')}
      </button>
    </section>
  );
}
