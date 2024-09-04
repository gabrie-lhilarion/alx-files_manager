const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization || '';
    const [type, credentials] = authHeader.split(' ');

    if (type !== 'Basic' || !credentials) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedCredentials = Buffer.from(credentials, 'base64').toString('ascii');
    const [email, password] = decodedCredentials.split(':');

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
    const user = await dbClient.db().collection('users').findOne({ email, password: hashedPassword });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;

    await redisClient.set(key, user._id.toString(), 86400); // Store the token for 24 hours

    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(key);
    return res.status(204).send();
  }
}

module.exports = AuthController;
