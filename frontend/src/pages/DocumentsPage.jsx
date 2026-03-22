import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Trash2 } from 'lucide-react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { fetchUsers } from '../services/userService';
import { deleteDocument, downloadDocument, fetchDocuments, previewDocument, uploadDocument } from '../services/documentService';

const SEEN_DOCUMENT_IDS_KEY = 'kerea_hrms_seen_document_ids';
const getSeenDocumentIdsStorageKey = (userId) => `${SEEN_DOCUMENT_IDS_KEY}_${userId}`;

const getDocumentTypeLabel = (document) => {
  const extension = document.fileName?.split('.').pop()?.trim();
  if (extension) {
    return extension.toUpperCase();
  }

  const subtype = document.mimeType?.split('/').pop()?.split('.').pop();
  return subtype ? subtype.toUpperCase() : 'FILE';
};

const formatDocumentSizeMb = (size) => `${Math.max(1, Math.round(Number(size || 0) / (1024 * 1024) || 0))} MB`;

export default function DocumentsPage() {
  const { user, settings } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [uploadState, setUploadState] = useState({ folderType: 'id', userId: '', employeeName: '', file: null });
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [seenDocumentIds, setSeenDocumentIds] = useState([]);
  const [seenIdsReady, setSeenIdsReady] = useState(user.role !== 'ceo');
  const canManageEmployeeDocuments = user.role === 'hr' || user.role === 'ceo';
  const folderOptions = useMemo(
    () => (settings?.folders || []).filter((folder) => folder?.code && folder?.label),
    [settings?.folders]
  );

  useUnsavedChangesGuard(Boolean(uploadState.file || uploadState.employeeName || uploadState.userId));

  useEffect(() => {
    const defaultFolderCode = folderOptions[0]?.code || 'id';
    if (!folderOptions.some((folder) => folder.code === uploadState.folderType)) {
      setUploadState((current) => ({ ...current, folderType: defaultFolderCode }));
    }
  }, [folderOptions, uploadState.folderType]);

  const employeeMatch = useMemo(
    () => employees.find((employee) => employee.fullName.toLowerCase() === uploadState.employeeName.trim().toLowerCase()),
    [employees, uploadState.employeeName]
  );

  const loadDocuments = async () => {
    const results = await fetchDocuments();
    setDocuments(results);
  };

  useEffect(() => {
    loadDocuments().catch(console.error);
  }, [user.role]);

  useEffect(() => {
    if (!canManageEmployeeDocuments) {
      return;
    }

    fetchUsers()
      .then((results) => setEmployees(results.filter((employee) => employee.isActive && !employee.isDeleted && employee.role !== 'ceo')))
      .catch(console.error);
  }, [canManageEmployeeDocuments]);

  useEffect(() => {
    if (user.role !== 'ceo') {
      setSeenIdsReady(true);
      return;
    }

    const scopedKey = getSeenDocumentIdsStorageKey(user.id);
    const scopedSeenIds = JSON.parse(localStorage.getItem(scopedKey) || 'null');
    const legacySeenIds = JSON.parse(localStorage.getItem(SEEN_DOCUMENT_IDS_KEY) || '[]');
    const nextSeenIds = Array.isArray(scopedSeenIds) ? scopedSeenIds : legacySeenIds;
    setSeenDocumentIds(nextSeenIds.map(String));
    setSeenIdsReady(true);
  }, [user.id, user.role]);

  useEffect(() => {
    if (user.role !== 'ceo' || !seenIdsReady) {
      return;
    }

    localStorage.setItem(getSeenDocumentIdsStorageKey(user.id), JSON.stringify(seenDocumentIds));
    window.dispatchEvent(new Event('documents-seen-updated'));
  }, [seenDocumentIds, seenIdsReady, user.id, user.role]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadState.file) {
      return;
    }

    if (canManageEmployeeDocuments && uploadState.employeeName && !employeeMatch) {
      setMessageTone('error');
      setMessage('Select an employee from the employee-name list before uploading.');
      return;
    }

    try {
      await uploadDocument({
        file: uploadState.file,
        folderType: uploadState.folderType,
        userId: uploadState.userId || employeeMatch?.id || undefined
      });
      setMessageTone('success');
      setMessage('Document uploaded successfully.');
      setUploadState((current) => ({ ...current, file: null, employeeName: '', userId: '' }));
      event.target.reset();
      await loadDocuments();
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Unable to upload this document right now.');
    }
  };

  const visibleDocuments = useMemo(
    () => documents.map((document) => ({
      ...document,
      isNew: user.role === 'ceo'
        ? seenIdsReady && String(document.uploadedBy) !== String(user.id) && !seenDocumentIds.map(String).includes(String(document.id))
        : false
    })).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [documents, seenDocumentIds, seenIdsReady, user.id, user.role]
  );

  const allFolderRows = useMemo(() => {
    if (!canManageEmployeeDocuments) {
      return [];
    }

    const grouped = visibleDocuments.reduce((accumulator, document) => {
      const key = String(document.userId);
      if (!accumulator[key]) {
        accumulator[key] = {
          id: key,
          userId: document.userId,
          employeeName: document.employeeName || 'Employee',
          employeeNo: document.employeeNo || 'No employee number',
          totalSize: 0,
          documentCount: 0,
          newCount: 0,
          documentIds: []
        };
      }

      accumulator[key].totalSize += Number(document.fileSize || 0);
      accumulator[key].documentCount += 1;
      accumulator[key].newCount += document.isNew ? 1 : 0;
      accumulator[key].documentIds.push(String(document.id));
      return accumulator;
    }, {});

    return Object.values(grouped).sort((left, right) => {
      if (right.newCount !== left.newCount) {
        return right.newCount - left.newCount;
      }

      return left.employeeName.localeCompare(right.employeeName);
    });
  }, [canManageEmployeeDocuments, visibleDocuments]);

  const folderRows = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    if (!searchValue) {
      return allFolderRows;
    }

    return allFolderRows.filter((row) => row.employeeName.toLowerCase().includes(searchValue) || row.employeeNo.toLowerCase().includes(searchValue));
  }, [allFolderRows, search]);

  const selectedFolder = useMemo(
    () => allFolderRows.find((row) => String(row.userId) === String(selectedEmployeeId)) || null,
    [allFolderRows, selectedEmployeeId]
  );

  const selectedFolderDocuments = useMemo(
    () => visibleDocuments.filter((document) => String(document.userId) === String(selectedEmployeeId)),
    [selectedEmployeeId, visibleDocuments]
  );

  useEffect(() => {
    if (user.role !== 'ceo' || !selectedEmployeeId) {
      return;
    }

    const nextSeenIds = selectedFolderDocuments
      .filter((document) => document.isNew)
      .map((document) => String(document.id));

    if (!nextSeenIds.length) {
      return;
    }

    setSeenDocumentIds((current) => [...new Set([...current.map(String), ...nextSeenIds])]);
  }, [selectedEmployeeId, selectedFolderDocuments, user.role]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      return;
    }

    const hasVisibleDocuments = visibleDocuments.some((document) => String(document.userId) === String(selectedEmployeeId));
    if (!hasVisibleDocuments) {
      setSelectedEmployeeId('');
    }
  }, [selectedEmployeeId, visibleDocuments]);

  const handleDelete = async (document) => {
    if (!window.confirm(`Delete ${document.fileName}?`)) {
      return;
    }

    try {
      await deleteDocument(document.id);
      setMessageTone('success');
      setMessage('Document deleted successfully.');
      await loadDocuments();
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Unable to delete this document right now.');
    }
  };

  const handlePreview = async (documentId) => {
    try {
      await previewDocument(documentId);
    } catch (error) {
      setMessageTone('error');
      setMessage(error.message || 'Unable to preview this document right now.');
    }
  };

  const handleDownload = async (documentId) => {
    try {
      await downloadDocument(documentId);
    } catch (error) {
      setMessageTone('error');
      setMessage(error.message || 'Unable to download this document right now.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={settings?.labels?.documentsModuleTitle || 'Document Center'}
        subtitle={settings?.labels?.documentsSubtitle || 'Structured employee folders are secured behind authenticated download and preview endpoints.'}
      />

      {message ? <div className={`rounded-2xl px-4 py-3 text-sm ${messageTone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.5fr]">
        <SectionCard title="Upload document" subtitle={`Folders: ${(folderOptions.length ? folderOptions.map((folder) => folder.label).join(', ') : 'No folders configured yet')}.`}>
          <form className="space-y-4" onSubmit={handleUpload}>
            {canManageEmployeeDocuments ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Employee name</label>
                <input list="employee-document-options" placeholder="Search employee by name" value={uploadState.employeeName} onChange={(event) => setUploadState((current) => ({ ...current, employeeName: event.target.value, userId: employees.find((employee) => employee.fullName.toLowerCase() === event.target.value.trim().toLowerCase())?.id || '' }))} />
                <datalist id="employee-document-options">
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.fullName}>{employee.employeeNo || employee.email}</option>
                  ))}
                </datalist>
              </div>
            ) : null}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Folder type</label>
              <select value={uploadState.folderType} onChange={(event) => setUploadState((current) => ({ ...current, folderType: event.target.value }))}>
                {folderOptions.map((folder) => (
                  <option key={folder.code} value={folder.code}>{folder.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">File</label>
              <input type="file" onChange={(event) => setUploadState((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-lg">
              Upload document
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Document repository" subtitle={selectedFolder ? `Viewing all documents stored for ${selectedFolder.employeeName}.` : 'Open an employee folder to review the documents inside it.'}>
          {canManageEmployeeDocuments ? (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Search employee documents</label>
              <input placeholder="Search by employee name" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          ) : null}
          {canManageEmployeeDocuments && !selectedFolder ? (
            <DataTable
              columns={[
                {
                  key: 'employeeName',
                  header: 'Employee',
                  render: (row) => (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{row.employeeName}</p>
                        {row.newCount ? <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">+{row.newCount} new</span> : null}
                      </div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">{row.employeeNo}</p>
                    </div>
                  )
                },
                { key: 'totalSize', header: 'Folder Size', render: (row) => formatDocumentSizeMb(row.totalSize) },
                { key: 'documentCount', header: 'Documents' },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700" onClick={() => setSelectedEmployeeId(String(row.userId))}>
                      <Eye size={14} />View
                    </button>
                  )
                }
              ]}
              rows={folderRows}
              emptyLabel="No employee folders found."
            />
          ) : (
            <div className="space-y-4">
              {canManageEmployeeDocuments ? (
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setSelectedEmployeeId('')}>
                  <ArrowLeft size={16} />Back to employee folders
                </button>
              ) : null}
              <DataTable
                columns={[
                  {
                    key: 'fileName',
                    header: 'File name',
                    render: (row) => (
                      <div className={row.isNew ? 'rounded-2xl bg-amber-50 px-3 py-2' : ''}>
                        <p className="font-medium text-slate-900">{row.fileName}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{row.folderType}</p>
                      </div>
                    )
                  },
                  { key: 'mimeType', header: 'Type', render: (row) => getDocumentTypeLabel(row) },
                  { key: 'fileSize', header: 'Size', render: (row) => formatDocumentSizeMb(row.fileSize) },
                  { key: 'isNew', header: 'Status', render: (row) => row.isNew ? <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">New</span> : <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Seen</span> },
                  {
                    key: 'actions',
                    header: 'Actions',
                    render: (row) => (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700" onClick={() => handlePreview(row.id)}>
                          Preview
                        </button>
                        <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700" onClick={() => handleDownload(row.id)}>
                          Download
                        </button>
                        {canManageEmployeeDocuments ? (
                          <button type="button" className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700" onClick={() => handleDelete(row)}>
                            <Trash2 size={12} />Delete
                          </button>
                        ) : null}
                      </div>
                    )
                  }
                ]}
                rows={canManageEmployeeDocuments ? selectedFolderDocuments : visibleDocuments}
                emptyLabel={canManageEmployeeDocuments ? 'No documents were found in this folder.' : 'No documents found.'}
              />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
