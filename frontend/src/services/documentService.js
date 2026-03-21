import api from './api';

const notifyDocumentUpdates = () => window.dispatchEvent(new Event('documents-seen-updated'));

export const fetchDocuments = async (params = {}) => {
  const { data } = await api.get('/documents', { params });
  return data.documents;
};

export const uploadDocument = async ({ file, userId, folderType }) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folderType', folderType);

  if (userId) {
    formData.append('userId', userId);
  }

  const { data } = await api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  notifyDocumentUpdates();

  return data.document;
};

const getFilenameFromDisposition = (contentDisposition) => {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || 'document';
};

const fetchDocumentBlob = async (documentId, preview = false) => {
  const { data, headers } = await api.get(`/documents/${documentId}/download${preview ? '?preview=true' : ''}`, {
    responseType: 'blob'
  });

  return {
    blob: data,
    filename: getFilenameFromDisposition(headers['content-disposition'])
  };
};

export const previewDocument = async (documentId) => {
  const { blob } = await fetchDocumentBlob(documentId, true);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

export const downloadDocument = async (documentId) => {
  const { blob, filename } = await fetchDocumentBlob(documentId, false);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
};

export const deleteDocument = async (documentId) => {
  const { data } = await api.delete(`/documents/${documentId}`);
  notifyDocumentUpdates();
  return data;
};
