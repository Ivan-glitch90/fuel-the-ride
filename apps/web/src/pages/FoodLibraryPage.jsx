import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { FoodCard } from '../components/foods/FoodCard.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { PlusIcon } from '../components/ui/icons.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useFoods, useUpdateFood } from '../hooks/useFoods.js';
import { t } from '../i18n/index.js';

export function FoodLibraryPage() {
  const { user } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const foods = useFoods({ archived: 'false' });
  const archived = useFoods({ archived: 'true' }, { enabled: showArchived });
  const update = useUpdateFood();

  const toggleFavorite = (food) => update.mutate({ id: food.id, patch: { favorite: !food.favorite } });
  const restore = (food) => update.mutate({ id: food.id, patch: { archived: false } });

  return (
    <div className="page">
      <PageHeader
        title={t('Your foods')}
        action={
          <Link to="/foods/new" className="btn btn--primary">
            <PlusIcon /> {t('Add food')}
          </Link>
        }
      />
      {update.error && <Notice tone="error">{update.error.message}</Notice>}

      {foods.isPending && <LoadingScreen />}
      {foods.isError && <Notice tone="error">{foods.error.message}</Notice>}
      {foods.data?.length === 0 && (
        <div className="empty">
          <p>{t('No foods yet.')}</p>
          <p className="muted">{t('Add the gels, bars, drinks and snacks you already eat on the bike.')}</p>
          <Link to="/foods/new" className="btn btn--primary">
            {t('Add your first food')}
          </Link>
        </div>
      )}
      {foods.data?.length > 0 && (
        <ul className="list">
          {foods.data.map((food) => (
            <FoodCard key={food.id} food={food} units={user.units} onToggleFavorite={toggleFavorite} />
          ))}
        </ul>
      )}

      <button type="button" className="btn btn--ghost" onClick={() => setShowArchived((s) => !s)} aria-expanded={showArchived}>
        {showArchived ? t('Hide archived foods') : t('Show archived foods')}
      </button>
      {showArchived && archived.data?.length === 0 && <p className="muted">{t('No archived foods.')}</p>}
      {showArchived && archived.data?.length > 0 && (
        <ul className="list" aria-label={t('Archived foods')}>
          {archived.data.map((food) => (
            <FoodCard key={food.id} food={food} units={user.units} onRestore={restore} />
          ))}
        </ul>
      )}
    </div>
  );
}
