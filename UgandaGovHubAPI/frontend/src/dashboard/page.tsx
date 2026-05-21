import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser } from '../context/UserContext';
import { 
  IconShield, 
  IconKey, 
  IconListDetails, 
  IconGridPattern, 
  IconChartBar, 
  IconCopy, 
  IconExternalLink,
  IconActivity,
  IconClock,
  IconX
} from '@tabler/icons-react';

export default function DashboardPage() {
  const { role, mdaId, mdas } = useUser();
  const [requests, setRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('approvals');
  const [approving, setApproving] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterMda, setFilterMda] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState('7d');

  const fetchDashboardData = () => {
    fetch('http://localhost:4000/api/access')
      .then(res => res.json())
      .then(data => setRequests(data))
      .catch(err => console.error(err));

    fetch('http://localhost:4000/api/access/audit-logs')
      .then(res => res.json())
      .then(data => setAuditLogs(data))
      .catch(err => console.error(err));

    fetch('http://localhost:4000/api/access/matrix')
      .then(res => res.json())
      .then(data => setMatrix(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchDashboardData();
    // Default tabs depending on role
    if (role === 'developer') {
      setActiveTab('credentials');
    } else if (role === 'reviewer') {
      setActiveTab('audit');
    } else {
      setActiveTab('approvals');
    }
  }, [role, mdaId]);

  const handleApprove = (id: string) => {
    setApproving(id);
    fetch(`http://localhost:4000/api/access/${id}/approve`, { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        fetchDashboardData();
      })
      .finally(() => setApproving(null));
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filter requests depending on role
  // Owner only sees requests for their MDA's APIs
  // Admin sees all
  // Developer sees their own requests
  const currentMda = mdas.find(m => m.id === mdaId);
  const visibleRequests = requests.filter(req => {
    if (role === 'developer') {
      return req.consumer_mda_id === mdaId;
    }
    if (role === 'api_owner') {
      // Find APIs that belong to the active owner's MDA
      // api_owner represents NIRA by default (mda-01) or whatever they select in header
      return req.api_id.startsWith(`api-${currentMda?.shortName.toLowerCase()}`);
    }
    return true; // Admin and Reviewer see all
  });

  const visibleLogs = auditLogs.filter(log => {
    if (filterMda !== 'ALL' && log.mda_id !== filterMda) return false;
    return true;
  });

  // Calculate statistics
  const totalApproved = requests.filter(r => r.status === 'APPROVED').length;
  const pendingApprovals = requests.filter(r => r.status === 'PENDING').length;
  const totalCallsCount = auditLogs.filter(l => l.event_type.startsWith('SANDBOX_CALL')).length;
  const deniedCallsCount = auditLogs.filter(l => l.event_type === 'SANDBOX_CALL_DENIED').length;
  const successRate = totalCallsCount > 0 
    ? Math.round(((totalCallsCount - deniedCallsCount) / totalCallsCount) * 100) 
    : 100;

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-8 text-left max-w-[1400px] mx-auto w-full text-[#ededed] relative">
      
      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Approved Channels</span>
            <span className="text-[24px] font-bold text-white mt-1">{totalApproved}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 flex items-center justify-center text-[#3ecf8e]">
            <IconKey className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Pending Approvals</span>
            <span className="text-[24px] font-bold text-white mt-1">{pendingApprovals}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-orange-400/10 border border-orange-400/20 flex items-center justify-center text-orange-400">
            <IconClock className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Total Audited Hits</span>
            <span className="text-[24px] font-bold text-white mt-1">{totalCallsCount}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <IconActivity className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 4 */}
        <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Compliance Rate</span>
            <span className="text-[24px] font-bold text-white mt-1">{successRate}%</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 flex items-center justify-center text-[#3ecf8e]">
            <IconShield className="w-5 h-5" />
          </div>
        </div>
      </div>


      {/* Navigation Tabs */}
      <div className="flex border-b border-[#2e2e2e] gap-1 bg-[#141414] p-1 rounded-lg self-start">
        {role !== 'developer' && role !== 'reviewer' && (
          <button 
            onClick={() => setActiveTab('approvals')}
            className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'approvals' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
            }`}
          >
            <IconShield className="w-4 h-4" />
            Access Approvals
            {pendingApprovals > 0 && (
              <span className="h-4.5 min-w-4.5 px-1 bg-orange-500 text-white font-bold rounded-full text-[10px] flex items-center justify-center">
                {pendingApprovals}
              </span>
            )}
          </button>
        )}

        {(role === 'developer' || role === 'admin') && (
          <button 
            onClick={() => setActiveTab('credentials')}
            className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'credentials' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
            }`}
          >
            <IconKey className="w-4 h-4" />
            My Agency Credentials
          </button>
        )}

        {(role === 'reviewer' || role === 'admin') && (
          <>
            <button 
              onClick={() => setActiveTab('audit')}
              className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'audit' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
              }`}
            >
              <IconListDetails className="w-4 h-4" />
              Audit Trails
            </button>
            <button 
              onClick={() => setActiveTab('matrix')}
              className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'matrix' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
              }`}
            >
              <IconGridPattern className="w-4 h-4" />
              Interoperability Matrix
            </button>
          </>
        )}

        <button 
          onClick={() => setActiveTab('analytics')}
          className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'analytics' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
          }`}
        >
          <IconChartBar className="w-4 h-4" />
          Analytics
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 w-full min-h-[400px]">
        {/* Tab 1: Access Approvals */}
        {activeTab === 'approvals' && (
          <div className="flex flex-col gap-4">
            <div className="border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex justify-between items-center">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">Active Access Requests</h2>
                  <p className="text-[12px] text-[#8b8b8b] mt-0.5">Evaluate legal mandate alignment and issue cryptographically bound sandbox API keys.</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Consumer MDA</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">API Requested</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Lawful Basis</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Purpose</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Fields & Tier</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Status</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-[#8b8b8b] text-[13px]">
                        No access requests found matching your agency permissions.
                      </TableCell>
                    </TableRow>
                  ) : visibleRequests.map(req => (
                    <TableRow key={req.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 transition-colors">
                      <TableCell className="py-3.5 px-4 font-semibold text-[13px] text-[#ededed]">{req.mda_name}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px] text-white font-medium">{req.api_name}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px] text-[#8b8b8b] italic">"{req.legal_basis || 'Not Provided'}"</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px] text-[#8b8b8b] max-w-[180px] truncate" title={req.purpose}>{req.purpose}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[12px] text-[#8b8b8b]">
                        <div className="font-mono text-[#ededed]">{req.volume_tier || 'Low'}</div>
                        <div className="truncate max-w-[150px] mt-0.5">{req.requested_fields || 'All'}</div>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px]">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono border uppercase
                          ${req.status === 'APPROVED' ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' : 'text-orange-400 border-orange-400/20 bg-orange-400/5'}
                        `}>
                          {req.status}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-right">
                        {req.status === 'PENDING' ? (
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={approving === req.id}
                            className="h-[28px] px-3 bg-[#3ecf8e] hover:bg-[#3ecf8e]/95 text-black font-semibold rounded-md text-[12px] transition-all disabled:opacity-50"
                          >
                            {approving === req.id ? 'Approving...' : 'Approve & Issue Key'}
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 font-mono text-[12px] text-[#8b8b8b]">
                            <span>Issued: {req.api_key.substring(0, 12)}...</span>
                            <button 
                              onClick={() => copyToClipboard(req.api_key)}
                              className="text-[#8b8b8b] hover:text-white transition-colors"
                            >
                              <IconCopy className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Tab 2: My Credentials */}
        {activeTab === 'credentials' && (
          <div className="flex flex-col gap-6">
            <div className="border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#2e2e2e] bg-[#141414]">
                <h2 className="text-[15px] font-semibold text-white">Active Agency Sandbox Keys</h2>
                <p className="text-[12px] text-[#8b8b8b] mt-0.5">Use these keys inside headers (<code>X-GovHub-API-Key</code>) to query mock registries.</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Authorized API</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Purpose</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Status</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Sandbox Token</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.filter(r => r.consumer_mda_id === mdaId && r.status === 'APPROVED').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-[#8b8b8b] text-[13px]">
                        No approved API keys found for your agency. Go to the Catalog to submit a request.
                      </TableCell>
                    </TableRow>
                  ) : requests.filter(r => r.consumer_mda_id === mdaId && r.status === 'APPROVED').map(req => (
                    <TableRow key={req.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 transition-colors">
                      <TableCell className="py-3.5 px-4 font-semibold text-[13.5px] text-white">{req.api_name}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px] text-[#8b8b8b] max-w-xs truncate">{req.purpose}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px]">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono border border-[#3ecf8e]/20 text-[#3ecf8e] bg-[#3ecf8e]/5 uppercase">
                          APPROVED
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 font-mono text-[12.5px] text-[#3ecf8e]">
                        <div className="flex items-center gap-2">
                          <span>{req.api_key}</span>
                          <button
                            onClick={() => copyToClipboard(req.api_key)}
                            className="text-[#8b8b8b] hover:text-white p-1 rounded hover:bg-[#2e2e2e] transition-colors"
                          >
                            <IconCopy className="w-3.5 h-3.5" />
                          </button>
                          {copiedKey === req.api_key && <span className="text-[10px] text-green-400 font-sans">Copied!</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-right">
                        <a 
                          href={`/api/${req.api_id}`}
                          className="inline-flex items-center gap-1 text-[12.5px] text-[#3ecf8e] hover:underline"
                        >
                          Try Sandbox <IconExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Tab 3: Audit Trails (Reviewer View) */}
        {activeTab === 'audit' && (
          <div className="flex flex-col gap-4">
            <div className="border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">Platform Governance Audit Log</h2>
                  <p className="text-[12px] text-[#8b8b8b] mt-0.5">Audits compliance actions and records API calls with strict cryptographic correlation IDs.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#8b8b8b] font-mono">Time Range:</span>
                  <select 
                    value={timeRange}
                    onChange={e => setTimeRange(e.target.value)}
                    className="h-[30px] px-2 border border-[#2e2e2e] bg-[#141414] text-white rounded text-[12px] focus:outline-none"
                  >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#8b8b8b] font-mono">Filter Consumer:</span>
                  <select 
                    value={filterMda}
                    onChange={e => setFilterMda(e.target.value)}
                    className="h-[30px] px-2 border border-[#2e2e2e] bg-[#141414] text-white rounded text-[12px] focus:outline-none"
                  >
                    <option value="ALL">All MDAs</option>
                    {mdas.map(m => <option key={m.id} value={m.id}>{m.shortName}</option>)}
                  </select>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Timestamp</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Event Type</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Consumer</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Registry Target</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Correlation ID</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4 text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-[#8b8b8b] text-[13px]">
                        No compliance audit entries recorded.
                      </TableCell>
                    </TableRow>
                  ) : visibleLogs.map(log => {
                    const isDenied = log.event_type.includes('DENIED');
                    const isAllowed = log.event_type.includes('ALLOWED');
                    
                    return (
                      <TableRow 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        className={`border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 cursor-pointer transition-all ${
                          selectedLog?.id === log.id ? 'bg-[#222]' : ''
                        }`}
                      >
                        <TableCell className="py-3 px-4 font-mono text-[12px] text-[#8b8b8b] text-left">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-left">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase font-semibold
                            ${isDenied ? 'text-red-400 border-red-400/20 bg-red-400/5' : 
                              isAllowed ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' : 
                              'text-blue-400 border-blue-400/20 bg-blue-400/5'}
                          `}>
                            {log.event_type}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-left text-[13px] text-white font-medium">
                          {log.mda_name || <span className="text-[#555] font-mono">ANONYMOUS</span>}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-left text-[13px] text-[#8b8b8b]">
                          {log.api_name || <span className="text-[#555] font-mono">SYSTEM</span>}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-left font-mono text-[11px] text-[#8b8b8b]">
                          {log.request_id}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right text-[12.5px] text-[#3ecf8e] hover:underline font-mono">
                          Inspect &rarr;
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Tab 4: Interoperability Matrix */}
        {activeTab === 'matrix' && (
          <div className="flex flex-col gap-6 text-left">
            <div className="border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl p-6 shadow-lg">
              <h2 className="text-[15px] font-semibold text-white mb-2">Government Data Interoperability Channels</h2>
              <p className="text-[12px] text-[#8b8b8b] mb-6">
                Active matrix of approved MDA sharing links. Ensure that all exchanges are backed by statutory instruments.
              </p>
              
              <div className="overflow-x-auto">
                <Table className="border border-[#2e2e2e] rounded-lg">
                  <TableHeader>
                    <TableRow className="border-b border-[#2e2e2e] bg-[#141414]">
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-white h-10 px-4">Consumer MDA</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">NIRA Identity</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">URA Tax Clearance</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">URSB Registry</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">MoWT Transport</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">MoICT Composite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mdas.map(consumer => {
                      const checkAccess = (apiId: string) => {
                        return matrix.some(m => m.consumer_mda_id === consumer.id && m.api_id === apiId);
                      };

                      return (
                        <TableRow key={consumer.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/20">
                          <TableCell className="py-3 px-4 font-semibold text-[13px] text-white">
                            {consumer.name} ({consumer.shortName})
                          </TableCell>
                          
                          {/* NIRA */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-nira-01') ? (
                              <span className="inline-flex h-6 w-6 rounded-full bg-green-500/10 border border-green-500/20 text-[#3ecf8e] items-center justify-center m-auto font-bold text-[11px]">✓</span>
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>

                          {/* URA */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-ura-01') ? (
                              <span className="inline-flex h-6 w-6 rounded-full bg-green-500/10 border border-green-500/20 text-[#3ecf8e] items-center justify-center m-auto font-bold text-[11px]">✓</span>
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>

                          {/* URSB */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-ursb-01') ? (
                              <span className="inline-flex h-6 w-6 rounded-full bg-green-500/10 border border-green-500/20 text-[#3ecf8e] items-center justify-center m-auto font-bold text-[11px]">✓</span>
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>

                          {/* MoWT */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-mowt-01') ? (
                              <span className="inline-flex h-6 w-6 rounded-full bg-green-500/10 border border-green-500/20 text-[#3ecf8e] items-center justify-center m-auto font-bold text-[11px]">✓</span>
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>

                          {/* MoICT */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-moict-01') ? (
                              <span className="inline-flex h-6 w-6 rounded-full bg-green-500/10 border border-green-500/20 text-[#3ecf8e] items-center justify-center m-auto font-bold text-[11px]">✓</span>
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Usage Analytics */}
        {activeTab === 'analytics' && (
          <div className="flex flex-col gap-6 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Traffic Chart */}
              <div className="border border-[#2e2e2e] bg-[#1c1c1c] p-6 rounded-xl shadow-lg">
                <h3 className="text-[14px] font-semibold text-white mb-6">Audited Sandboxed Hits (Last 7 Days)</h3>
                
                {/* Custom SVG Bar Chart */}
                <div className="h-64 flex items-end justify-between gap-3 pt-6 border-b border-[#2e2e2e] pb-1.5 font-mono text-[11px] text-[#8b8b8b]">
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gradient-to-t from-[#3ecf8e]/10 to-[#3ecf8e]/40 rounded-t-sm border-t border-[#3ecf8e]/30" style={{ height: '35%' }}></div>
                    <span>Thu</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gradient-to-t from-[#3ecf8e]/10 to-[#3ecf8e]/40 rounded-t-sm border-t border-[#3ecf8e]/30" style={{ height: '48%' }}></div>
                    <span>Fri</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gradient-to-t from-[#3ecf8e]/10 to-[#3ecf8e]/40 rounded-t-sm border-t border-[#3ecf8e]/30" style={{ height: '20%' }}></div>
                    <span>Sat</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gradient-to-t from-[#3ecf8e]/10 to-[#3ecf8e]/40 rounded-t-sm border-t border-[#3ecf8e]/30" style={{ height: '15%' }}></div>
                    <span>Sun</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gradient-to-t from-[#3ecf8e]/10 to-[#3ecf8e]/60 rounded-t-sm border-t border-[#3ecf8e]/50" style={{ height: '72%' }}></div>
                    <span>Mon</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gradient-to-t from-[#3ecf8e]/10 to-[#3ecf8e]/60 rounded-t-sm border-t border-[#3ecf8e]/50" style={{ height: '88%' }}></div>
                    <span>Tue</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gradient-to-t from-[#3ecf8e] to-[#3ecf8e]/80 rounded-t-sm border-t border-[#3ecf8e]" style={{ height: '95%' }}></div>
                    <span className="text-[#3ecf8e] font-bold">Today</span>
                  </div>
                </div>
              </div>

              {/* Endpoint Distribution */}
              <div className="border border-[#2e2e2e] bg-[#1c1c1c] p-6 rounded-xl shadow-lg flex flex-col">
                <h3 className="text-[14px] font-semibold text-white mb-6">Request Distribution by Registry</h3>
                
                <div className="flex flex-col gap-4 mt-2">
                  {/* NIRA */}
                  <div>
                    <div className="flex justify-between text-[12px] mb-1 font-medium text-white">
                      <span>NIRA Identity API</span>
                      <span>42%</span>
                    </div>
                    <div className="h-2 w-full bg-[#141414] rounded-full overflow-hidden border border-[#2e2e2e]">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '42%' }}></div>
                    </div>
                  </div>

                  {/* URA */}
                  <div>
                    <div className="flex justify-between text-[12px] mb-1 font-medium text-white">
                      <span>URA Tax Compliance API</span>
                      <span>28%</span>
                    </div>
                    <div className="h-2 w-full bg-[#141414] rounded-full overflow-hidden border border-[#2e2e2e]">
                      <div className="h-full bg-[#3ecf8e] rounded-full" style={{ width: '28%' }}></div>
                    </div>
                  </div>

                  {/* URSB */}
                  <div>
                    <div className="flex justify-between text-[12px] mb-1 font-medium text-white">
                      <span>URSB Registry API</span>
                      <span>15%</span>
                    </div>
                    <div className="h-2 w-full bg-[#141414] rounded-full overflow-hidden border border-[#2e2e2e]">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: '15%' }}></div>
                    </div>
                  </div>

                  {/* MoWT */}
                  <div>
                    <div className="flex justify-between text-[12px] mb-1 font-medium text-white">
                      <span>MoWT Driving Permit API</span>
                      <span>10%</span>
                    </div>
                    <div className="h-2 w-full bg-[#141414] rounded-full overflow-hidden border border-[#2e2e2e]">
                      <div className="h-full bg-purple-400 rounded-full" style={{ width: '10%' }}></div>
                    </div>
                  </div>

                  {/* Composite */}
                  <div>
                    <div className="flex justify-between text-[12px] mb-1 font-medium text-white">
                      <span>Service Uganda Composite API</span>
                      <span>5%</span>
                    </div>
                    <div className="h-2 w-full bg-[#141414] rounded-full overflow-hidden border border-[#2e2e2e]">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: '5%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Slide-over Detail Panel for Audit Logs Drill-down */}
      {selectedLog && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#1c1c1c] border-l border-[#2e2e2e] shadow-2xl flex flex-col text-left">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e2e] bg-[#141414]">
            <div>
              <h3 className="text-[15px] font-semibold text-white">Inspect Correlation Link</h3>
              <p className="text-[12px] text-[#8b8b8b] mt-0.5">Correlation ID: <span className="font-mono text-white select-all">{selectedLog.request_id}</span></p>
            </div>
            <button 
              onClick={() => setSelectedLog(null)} 
              className="p-1 rounded hover:bg-[#2e2e2e] text-[#8b8b8b] hover:text-white transition-all"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-5">
            {/* Event Header info */}
            <div className="p-3.5 bg-[#141414] border border-[#2e2e2e] rounded-lg">
              <span className="text-[10px] font-mono text-[#8b8b8b] uppercase tracking-wider block mb-1">Event Type</span>
              <span className={`text-[14px] font-mono font-bold uppercase ${
                selectedLog.event_type.includes('DENIED') ? 'text-red-400' : 'text-[#3ecf8e]'
              }`}>
                {selectedLog.event_type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <span className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Timestamp</span>
                <span className="text-white font-medium">{new Date(selectedLog.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Caller Agency</span>
                <span className="text-white font-medium">{selectedLog.mda_name || 'Anonymous (No Auth Key)'}</span>
              </div>
              <div className="col-span-2 border-t border-[#2e2e2e] pt-3.5">
                <span className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Target Registry</span>
                <span className="text-white font-medium">{selectedLog.api_name || 'System Access Layer'}</span>
              </div>
            </div>

            {/* JSON Metadata Payload */}
            <div className="flex-1 flex flex-col gap-2 mt-2">
              <span className="text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Captured Logs payload (metadata)</span>
              <div className="bg-[#0a0a0a] rounded-lg p-4 font-mono text-[12.5px] border border-[#2e2e2e] overflow-auto flex-1 leading-relaxed text-[#3ecf8e]">
                <pre>{JSON.stringify(JSON.parse(selectedLog.details || '{}'), null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
      
      </div>
    </div>
  );
}
