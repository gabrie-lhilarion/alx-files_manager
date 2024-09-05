const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const Queue = require('bull');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

const fileQueue = new Queue('fileQueue');

class FilesController {
  /**
       * POST /files - Upload a file and handle folders
       */
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    // Validate name, type, and data
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) return res.status(400).json({ error: 'Missing data' });

    // Handle parentId validation (optional)
    let parentFile;
    if (parentId !== 0) {
      parentFile = await dbClient.db().collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    // Prepare file document
    const newFile = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: ObjectId.isValid(parentId) ? ObjectId(parentId) : 0,
      localPath: '',
    };

    // Handle file or image data
    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const localPath = path.join(folderPath, `${uuidv4()}`);
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
      fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
      newFile.localPath = localPath;
    }

    // Save file in DB
    const result = await dbClient.db().collection('files').insertOne(newFile);

    // Enqueue a thumbnail generation job if the file is an image
    if (type === 'image') {
      fileQueue.add({
        userId,
        fileId: result.insertedId,
      });
    }

    return res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  /**
       * GET /files/:id - Retrieve a file document by ID
       */
  static async getShow(req, res) {
    const token = req.headers['x-token'];
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

  /**
       * GET /files - Retrieve all files for the user based on parentId and with pagination
       */
  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = 0, page = 0 } = req.query;
    const pageSize = 20;
    const skip = page * pageSize;

    const files = await dbClient.db().collection('files')
      .find(
        {
          userId: ObjectId(userId),
          parentId: ObjectId.isValid(parentId) ? ObjectId(parentId) : 0,

        },
      )
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return res.status(200).json(files);
  }

  /**
       * PUT /files/:id/publish - Set isPublic to true
       */
  static async putPublish(req, res) {
    const token = req.headers['x-token'];
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

    await dbClient.db().collection('files').updateOne({ _id: ObjectId(id) }, { $set: { isPublic: true } });

    return res.status(200).json({ ...fileDocument, isPublic: true });
  }

  /**
       * PUT /files/:id/unpublish - Set isPublic to false
       */
  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
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

    await dbClient.db().collection('files').updateOne({ _id: ObjectId(id) }, { $set: { isPublic: false } });

    return res.status(200).json({ ...fileDocument, isPublic: false });
  }

  /**
       * GET /files/:id/data - Retrieve file content or thumbnail
       */
  static async getFile(req, res) {
    const { id } = req.params;
    const { size } = req.query;

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileDocument = await dbClient.db().collection('files').findOne({ _id: ObjectId(id) });

    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (fileDocument.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    const token = req.headers['x-token'];
    if (!fileDocument.isPublic) {
      if (!token) {
        return res.status(404).json({ error: 'Not found' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || userId !== String(fileDocument.userId)) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    let filePath = fileDocument.localPath;
    if (size && [100, 250, 500].includes(Number(size))) {
      filePath = `${filePath}_${size}`;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(fileDocument.name);
    if (!mimeType) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    res.setHeader('Content-Type', mimeType);
    const fileStream = fs.createReadStream(filePath);
    return fileStream.pipe(res);
  }
}

module.exports = FilesController;
