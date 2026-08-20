import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAdminData,
  addSsoUser, updateSsoUser, deleteSsoUser,
  addDashboard, deleteDashboard
} from '../api';

const S = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-primary)' },
  navbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 24px', background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  navLogo: {
    width: '38px', height: '38px',
    background: 'linear-gradient(135deg, #f59f45, #e06b2f)',
    borderRadius: '11px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '17px',
  },
  navTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px' },
  navSubtitle: { fontSize: '12px', color: 'var(--text-muted)', fontWeight: 300, marginTop: '1px' },
  backBtn: {
    padding: '8px 18px', background: 'transparent', border: '1px solid var(--border)',
    color: 'var(--text-muted)', borderRadius: '8px', fontSize: '13px',
    fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.2s',
  },
  content: { flex: 1, padding: '24px', maxWidth: '900px', width: '100%', margin: '0 auto' },
  tabs: {
    display: 'flex', gap: '4px', background: 'var(--bg-secondary)',
    borderRadius: '10px', padding: '4px', border: '1px solid var(--border)',
    marginBottom: '24px', width: 'fit-content',
  },
  tab: {
    padding: '8px 24px', borderRadius: '7px', border: '1px solid transparent',
    background: 'transparent', color: 'var(--text-muted)', fontSize: '13px',
    fontFamily: 'Outfit, sans-serif', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
  },
  tabActive: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' },
  card: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: '16px', padding: '24px', marginBottom: '20px',
  },
  cardTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '18px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px',
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '12px 14px', fontSize: '13px', color: 'var(--text-secondary)',
    borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle',
  },
  tag: {
    display: 'inline-block', padding: '2px 8px', borderRadius: '5px',
    fontSize: '11px', fontWeight: 500, marginRight: '4px', marginBottom: '2px',
    background: 'rgba(79, 125, 245, 0.12)', color: 'var(--accent)',
    border: '1px solid rgba(79, 125, 245, 0.2)',
  },
  deleteBtn: {
    padding: '5px 12px', background: 'transparent', border: '1px solid rgba(232, 84, 84, 0.3)',
    color: 'var(--danger)', borderRadius: '6px', fontSize: '12px',
    fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.2s',
  },
  editBtn: {
    padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)',
    color: 'var(--text-muted)', borderRadius: '6px', fontSize: '12px',
    fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.2s', marginRight: '6px',
  },
  divider: { height: '1px', background: 'var(--border)', margin: '20px 0' },
  formTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px' },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '160px' },
  label: {
    fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  input: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border)',
    borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px',
    fontFamily: 'Outfit, sans-serif', outline: 'none',
  },
  addBtn: {
    padding: '10px 20px', background: 'linear-gradient(135deg, var(--accent), #6366f1)',
    color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px',
    fontWeight: 600, fontFamily: 'Outfit, sans-serif', cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'all 0.2s',
  },
  checkboxRow: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' },
  checkLabel: {
    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
    color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none',
  },
  toast: {
    position: 'fixed', bottom: '24px', right: '24px',
    padding: '12px 20px', borderRadius: '12px', fontSize: '13px',
    fontFamily: 'Outfit, sans-serif', zIndex: 1000,
    transition: 'opacity 0.3s, transform 0.3s',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  emptyRow: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '24px' },
  inlineEditBox: {
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    borderRadius: '10px', padding: '14px', marginTop: '8px',
  },
};

