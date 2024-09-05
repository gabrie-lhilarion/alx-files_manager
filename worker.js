const Bull = require('bull');
const { dbClient } = require('./utils/db'); // Adjust the path as necessary

// Create a queue for user-related background jobs
const userQueue = new Bull('userQueue', {
  redis: { host: 'localhost', port: 6379 },
});

// Process jobs from the userQueue
userQueue.process(async (job) => {
  const { userId } = job.data;

  if (!userId) {
    throw new Error('Missing userId');
  }

  // Find the user in the database
  const user = await dbClient.db().collection('users').findOne({ _id: userId });
  if (!user) {
    throw new Error('User not found');
  }

  // Simulate sending a welcome email
  console.log(`Welcome ${user.email}!`);
});

// Start worker
userQueue.on('completed', (job) => {
  console.log(`Job completed with result ${job.returnvalue}`);
});

userQueue.on('failed', (job, err) => {
  console.error(`Job failed with error ${err.message}`);
});

// Handle process termination
process.on('SIGINT', () => {
  userQueue.close().then(() => {
    console.log('Worker stopped');
    process.exit(0);
  });
});
