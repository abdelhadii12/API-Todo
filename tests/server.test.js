const test = require('node:test');
const assert = require('node:assert');
const { once } = require('node:events');

process.env.DB_PATH = ':memory:';
const app = require('../src/server');

async function withServer(fn) {
  const server = app.listen(0);
  await once(server, 'listening');
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}`;
  try {
    await fn(url);
  } finally {
    server.close();
  }
}

test('health endpoint returns ok status', async () => {
  await withServer(async (url) => {
    const res = await fetch(`${url}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(typeof body.uptime, 'number');
  });
});

test('login returns a JWT token for valid credentials', async () => {
  await withServer(async (url) => {
    const res = await fetch(`${url}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: 'demo' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(typeof body.token, 'string');
  });
});

test('login fails for invalid credentials', async () => {
  await withServer(async (url) => {
    const res = await fetch(`${url}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: 'wrong' }),
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, 'invalid credentials');
  });
});

test('CRUD operations require auth and work correctly', async () => {
  await withServer(async (url) => {
    const login = await fetch(`${url}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: 'demo' }),
    });
    const { token } = await login.json();
    assert.strictEqual(typeof token, 'string');

    const create = await fetch(`${url}/api/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: 'Test todo' }),
    });
    assert.strictEqual(create.status, 201);
    const todo = await create.json();
    assert.strictEqual(todo.title, 'Test todo');
    assert.strictEqual(todo.done, 0);

    const list = await fetch(`${url}/api/todos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(list.status, 200);
    const todos = await list.json();
    assert.strictEqual(Array.isArray(todos), true);
    assert.strictEqual(todos.length, 1);
    assert.strictEqual(todos[0].title, 'Test todo');

    const update = await fetch(`${url}/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ done: true, title: 'Updated todo' }),
    });
    assert.strictEqual(update.status, 200);
    const updated = await update.json();
    assert.strictEqual(updated.title, 'Updated todo');
    assert.strictEqual(updated.done, 1);

    const del = await fetch(`${url}/api/todos/${todo.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(del.status, 204);

    const afterDelete = await fetch(`${url}/api/todos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const todosAfter = await afterDelete.json();
    assert.strictEqual(todosAfter.find((item) => item.id === todo.id), undefined);
  });
});
