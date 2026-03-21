const fs = require('fs');
const path = require('path');
const env = require('../config/env');

let cloudinaryClient = null;

const folderTypes = ['id', 'contracts', 'certificates', 'other'];
const isRemoteStoragePath = (value) => /^https?:\/\//i.test(String(value || ''));

const sanitizeFilename = (value) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const isCloudinaryEnabled = () => env.mediaStorage === 'cloudinary';

const ensureCloudinaryConfigured = () => {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new Error('Cloudinary storage is enabled but Cloudinary credentials are missing.');
  }
};

const getCloudinaryResourceType = (mimeType = '') => String(mimeType).startsWith('image/') ? 'image' : 'raw';

const getCloudinaryClient = () => {
  ensureCloudinaryConfigured();

  if (!cloudinaryClient) {
    ({ v2: cloudinaryClient } = require('cloudinary'));
    cloudinaryClient.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret
    });
  }

  return cloudinaryClient;
};

const ensureEmployeeFolders = async (userId) => {
  await fs.promises.mkdir(path.join(env.filesRoot, userId), { recursive: true });

  await Promise.all(
    folderTypes.map((folder) => fs.promises.mkdir(path.join(env.filesRoot, userId, folder), { recursive: true }))
  );
};

const deleteStoredDocument = async ({ storagePath, storedName, mimeType }) => {
  if (!storagePath) {
    return;
  }

  if (isCloudinaryEnabled() || isRemoteStoragePath(storagePath)) {
    if (storedName) {
      await getCloudinaryClient().uploader.destroy(storedName, { resource_type: getCloudinaryResourceType(mimeType), type: 'authenticated' });
    }
    return;
  }

  try {
    await fs.promises.unlink(resolveDocumentPath(storagePath));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const saveDocument = async ({ userId, folderType, file }) => {
  if (isCloudinaryEnabled()) {
    const uploadResult = await getCloudinaryClient().uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`, {
      resource_type: getCloudinaryResourceType(file.mimetype),
      type: 'authenticated',
      public_id: `${env.cloudinaryFolder}/${userId}/${folderType}/${Date.now()}-${sanitizeFilename(file.originalname)}`,
      overwrite: false
    });

    return {
      storedName: uploadResult.public_id,
      targetPath: uploadResult.secure_url
    };
  }

  await ensureEmployeeFolders(userId);
  const storedName = `${Date.now()}-${sanitizeFilename(file.originalname)}`;
  const targetPath = path.join(env.filesRoot, userId, folderType, storedName);

  await fs.promises.writeFile(targetPath, file.buffer);

  return {
    storedName,
    targetPath
  };
};

const getRemoteDocumentUrl = ({ storedName, mimeType, fileName, asAttachment = true }) => {
  return getCloudinaryClient().url(storedName, {
    resource_type: getCloudinaryResourceType(mimeType),
    type: 'authenticated',
    sign_url: true,
    secure: true,
    attachment: asAttachment ? (fileName || true) : undefined
  });
};

const resolveDocumentPath = (storagePath) => path.resolve(storagePath);

module.exports = {
  deleteStoredDocument,
  folderTypes,
  getRemoteDocumentUrl,
  ensureEmployeeFolders,
  isRemoteStoragePath,
  saveDocument,
  resolveDocumentPath
};
