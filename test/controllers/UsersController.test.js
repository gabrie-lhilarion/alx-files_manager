const request = require('supertest');
const app = require('../../app'); // Adjust the path as necessary

describe('usersController', () => {
  it('pOST /users should create a new user', async () => {
    expect.assertions(2);

    const response = await request(app)
      .post('/users')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      email: 'test@example.com',
      id: expect.any(String),
    });
  });

  it('pOST /users should return error for missing email', async () => {
    expect.assertions(1);

    const response = await request(app)
      .post('/users')
      .send({ password: 'password123' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Missing email');
  });

  it('pOST /users should return error for missing password', async () => {
    expect.assertions(1);

    const response = await request(app)
      .post('/users')
      .send({ email: 'test@example.com' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Missing password');
  });

  it('pOST /users should return error for existing email', async () => {
    expect.assertions(1);

    await request(app)
      .post('/users')
      .send({ email: 'existing@example.com', password: 'password123' });

    const response = await request(app)
      .post('/users')
      .send({ email: 'existing@example.com', password: 'password123' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Already exist');
  });
});
