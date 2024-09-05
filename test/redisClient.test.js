const chai = require('chai');
const redisClient = require('../utils/redis');

const { expect } = chai;

describe('redis Client', () => {
  before(async () => {
    await redisClient.set('test_key', 'test_value');
  });

  it('should retrieve a value from Redis', async () => {
    const value = await redisClient.get('test_key');
    expect(value).to.equal('test_value');
  });

  it('should return null for non-existent key', async () => {
    const value = await redisClient.get('non_existent_key');
    expect(value).to.be.null;
  });
});
