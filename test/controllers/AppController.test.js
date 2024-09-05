const request = require('supertest');
const app = require('../../app'); // Adjust the path as necessary

describe('appController', () => {
  it('gET /status should return application status', async () => {
    expect.assertions(2);

    const response = await request(app).get('/status');
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ redis: true, db: true });
  });

  it('gET /stats should return application stats', async () => {
    expect.assertions(2);

    const response = await request(app).get('/stats');
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ users: 12, files: 1231 });
  });
});
