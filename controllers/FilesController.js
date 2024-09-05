const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    const validTypes = ['folder', 'file', 'image'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Validate parentId if provided
    if (parentId !== 0) {
      const parentFile = await dbClient.db().collection('files').findOne({ _id: dbClient.ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDocument = {
      userId: dbClient.ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : dbClient.ObjectId(parentId),
    };

    // Handle folder creation
    if (type === 'folder') {
      const result = await dbClient.db().collection('files').insertOne(fileDocument);
      return res.status(201).json({
        id: result.insertedId,
        userId: fileDocument.userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    // Handle file or image creation
    const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
    const localPath = path.join(FOLDER_PATH, uuidv4());

    // Ensure directory exists
    if (!fs.existsSync(FOLDER_PATH)) {
      fs.mkdirSync(FOLDER_PATH, { recursive: true });
    }

    // Save the file locally
    const fileData = Buffer.from(data, 'base64');
    fs.writeFileSync(localPath, fileData);

    // Add the file to the DB with the localPath
    fileDocument.localPath = localPath;
    const result = await dbClient.db().collection('files').insertOne(fileDocument);

    return res.status(201).json({
      id: result.insertedId,
      userId: fileDocument.userId,
      name,
      type,
      isPublic,
      parentId,
      localPath,
    });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileDocument = await dbClient.db().collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(fileDocument);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = 0, page = 0 } = req.query;
    const pageNumber = parseInt(page, 10) || 0;
    const limit = 20;
    const skip = pageNumber * limit;

    const query = {
      userId: ObjectId(userId),
    };

    if (parentId !== '0') {
      query.parentId = ObjectId(parentId);
    }

    const files = await dbClient.db().collection('files')
      .find(query)
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileDocument = await dbClient.db().collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db().collection('files').updateOne(
      { _id: ObjectId(id), userId: ObjectId(userId) },
      { $set: { isPublic: true } },
    );

    const updatedFile = await dbClient.db().collection('files').findOne({
      _id: ObjectId(id),
    });

    return res.status(200).json(updatedFile);
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileDocument = await dbClient.db().collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db().collection('files').updateOne(
      { _id: ObjectId(id), userId: ObjectId(userId) },
      { $set: { isPublic: false } },
    );

    const updatedFile = await dbClient.db().collection('files').findOne({
      _id: ObjectId(id),
    });

    return res.status(200).json(updatedFile);
  }
}

module.exports = FilesController;
