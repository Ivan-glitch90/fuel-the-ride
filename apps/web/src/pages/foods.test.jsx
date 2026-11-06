import { screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';

const gel = { id: 'f1', name: 'Energy gel', type: 'gel', servingLabel: '1 gel', carbsG: 22, kcal: 100, sodiumMg: 50, fluidMl: 0, favorite: true };
const drink = { id: 'f2', name: 'Electrolyte drink', type: 'drink', servingLabel: '1 bottle', carbsG: 15, kcal: 60, sodiumMg: 400, fluidMl: 500, favorite: false };

describe('food library', () => {
  test('lists foods with their nutrition summary', async () => {
    renderApp('/foods', { ...loggedIn(), 'GET /api/foods': [200, { foods: [gel, drink] }] });
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByText('Energy gel')).toBeInTheDocument();
    expect(within(items[0]).getByText('22 g carbs · 100 kcal · 50 mg sodium')).toBeInTheDocument();
    expect(within(items[1]).getByText('15 g carbs · 60 kcal · 400 mg sodium · 500 ml')).toBeInTheDocument();
    expect(within(items[0]).getByRole('button', { name: 'Remove Energy gel from favorites' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('imperial riders see fluid in fl oz', async () => {
    renderApp('/foods', { ...loggedIn(rider({ units: 'imperial' })), 'GET /api/foods': [200, { foods: [drink] }] });
    expect(await screen.findByText(/16\.9 fl oz/)).toBeInTheDocument();
  });

  test('empty library invites the rider to add a food', async () => {
    renderApp('/foods', { ...loggedIn(), 'GET /api/foods': [200, { foods: [] }] });
    expect(await screen.findByRole('link', { name: 'Add your first food' })).toHaveAttribute('href', '/foods/new');
  });

  test('starring a food sends a favorite update', async () => {
    const { user, calls } = renderApp('/foods', {
      ...loggedIn(),
      'GET /api/foods': [200, { foods: [drink] }],
      'PATCH /api/foods/f2': [200, { food: { ...drink, favorite: true } }],
    });
    await user.click(await screen.findByRole('button', { name: 'Add Electrolyte drink to favorites' }));
    expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ favorite: true });
  });
});

describe('add food', () => {
  test('a drink is saved with numbers converted and fluid included', async () => {
    const { user, calls } = renderApp('/foods/new', {
      ...loggedIn(),
      'POST /api/foods': ({ body }) => [201, { food: { id: 'new', ...body } }],
      'GET /api/foods': [200, { foods: [] }],
    });
    await user.type(await screen.findByLabelText('Name'), 'Electrolyte drink');
    await user.click(screen.getByRole('radio', { name: 'Drink' }));
    await user.type(screen.getByLabelText('Serving'), '1 bottle');
    await user.type(screen.getByLabelText('Carbs'), '15');
    await user.type(screen.getByLabelText('Calories'), '60');
    await user.type(screen.getByLabelText('Sodium'), '400');
    await user.type(screen.getByLabelText('Fluid'), '500');
    await user.click(screen.getByRole('button', { name: 'Add food' }));

    expect(await screen.findByRole('heading', { name: 'Your foods' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST').body).toEqual({
      name: 'Electrolyte drink',
      type: 'drink',
      servingLabel: '1 bottle',
      carbsG: 15,
      kcal: 60,
      sodiumMg: 400,
      fluidMl: 500,
      favorite: false,
    });
  });

  test('the fluid field only appears for drinks and electrolytes', async () => {
    const { user } = renderApp('/foods/new', loggedIn());
    await screen.findByLabelText('Name');
    expect(screen.queryByLabelText('Fluid')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Electrolyte' }));
    expect(screen.getByLabelText('Fluid')).toBeInTheDocument();
  });

  test('missing numbers are caught before anything is sent', async () => {
    const { user, calls } = renderApp('/foods/new', loggedIn());
    await user.type(await screen.findByLabelText('Name'), 'Banana');
    await user.type(screen.getByLabelText('Carbs'), 'lots');
    await user.click(screen.getByRole('button', { name: 'Add food' }));

    expect(screen.getByLabelText('Carbs')).toHaveAccessibleDescription('Enter a number (0 or more)');
    expect(screen.getByLabelText('Calories')).toHaveAccessibleDescription('Required');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  test('server validation errors appear under the matching field', async () => {
    const { user } = renderApp('/foods/new', {
      ...loggedIn(),
      'POST /api/foods': [
        400,
        { error: { code: 'VALIDATION_FAILED', message: 'Some fields are invalid', details: [{ path: 'carbsG', message: 'Too many carbs' }] } },
      ],
    });
    await user.type(await screen.findByLabelText('Name'), 'Mega gel');
    await user.type(screen.getByLabelText('Carbs'), '500');
    await user.type(screen.getByLabelText('Calories'), '100');
    await user.click(screen.getByRole('button', { name: 'Add food' }));
    expect(await screen.findByText('Too many carbs')).toBeInTheDocument();
  });
});

describe('edit and delete food', () => {
  test('a food used by past rides is archived, with an explanation', async () => {
    const { user } = renderApp('/foods/f1', {
      ...loggedIn(),
      'GET /api/foods/f1': [200, { food: gel }],
      'DELETE /api/foods/f1': [200, { archived: true, food: { ...gel, archived: true } }],
      'GET /api/foods': [200, { foods: [] }],
    });
    expect(await screen.findByLabelText('Name')).toHaveValue('Energy gel');
    await user.click(screen.getByRole('button', { name: 'Delete food' }));
    await user.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    expect(await screen.findByText(/"Energy gel" was archived because past rides use it/)).toBeInTheDocument();
  });

  test('editing clears caffeine when the field is emptied', async () => {
    const { user, calls } = renderApp('/foods/f1', {
      ...loggedIn(),
      'GET /api/foods/f1': [200, { food: { ...gel, caffeineMg: 75 } }],
      'PATCH /api/foods/f1': ({ body }) => [200, { food: { ...gel, ...body } }],
      'GET /api/foods': [200, { foods: [gel] }],
    });
    await user.clear(await screen.findByLabelText('Caffeine (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('heading', { name: 'Your foods' });
    expect(calls.find((c) => c.method === 'PATCH').body).toMatchObject({ caffeineMg: null, carbsG: 22 });
  });
});
