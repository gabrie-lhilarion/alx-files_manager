const chai = require('chai');
const { MongoClient } = require('mongodb');
const dbClient = require('../utils/db');

const { expect } = chai;

describe('dB Client', () => {
  before(async () => {
    await dbClient.db().collection('test').insertOne({ test: 'value' });
  });

  it('should connect to the database', () => {
    expect(dbClient).to.be.an('object');
  });

  it('should count documents in the test collection', async () => {
    const count = await dbClient.db().collection('test').countDocuments();
    expect(count).to.be.greaterThan(0);
  });
});
