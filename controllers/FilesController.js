const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
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

        const { name, type, parentId = 0, isPublic = false, data } = req.body;

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
}

module.exports = FilesController;
