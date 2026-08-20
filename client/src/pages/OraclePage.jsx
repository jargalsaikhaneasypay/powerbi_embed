import React, { useState } from 'react';
import { runOracleQuery } from '../api';

const DEFAULT_HOST = '';
const DEFAULT_USER = '';
const DEFAULT_PASSWORD = '';

const DEFAULT_QUERY = `SELECT
    i.NAME AS "Terminal Name",
    i.UDID AS "Пос сериал",
    i.MERCHANT_ID AS "Мерчант дугаар",
    i.ID AS "Терминал",
    CASE
        WHEN i.SOLDAMOUNT > 0 THEN 'Зарагдсан'
        WHEN i.TENANT_ID = '004' THEN 'Түрээс'
        WHEN i.TENANT_ID = '005' THEN 'Нэр шилжүүлэг'
        ELSE 'Гэрээ'
    END AS "Төлөв",
    TRUNC(i.CREATED_AT) AS "Пос огноо",
    i.PHONE AS "Утас",
    j.ENTITY_TYPE AS "Хэлбэр",
    l."name" AS "Ажилтан"
FROM EP_CRM."TERMINALS" i
LEFT JOIN EP_CRM."MERCHANTS" j ON i."MERCHANT_ID" = j.ID
LEFT JOIN EP_CRM."ADMIN_USERS" l ON i.CREATED_BY = l."id"
WHERE i.TENANT_ID NOT IN ('006', '007', '009', '010')
AND EXTRACT(YEAR FROM i.CREATED_AT) = 2026`;

export default function OraclePage({ onBack }) {
  const [host, setHost] = useState(DEFAULT_HOST);
  const [user, setUser] = useState(DEFAULT_USER);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await runOracleQuery(host, user, password, query);
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Алдаа гарлаа');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!result) return;
    const header = result.columns.join(',');
    const rows = result.rows.map(row =>
      result.columns.map(col => {
        const val = row[col] ?? '';
        return typeof val === 'string' && (val.includes(',') || val.includes('"'))
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(',')
    );
    const csv = '﻿' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oracle_result.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          ← Буцах
        </button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>🗄️ Oracle DB Query</span>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>

        {/* Connection Settings */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 20,
          marginBottom: 20
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
            Холболтын тохиргоо
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Source (host/service)</span>
              <input
                value={host}
                onChange={e => setHost(e.target.value)}
                style={inputStyle}
                placeholder="192.168.121.10/pdb1"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Username</span>
              <input
                value={user}
                onChange={e => setUser(e.target.value)}
                style={inputStyle}
                placeholder="SHAH_SELECT"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Password</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="••••••••"
              />
            </label>
          </div>
        </div>

        {/* Query Editor */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 20,
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              SQL Query
            </span>
            <button
              onClick={handleRun}
              disabled={loading}
              style={{
                background: loading ? '#555' : '#0078d4',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {loading ? '⏳ Уншиж байна...' : '▶ Ажиллуулах'}
            </button>
          </div>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            rows={14}
            style={{
              ...inputStyle,
              fontFamily: 'Consolas, "Courier New", monospace',
              fontSize: 13,
              width: '100%',
              resize: 'vertical',
              whiteSpace: 'pre'
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#3a1010',
            border: '1px solid #c0392b',
            color: '#ff6b6b',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 20,
            fontFamily: 'monospace',
            fontSize: 13
          }}>
            ❌ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                ✅ {result.rowCount.toLocaleString()} мөр олдлоо
              </span>
              <button
                onClick={exportCSV}
                style={{
                  background: '#217346',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 16px',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                📥 CSV татах
              </button>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13
              }}>
                <thead>
                  <tr>
                    {result.columns.map(col => (
                      <th key={col} style={{
                        position: 'sticky',
                        top: 0,
                        background: 'var(--bg-primary)',
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        borderBottom: '2px solid var(--border)',
                        whiteSpace: 'nowrap'
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
                      {result.columns.map(col => (
                        <td key={col} style={{
                          padding: '7px 12px',
                          borderBottom: '1px solid var(--border)',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)'
                        }}>
                          {row[col] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
};
