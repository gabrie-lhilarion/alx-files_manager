const crypto = require('crypto');
const Bull = require('bull');
const dbClient = require('../utils/db');

// Create a queue for user-related background jobs
const userQueue = new Bull('userQueue', {
  redis: { host: 'localhost', port: 6379 },
});

exports.postNew = async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Missing password' });
  }

  // Hash the password using SHA1
  const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

  // Check if the user already exists
  const existingUser = await dbClient.db().collection('users').findOne({ email });
  if (existingUser) {
    return res.status(400).json({ error: 'Already exist' });
  }

  // Create the new user
  const result = await dbClient.db().collection('users').insertOne({ email, password: hashedPassword });
  const userId = result.insertedId;

  // Add job to userQueue for sending a welcome email
  userQueue.add({ userId });

  // Respond with the new user
  res.status(201).json({ id: userId, email });
};
