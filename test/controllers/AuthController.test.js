const request = require('supertest');
const app = require('../../app'); // Adjust the path as necessary

describe('authController', () => {
  it('gET /connect should return a token for valid credentials', async () => {
    expect.assertions(2);

    // Assuming a user exists with the email and password
    const response = await request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:password123').toString('base64')}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('gET /connect should return Unauthorized for invalid credentials', async () => {
    expect.assertions(1);

    const response = await request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('invalid@example.com:wrongpassword').toString('base64')}`);
    expect(response.status).toBe(401);
  });

  it('gET /disconnect should sign out the user', async () => {
    expect.assertions(1);

    // Assuming the token is valid
    const token = 'valid_token'; // Replace with actual token if needed
    const response = await request(app)
      .get('/disconnect')
      .set('X-Token', token);
    expect(response.status).toBe(204);
  });

  it('gET /users/me should return the user object', async () => {
    expect.assertions(2);

    // Assuming the token is valid
    const token = 'valid_token'; // Replace with actual token if needed
    const response = await request(app)
      .get('/users/me')
      .set('X-Token', token);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      email: expect.any(String),
      id: expect.any(String),
    });
  });
});