function Toast({ message, type, visible }) {
  return (
    <div style={{
      ...S.toast,
      background: type === 'error' ? 'var(--danger-bg)' : 'var(--bg-elevated)',
      border: `1px solid ${type === 'error' ? 'rgba(232,84,84,0.3)' : 'rgba(79,125,245,0.2)'}`,
      color: type === 'error' ? 'var(--danger)' : 'var(--accent)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  );
}

export default function AdminPage({ onLogout }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('sso');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  // SSO form stat,e
  const [ssoEmail, setSsoEmail] = useState('');
  const [ssoName, setSsoName] = useState('');
  const [ssoReports, setSsoReports] = useState([]);
  const [ssoSubmitting, setSsoSubmitting] = useState(false);

  // Dashboard form state
  const [dbName, setDbName] = useState('');
  const [dbReportId, setDbReportId] = useState('');
  const [dbSubmitting, setDbSubmitting] = useState(false);

  // Inline edit state
  const [editingEmail, setEditingEmail] = useState(null);
  const [editReports, setEditReports] = useState([]);

  function showToast(message, type = 'success') {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }

  async function reload() {
    try {
      const res = await getAdminData();
      if (res.success) setData(res);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function handleAddSsoUser(e) {
    e.preventDefault();
    if (!ssoEmail.trim() || !ssoName.trim()) return;
    setSsoSubmitting(true);
    try {
      const res = await addSsoUser(ssoEmail.trim(), ssoName.trim(), ssoReports);
      if (res.success) {
        showToast('SSO user added');
        setSsoEmail(''); setSsoName(''); setSsoReports([]);
        await reload();
      } else {
        showToast(res.error || 'Failed to add user', 'error');
      }
    } catch {
      showToast('Server error', 'error');
    } finally {
      setSsoSubmitting(false);
    }
  }

  async function handleDeleteSsoUser(email) {
    if (!confirm(`Remove ${email} from SSO access?`)) return;
    try {
      const res = await deleteSsoUser(email);
      if (res.success) {
        showToast('User removed');
        if (editingEmail === email) setEditingEmail(null);
        await reload();
      } else {
        showToast(res.error || 'Failed to remove user', 'error');
      }
    } catch {
      showToast('Server error', 'error');
    }
  }

  function startEdit(email, currentReports) {
    setEditingEmail(email);
    setEditReports([...currentReports]);
  }

  async function saveEdit(email) {
    try {
      const user = data.ssoUsers[email];
      const res = await updateSsoUser(email, user.name, editReports);
      if (res.success) {
        showToast('Permissions updated');
        setEditingEmail(null);
        await reload();
      } else {
        showToast(res.error || 'Failed to update', 'error');
      }
    } catch {
      showToast('Server error', 'error');
    }
  }

  async function handleAddDashboard(e) {
    e.preventDefault();
    if (!dbName.trim() || !dbReportId.trim()) return;
    setDbSubmitting(true);
    try {
      const res = await addDashboard(dbName.trim(), dbReportId.trim());
      if (res.success) {
        showToast('Dashboard added');
        setDbName(''); setDbReportId('');
        await reload();
      } else {
        showToast(res.error || 'Failed to add dashboard', 'error');
      }
    } catch {
      showToast('Server error', 'error');
    } finally {
      setDbSubmitting(false);
    }
  }

  async function handleDeleteDashboard(id, name) {
    if (!confirm(`Delete "${name}"? This will also remove it from all SSO users' permissions.`)) return;
    try {
      const res = await deleteDashboard(id);
      if (res.success) {
        showToast('Dashboard deleted');
        await reload();
      } else {
        showToast(res.error || 'Failed to delete', 'error');
      }
    } catch {
      showToast('Server error', 'error');
    }
  }

  function toggleReport(id, checked, setter) {
    setter(prev => checked ? [...prev, id] : prev.filter(r => r !== id));
  }

  const dashboards = data?.dashboards || [];
  const ssoUsers = data ? Object.entries(data.ssoUsers) : [];

  return (
    <div style={S.page}>
      <nav style={S.navbar}>
        <div style={S.navLeft}>
          <div style={S.navLogo}>⚙️</div>
          <div>
            <div style={S.navTitle}>Admin Panel</div>
            <div style={S.navSubtitle}>Manage SSO users and dashboards</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            style={S.backBtn}
            onClick={() => navigate('/dashboard')}
            onMouseEnter={e => { e.target.style.background = 'var(--bg-elevated)'; e.target.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-muted)'; }}
          >
            Back to Dashboard
          </button>
          <button
            style={S.backBtn}
            onClick={onLogout}
            onMouseEnter={e => { e.target.style.background = 'var(--bg-elevated)'; e.target.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-muted)'; }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div style={S.content}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : (
          <>
            <div style={S.tabs}>
              <button style={{ ...S.tab, ...(tab === 'sso' ? S.tabActive : {}) }} onClick={() => setTab('sso')}>
                SSO Users ({ssoUsers.length})
              </button>
              <button style={{ ...S.tab, ...(tab === 'dashboards' ? S.tabActive : {}) }} onClick={() => setTab('dashboards')}>
                Dashboards ({dashboards.length})
              </button>
            </div>

            {/* SSO Users Tab */}
            {tab === 'sso' && (
              <>
                <div style={S.card}>
                  <div style={S.cardTitle}>Current SSO Users</div>
                  {ssoUsers.length === 0 ? (
                    <div style={S.emptyRow}>No SSO users configured.</div>
                  ) : (
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Email</th>
                          <th style={S.th}>Name</th>
                          <th style={S.th}>Dashboard Access</th>
                          <th style={S.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ssoUsers.map(([email, user]) => (
                          <React.Fragment key={email}>
                            <tr>
                              <td style={S.td}>{email}</td>
                              <td style={S.td}>{user.name}</td>
                              <td style={S.td}>
                                {user.reports.length === 0
                                  ? <span style={{ color: 'var(--text-muted)' }}>None</span>
                                  : user.reports.map(id => {
                                    const d = dashboards.find(x => x.id === id);
                                    return <span key={id} style={S.tag}>{d ? d.name : `#${id}`}</span>;
                                  })
                                }
                              </td>
                              <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                                <button
                                  style={S.editBtn}
                                  onClick={() => editingEmail === email ? setEditingEmail(null) : startEdit(email, user.reports)}
                                  onMouseEnter={e => { e.target.style.borderColor = 'var(--border-hover)'; e.target.style.color = 'var(--text-secondary)'; }}
                                  onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)'; }}
                                >
                                  {editingEmail === email ? 'Cancel' : 'Edit'}
                                </button>
                                <button
                                  style={S.deleteBtn}
                                  onClick={() => handleDeleteSsoUser(email)}
                                  onMouseEnter={e => { e.target.style.background = 'rgba(232,84,84,0.1)'; }}
                                  onMouseLeave={e => { e.target.style.background = 'transparent'; }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                            {editingEmail === email && (
                              <tr>
                                <td colSpan={4} style={{ padding: '0 14px 12px' }}>
                                  <div style={S.inlineEditBox}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                      Edit dashboard access for <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong>
                                    </div>
                                    <div style={S.checkboxRow}>
                                      {dashboards.map(d => (
                                        <label key={d.id} style={S.checkLabel}>
                                          <input
                                            type="checkbox"
                                            checked={editReports.includes(d.id)}
                                            onChange={e => toggleReport(d.id, e.target.checked, setEditReports)}
                                            style={{ accentColor: 'var(--accent)' }}
                                          />
                                          {d.name}
                                        </label>
                                      ))}
                                      {dashboards.length === 0 && (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No dashboards available</span>
                                      )}
                                    </div>
                                    <button
                                      style={{ ...S.addBtn, marginTop: '12px', padding: '8px 16px', fontSize: '12px' }}
                                      onClick={() => saveEdit(email)}
                                    >
                                      Save Permissions
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={S.card}>
                  <div style={S.cardTitle}>Add SSO User</div>
                  <form onSubmit={handleAddSsoUser}>
                    <div style={S.formRow}>
                      <div style={S.formGroup}>
                        <label style={S.label}>Company Email</label>
                        <input
                          style={S.input}
                          type="email"
                          placeholder="user@easypay.mn"
                          value={ssoEmail}
                          onChange={e => setSsoEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div style={S.formGroup}>
                        <label style={S.label}>Display Name</label>
                        <input
                          style={S.input}
                          type="text"
                          placeholder="Full name"
                          value={ssoName}
                          onChange={e => setSsoName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '14px' }}>
                      <div style={S.label}>Dashboard Access</div>
                      <div style={S.checkboxRow}>
                        {dashboards.map(d => (
                          <label key={d.id} style={S.checkLabel}>
                            <input
                              type="checkbox"
                              checked={ssoReports.includes(d.id)}
                              onChange={e => toggleReport(d.id, e.target.checked, setSsoReports)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            {d.name}
                          </label>
                        ))}
                        {dashboards.length === 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                            Add dashboards first before assigning access.
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={ssoSubmitting || dashboards.length === 0}
                      style={{ ...S.addBtn, marginTop: '16px', opacity: ssoSubmitting ? 0.6 : 1 }}
                    >
                      {ssoSubmitting ? 'Adding...' : 'Add User'}
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* Dashboards Tab */}
            {tab === 'dashboards' && (
              <>
                <div style={S.card}>
                  <div style={S.cardTitle}>Current Dashboards</div>
                  {dashboards.length === 0 ? (
                    <div style={S.emptyRow}>No dashboards configured.</div>
                  ) : (
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>ID</th>
                          <th style={S.th}>Name</th>
                          <th style={S.th}>Power BI Report ID</th>
                          <th style={S.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboards.map(d => (
                          <tr key={d.id}>
                            <td style={{ ...S.td, color: 'var(--text-muted)', fontSize: '12px' }}>#{d.id}</td>
                            <td style={S.td}>{d.name}</td>
                            <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                              {d.reportId}
                            </td>
                            <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                              <button
                                style={S.deleteBtn}
                                onClick={() => handleDeleteDashboard(d.id, d.name)}
                                onMouseEnter={e => { e.target.style.background = 'rgba(232,84,84,0.1)'; }}
                                onMouseLeave={e => { e.target.style.background = 'transparent'; }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={S.card}>
                  <div style={S.cardTitle}>Add Dashboard</div>
                  <form onSubmit={handleAddDashboard}>
                    <div style={S.formRow}>
                      <div style={S.formGroup}>
                        <label style={S.label}>Dashboard Name</label>
                        <input
                          style={S.input}
                          type="text"
                          placeholder="e.g. Sales Report"
                          value={dbName}
                          onChange={e => setDbName(e.target.value)}
                          required
                        />
                      </div>
                      <div style={{ ...S.formGroup, flex: 2 }}>
                        <label style={S.label}>Power BI Report ID</label>
                        <input
                          style={S.input}
                          type="text"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={dbReportId}
                          onChange={e => setDbReportId(e.target.value)}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={dbSubmitting}
                        style={{ ...S.addBtn, opacity: dbSubmitting ? 0.6 : 1, alignSelf: 'flex-end', marginBottom: '0' }}
                      >
                        {dbSubmitting ? 'Adding...' : 'Add Dashboard'}
                      </button>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Find the Report ID in Power BI Service: open the report → copy the ID from the URL after /reports/
                    </div>
                  </form>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  );
}
