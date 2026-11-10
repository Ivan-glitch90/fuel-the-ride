import { Link } from 'react-router';
import { t } from '../../i18n/index.js';
import { foodSummary, foodTypeLabel } from '../../lib/foods.js';
import { StarIcon } from '../ui/icons.jsx';

export function FoodCard({ food, units, onToggleFavorite, onRestore }) {
  return (
    <li className="card food-card">
      <Link to={`/foods/${food.id}`} className="food-card__main">
        <span className="food-card__name">{food.name}</span>
        <span className="food-card__meta">
          <span className="badge">{t(foodTypeLabel(food.type))}</span> {food.servingLabel}
        </span>
        <span className="food-card__summary">{foodSummary(food, units)}</span>
      </Link>
      {onRestore ? (
        <button type="button" className="btn btn--secondary" onClick={() => onRestore(food)}>
          {t('Restore')}
        </button>
      ) : (
        <button
          type="button"
          className={`icon-btn ${food.favorite ? 'icon-btn--active' : ''}`}
          aria-label={
            food.favorite
              ? t('Remove {name} from favorites', { name: food.name })
              : t('Add {name} to favorites', { name: food.name })
          }
          aria-pressed={food.favorite}
          onClick={() => onToggleFavorite(food)}
        >
          <StarIcon filled={food.favorite} />
        </button>
      )}
    </li>
  );
}
