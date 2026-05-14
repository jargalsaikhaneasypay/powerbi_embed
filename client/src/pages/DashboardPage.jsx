import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getEmbedInfo } from '../api';
import * as pbi from 'powerbi-client';

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg-primary)',
  },
  navbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  navLogo: {
    width: '38px',
    height: '38px',
    background: 'linear-gradient(135deg, var(--accent), #7c5bf5)',
    borderRadius: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '17px',
    boxShadow: '0 4px 16px var(--accent-glow)',
  },
  navTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '-0.2px',
  },
  navSubtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontWeight: 300,
    marginTop: '1px',
  },
  tabsWrap: {
    display: 'flex',
    gap: '4px',
    background: 'var(--bg-primary)',
    borderRadius: '10px',
    padding: '4px',
    border: '1px solid var(--border)',
  },
  tab: {
    padding: '7px 22px',
    borderRadius: '7px',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border)',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 14px 6px 6px',
    background: 'var(--bg-elevated)',
    borderRadius: '10px',
    border: '1px solid var(--border)',
  },
  avatar: {
    width: '28px',
    height: '28px',
    background: 'linear-gradient(135deg, var(--accent), #6366f1)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    color: 'white',
  },
  userName: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  logoutBtn: {
    padding: '8px 18px',
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'Outfit, sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  content: {
    flex: 1,
    padding: '16px 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  reportContainer: {
    flex: 1,
    borderRadius: '14px',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    minHeight: 0,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '20px',
  },
  spinner: {
    width: '44px',
    height: '44px',
    border: '3px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  loadingText: {
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontWeight: 300,
    letterSpacing: '0.3px',
  },
  loadingDots: {
    display: 'inline-block',
    animation: 'pulse 1.5s infinite',
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '14px',
    padding: '40px',
    textAlign: 'center',
  },
  errorTitle: {
    color: 'var(--danger)',
    fontSize: '16px',
    fontWeight: 500,
  },
  errorDetail: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    maxWidth: '440px',
    lineHeight: 1.7,
  },
  retryBtn: {
    marginTop: '10px',
    padding: '11px 28px',
    background: 'rgba(79, 125, 245, 0.1)',
    border: '1px solid rgba(79, 125, 245, 0.2)',
    color: 'var(--accent)',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tokenNotice: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: 'var(--bg-card)',
    border: '1px solid rgba(79, 125, 245, 0.2)',
    color: 'var(--accent)',
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: '12px',
    fontFamily: 'Outfit, sans-serif',
    transition: 'opacity 0.3s, transform 0.3s',
    zIndex: 100,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
};

