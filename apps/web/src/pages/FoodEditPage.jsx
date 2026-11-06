import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { FoodForm } from '../components/foods/FoodForm.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { ConfirmButton } from '../components/ui/ConfirmButton.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useCreateFood, useDeleteFood, useFood, useUpdateFood } from '../hooks/useFoods.js';

/** /foods/new creates a food; /foods/:id edits (or deletes) one. */
export function FoodEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const food = useFood(id);
  const create = useCreateFood();
  const update = useUpdateFood();
  const remove = useDeleteFood();
  const save = isNew ? create : update;

  if (!isNew && food.isPending) return <LoadingScreen />;
  if (!isNew && food.isError) {
    return (
      <div className="page">
        <PageHeader title="Food" backTo="/foods" />
        <Notice tone="error">{food.error.status === 404 ? 'That food no longer exists.' : food.error.message}</Notice>
      </div>
    );
  }

  function handleSubmit(body) {
    save.mutate(isNew ? body : { id, patch: body }, { onSuccess: () => navigate('/foods') });
  }

  function handleDelete() {
    remove.mutate(id, {
      onSuccess: (result) => {
        const notice = result?.archived
          ? `"${food.data.name}" was archived because past rides use it. You can restore it from archived foods.`
          : `"${food.data.name}" was deleted.`;
        navigate('/foods', { state: { notice } });
      },
    });
  }

  return (
    <div className="page">
      <PageHeader title={isNew ? 'Add food' : 'Edit food'} backTo="/foods" />
      <FoodForm
        key={food.data?.id ?? 'new'}
        food={food.data}
        units={user.units}
        isEdit={!isNew}
        onSubmit={handleSubmit}
        submitting={save.isPending}
        serverError={save.error}
        submitLabel={isNew ? 'Add food' : 'Save changes'}
      />
      {!isNew && (
        <div className="danger-zone">
          {remove.error && <Notice tone="error">{remove.error.message}</Notice>}
          <ConfirmButton confirmLabel="Tap again to delete" onConfirm={handleDelete} loading={remove.isPending} block>
            Delete food
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}
