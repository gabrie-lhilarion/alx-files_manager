const request = require('supertest');
const app = require('../../app'); // Adjust the path as necessary

describe('filesController', () => {
  it('pOST /files should create a new file', async () => {
    expect.assertions(2);

    // Assuming token and file data are provided
    const token = 'valid_token'; // Replace with actual token if needed
    const response = await request(app)
      .post('/files')
      .set('X-Token', token)
      .send({
        name: 'file.txt',
        type: 'file',
        data: 'base64data', // Example base64 data
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'file.txt',
      type: 'file',
    });
  });

  it('gET /files/:id should retrieve the file document', async () => {
    expect.assertions(2);

    const fileId = 'file_id'; // Replace with actual file ID
    const token = 'valid_token'; // Replace with actual token if needed
    const response = await request(app)
      .get(`/files/${fileId}`)
      .set('X-Token', token);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: fileId,
      name: expect.any(String),
      type: expect.any(String),
    });
  });

  it('gET /files should retrieve paginated files', async () => {
    expect.assertions(2);

    const token = 'valid_token'; // Replace with actual token if needed
    const response = await request(app)
      .get('/files')
      .set('X-Token', token)
      .query({ page: 0 }); // Example query
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });

  it('pUT /files/:id/publish should set isPublic to true', async () => {
    expect.assertions(2);

    const fileId = 'file_id'; // Replace with actual file ID
    const token = 'valid_token'; // Replace with actual token if needed
    const response = await request(app)
      .put(`/files/${fileId}/publish`)
      .set('X-Token', token);
    expect(response.status).toBe(200);
    expect(response.body.isPublic).toBe(true);
  });

  it('pUT /files/:id/unpublish should set isPublic to false', async () => {
    expect.assertions(2);

    const fileId = 'file_id'; // Replace with actual file ID
    const token = 'valid_token'; // Replace with actual token if needed
    const response = await request(app)
      .put(`/files/${fileId}/unpublish`)
      .set('X-Token', token);
    expect(response.status).toBe(200);
    expect(response.body.isPublic).toBe(false);
  });

  it('gET /files/:id/data should return file content', async () => {
    expect.assertions(2);

    const fileId = 'file_id'; // Replace with actual file ID
    const token = 'valid_token'; // Replace with actual token if needed
    const response = await request(app)
      .get(`/files/${fileId}/data`)
      .set('X-Token', token);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
  });
});