export default function DashboardPage({ userName, allowedReports, onLogout }) {
  const firstReport = allowedReports?.[0] || 1;
  const [status, setStatus] = useState('loading');
  const [reportName, setReportName] = useState('Loading...');
  const [errorMsg, setErrorMsg] = useState('');
  const [showTokenNotice, setShowTokenNotice] = useState(false);
  const [activeReport, setActiveReport] = useState(firstReport);

  const activeReportRef = useRef(activeReport);
  const containerRef = useRef(null);
  const reportRef = useRef(null);
  const powerbiRef = useRef(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    activeReportRef.current = activeReport;
  }, [activeReport]);

  useEffect(() => {
    powerbiRef.current = new pbi.service.Service(
      pbi.factories.hpmFactory,
      pbi.factories.wpmpFactory,
      pbi.factories.routerFactory
    );
  }, []);

  const scheduleRefresh = useCallback((expiry) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const msUntilExpiry = new Date(expiry).getTime() - Date.now();
    const refreshIn = Math.max(msUntilExpiry - 120000, 60000);

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await getEmbedInfo(activeReportRef.current);
        if (data.success && reportRef.current) {
          await reportRef.current.setAccessToken(data.embedToken);
          setShowTokenNotice(true);
          setTimeout(() => setShowTokenNotice(false), 2500);
          scheduleRefresh(data.tokenExpiry);
        }
      } catch (err) {
        console.error('Token refresh failed:', err);
      }
    }, refreshIn);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setReportName('Loading...');

    async function load() {
      try {
        const data = await getEmbedInfo(activeReport);

        if (cancelled) return;

        if (!data.success) {
          setErrorMsg(data.error || 'Failed to get embed token');
          setStatus('error');
          return;
        }

        setReportName(data.reportName);

        const embedConfig = {
          type: 'report',
          id: data.reportId,
          embedUrl: data.embedUrl,
          accessToken: data.embedToken,
          tokenType: pbi.models.TokenType.Embed,
          settings: {
            panes: {
              filters: { expanded: false, visible: true },
              pageNavigation: { visible: true },
            },
            background: pbi.models.BackgroundType.Transparent,
          },
        };

        if (containerRef.current && powerbiRef.current) {
          reportRef.current = powerbiRef.current.embed(
            containerRef.current,
            embedConfig
          );

          reportRef.current.on('loaded', () => {
            if (!cancelled) {
              setStatus('ready');
              scheduleRefresh(data.tokenExpiry);
            }
          });

          reportRef.current.on('error', (event) => {
            console.error('Report error:', event.detail);
          });
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err.message === 'Unauthorized'
            ? 'Session expired. Please log in again.'
            : 'Could not connect to the server.');
          setStatus('error');
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (containerRef.current && powerbiRef.current) {
        powerbiRef.current.reset(containerRef.current);
      }
    };
  }, [activeReport, scheduleRefresh]);

  const multiDashboard = allowedReports?.length > 1;

  return (
    <div style={styles.page}>
      <nav style={styles.navbar}>
        <div style={styles.navLeft}>
          <div style={styles.navLogo}>📊</div>
          <div>
            <div style={styles.navTitle}>Dashboard</div>
            <div style={styles.navSubtitle}>{reportName}</div>
          </div>
        </div>

        {multiDashboard && (
          <div style={styles.tabsWrap}>
            {allowedReports.map(num => (
              <button
                key={num}
                onClick={() => setActiveReport(num)}
                style={{
                  ...styles.tab,
                  ...(activeReport === num ? styles.tabActive : {}),
                }}
              >
                Dashboard {num}
              </button>
            ))}
          </div>
        )}

        <div style={styles.navRight}>
          <div style={styles.userBadge}>
            <div style={styles.avatar}>
              {userName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span style={styles.userName}>{userName}</span>
          </div>
          <button
            onClick={onLogout}
            style={styles.logoutBtn}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--bg-elevated)';
              e.target.style.color = 'var(--text-secondary)';
              e.target.style.borderColor = 'var(--border-hover)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = 'var(--text-muted)';
              e.target.style.borderColor = 'var(--border)';
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div style={styles.content}>
        <div style={styles.reportContainer}>
          {status === 'loading' && (
            <div style={styles.loading}>
              <div style={styles.spinner} />
              <div style={styles.loadingText}>
                Connecting to Power BI
                <span style={styles.loadingDots}>...</span>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div style={styles.errorBox}>
              <div style={{ fontSize: '40px', opacity: 0.6 }}>⚠️</div>
              <div style={styles.errorTitle}>Failed to load report</div>
              <div style={styles.errorDetail}>{errorMsg}</div>
              <button
                onClick={() => window.location.reload()}
                style={styles.retryBtn}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(79, 125, 245, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(79, 125, 245, 0.1)';
                }}
              >
                Try Again
              </button>
            </div>
          )}

          <div
            ref={containerRef}
            style={{
              width: '100%',
              height: '100%',
              display: status === 'error' ? 'none' : 'block',
            }}
          />
        </div>
      </div>

      <div style={{
        ...styles.tokenNotice,
        opacity: showTokenNotice ? 1 : 0,
        transform: showTokenNotice ? 'translateY(0)' : 'translateY(8px)',
      }}>
        🔄 Token refreshed
      </div>
    </div>
  );
}
