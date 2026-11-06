import { Link } from 'react-router';
import { foodSummary, foodTypeLabel } from '../../lib/foods.js';
import { StarIcon } from '../ui/icons.jsx';

export function FoodCard({ food, units, onToggleFavorite, onRestore }) {
  return (
    <li className="card food-card">
      <Link to={`/foods/${food.id}`} className="food-card__main">
        <span className="food-card__name">{food.name}</span>
        <span className="food-card__meta">
          <span className="badge">{foodTypeLabel(food.type)}</span> {food.servingLabel}
        </span>
        <span className="food-card__summary">{foodSummary(food, units)}</span>
      </Link>
      {onRestore ? (
        <button type="button" className="btn btn--secondary" onClick={() => onRestore(food)}>
          Restore
        </button>
      ) : (
        <button
          type="button"
          className={`icon-btn ${food.favorite ? 'icon-btn--active' : ''}`}
          aria-label={food.favorite ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`}
          aria-pressed={food.favorite}
          onClick={() => onToggleFavorite(food)}
        >
          <StarIcon filled={food.favorite} />
        </button>
      )}
    </li>
  );
}
