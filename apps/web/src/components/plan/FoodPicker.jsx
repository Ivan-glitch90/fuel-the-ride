import { Link } from 'react-router';
import { t, tx } from '../../i18n/index.js';
import { foodSummary } from '../../lib/foods.js';

/**
 * Tap the foods you'll carry. Order matters: when two choices are equally good,
 * the plan prefers foods picked earlier (FUELING_RULES.md §7.3), so the number shows the order.
 */
export function FoodPicker({ foods, selectedIds, onToggle, units }) {
  if (foods.length === 0) {
    return (
      <p className="muted">
        {tx('Your library is empty. <link>Add a food</link> to get an hour-by-hour plan.', {
          link: (text) => <Link to="/foods/new">{text}</Link>,
        })}
      </p>
    );
  }
  return (
    <ul className="food-picker" aria-label={t("Foods you'll carry")}>
      {foods.map((food) => {
        const position = selectedIds.indexOf(food.id);
        const selected = position >= 0;
        return (
          <li key={food.id}>
            <button
              type="button"
              className={`food-picker__item ${selected ? 'food-picker__item--on' : ''}`}
              aria-pressed={selected}
              onClick={() => onToggle(food.id)}
            >
              <span className="food-picker__order" aria-hidden="true">
                {selected ? position + 1 : ''}
              </span>
              <span className="food-picker__text">
                <span className="food-picker__name">{food.name}</span>
                <span className="food-picker__summary">{foodSummary(food, units)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
