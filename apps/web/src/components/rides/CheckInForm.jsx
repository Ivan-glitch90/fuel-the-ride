import { useId, useState } from 'react';
import { t } from '../../i18n/index.js';
import { Button } from '../ui/Button.jsx';
import { Notice } from '../ui/Notice.jsx';
import { SegmentedControl } from '../ui/SegmentedControl.jsx';

const scale = (low, high) => [
  { value: 1, label: `1 ${low}` },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: `5 ${high}` },
];

// The three questions from PRODUCT.md §6.5 (English here; translated when rendered)
export const SCORES = [
  { key: 'giScore', label: 'Stomach', low: 'Bad', high: 'Perfect' },
  { key: 'energyScore', label: 'Energy', low: 'Empty', high: 'Strong all ride' },
  { key: 'legsScore', label: 'Legs', low: 'Heavy / dead', high: 'Sharp, feeling the bite' },
];

/** Post-ride check-in: three big 1–5 scales, bonked, cramped and notes. Under 30 seconds. */
export function CheckInForm({ checkIn, onSubmit, submitting, error }) {
  const notesId = useId();
  const [answers, setAnswers] = useState(() => ({
    giScore: checkIn?.giScore ?? null,
    energyScore: checkIn?.energyScore ?? null,
    legsScore: checkIn?.legsScore ?? null,
    bonked: checkIn?.bonked ?? false,
    cramped: checkIn?.cramped ?? false,
    notes: checkIn?.notes ?? '',
  }));
  const [missing, setMissing] = useState([]);
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));

  function handleSubmit(e) {
    e.preventDefault();
    const unanswered = SCORES.filter((s) => answers[s.key] === null).map((s) => s.key);
    setMissing(unanswered);
    if (unanswered.length) return;
    const notes = answers.notes.trim();
    onSubmit({ ...answers, notes: notes || (checkIn ? null : undefined) });
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      {SCORES.map((s) => (
        <SegmentedControl
          key={s.key}
          label={t(s.label)}
          options={scale(t(s.low), t(s.high))}
          value={answers[s.key]}
          onChange={(value) => set({ [s.key]: value })}
          error={missing.includes(s.key) ? t('Pick 1 to 5') : undefined}
        />
      ))}
      <label className="checkbox">
        <input type="checkbox" checked={answers.bonked} onChange={(e) => set({ bonked: e.target.checked })} />
        <span>{t('I bonked')}</span>
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={answers.cramped} onChange={(e) => set({ cramped: e.target.checked })} />
        <span>{t('I cramped')}</span>
      </label>
      <div className="field">
        <label className="field__label" htmlFor={notesId}>
          {t('Notes (optional)')}
        </label>
        <div className="field__control">
          <textarea
            id={notesId}
            className="field__input field__textarea"
            rows={3}
            maxLength={1000}
            value={answers.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>
      </div>
      {error && <Notice tone="error">{error.message}</Notice>}
      <Button type="submit" block loading={submitting}>
        {checkIn ? t('Update check-in') : t('Save check-in')}
      </Button>
    </form>
  );
}
