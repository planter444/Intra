import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { fetchAuditLogs } from '../services/auditService';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchAuditLogs().then(setLogs).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle="Critical actions are captured for traceability, accountability, and governance." />

      <SectionCard title="System activity trail" subtitle="Admin-only access to immutable action history.">
        <DataTable
          columns={[
            { key: 'createdAt', header: 'Timestamp' },
            { key: 'actorName', header: 'Actor' },
            { key: 'actorRole', header: 'Role' },
            { key: 'action', header: 'Action' },
            { key: 'entityType', header: 'Entity' },
            { key: 'description', header: 'Description' }
          ]}
          rows={logs}
        />
      </SectionCard>
    </div>
  );
}
