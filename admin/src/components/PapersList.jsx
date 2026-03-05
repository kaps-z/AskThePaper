import { useState, useEffect, useCallback } from 'react';
import { getTopics, deleteTopic, getTopicFiles, deleteFile, processFile, deleteChunks } from '../api';
import ChunksModal, { STRATEGY_INFO, ALL_STRATEGIES } from './ChunksModal';

const STRATEGIES = ALL_STRATEGIES;
const STRATEGY_ICONS = Object.fromEntries(Object.entries(STRATEGY_INFO).map(([k, v]) => [k, v.icon]));

// ─── Toast ────────────────────────────────────────────────────────────────────
let _tid = 0;
function useToast() {
    const [toasts, setToasts] = useState([]);
    const add = useCallback((message, type = 'info', duration = 5000) => {
        const id = ++_tid;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration);
    }, []);
    const remove = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
    return { toasts, add, remove };
}
function Toasts({ toasts, remove }) {
    if (!toasts || toasts.length === 0) return null;
    return (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '420px' }}>
            {toasts.map(t => (
                <div key={t.id} style={{ ...toastBase, ...(t.type === 'success' ? toastSuccess : t.type === 'error' ? toastError : toastInfo), animation: 'slideInRight 0.3s ease' }}>
                    <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
                    <span style={{ flex: 1, lineHeight: '1.4' }}>{t.message}</span>
                    <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.6 }}>×</button>
                </div>
            ))}
        </div>
    );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function Confirm({ msg, onConfirm, onCancel }) {
    if (!msg) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '2rem', maxWidth: '440px', width: '90%', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
                <p style={{ color: '#e2e8f0', lineHeight: '1.6', marginBottom: '1.5rem' }}>{msg}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button onClick={onCancel} style={{ padding: '0.5rem 1.2rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                    <button onClick={onConfirm} style={{ padding: '0.5rem 1.2rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Confirm</button>
                </div>
            </div>
        </div>
    );
}

// ─── Process Strategy Picker ──────────────────────────────────────────────────
function StrategyPicker({ fileId, defaultStrategies = ['recursive'], onRun, onCancel }) {
    if (!fileId) return null;
    const [selected, setSelected] = useState(defaultStrategies);
    const toggle = (s) => setSelected(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', padding: '2rem', maxWidth: '480px', width: '92%', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
                <h3 style={{ color: '#f8fafc', margin: '0 0 0.5rem' }}>Select Chunking Strategies</h3>
                <p style={{ color: '#94a3b8', margin: '0 0 1.5rem', fontSize: '0.85rem' }}>Choose which strategies to run. Each produces an independent set of chunks.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {STRATEGIES.map(s => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem', borderRadius: '10px', border: `1.5px solid ${selected.includes(s) ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.08)'}`, background: selected.includes(s) ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <span style={{ fontSize: '1.3rem' }}>{STRATEGY_ICONS[s]}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: '#f8fafc', fontWeight: '600', textTransform: 'capitalize' }}>{s}</div>
                            </div>
                            <div style={{ width: '20px', height: '20px', borderRadius: '5px', border: `2px solid ${selected.includes(s) ? '#3b82f6' : 'rgba(255,255,255,0.2)'}`, background: selected.includes(s) ? '#2563eb' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                                onClick={() => toggle(s)}>
                                {selected.includes(s) ? '✓' : ''}
                            </div>
                        </label>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button onClick={onCancel} style={{ padding: '0.6rem 1.2rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                    <button
                        onClick={() => selected.length > 0 && onRun(selected)}
                        disabled={selected.length === 0}
                        style={{ padding: '0.6rem 1.4rem', background: selected.length > 0 ? 'linear-gradient(135deg,#2563eb,#4f46e5)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', cursor: selected.length > 0 ? 'pointer' : 'not-allowed', fontWeight: '700' }}>
                        Run ({selected.length})
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Strategy Badges for Maps (Files) ───
function StrategyBadges({ stats = {} }) {
    if (!stats || Object.keys(stats).length === 0) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '0.5rem' }}>
            {Object.entries(stats).map(([strategy, count]) => (
                <span key={strategy} style={{ ...styles.badge, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
                    {STRATEGY_ICONS[strategy] || '📦'} {strategy} · {count}
                </span>
            ))}
        </div>
    );
}

// ─── Strategy Badges for Lists (Topics) ───
function StrategyListBadges({ strategies = [] }) {
    if (!strategies || strategies.length === 0) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '0.25rem' }}>
            {strategies.map(s => (
                <span key={s} style={{ ...styles.badge, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#d8b4fe' }}>
                    {STRATEGY_ICONS[s] || '📦'} {s}
                </span>
            ))}
        </div>
    );
}

// ─── Child Component: Topic Files View ─────────────────────────────────────────
function TopicFilesView({ topic, credentials, onBack }) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeOp, setActiveOp] = useState(null);
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [isChunksModalOpen, setIsChunksModalOpen] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [strategyPicker, setStrategyPicker] = useState(null);

    const { toasts, add: addToast, remove: removeToast } = useToast();

    const isBusy = () => activeOp !== null;
    const isThisBusy = (id, type) => activeOp?.id === id && activeOp?.type === type;

    useEffect(() => {
        if (files.some(f => f.status === 'processing')) {
            const timer = setInterval(loadFiles, 4000);
            return () => clearInterval(timer);
        }
    }, [files]);

    const loadFiles = useCallback(async () => {
        try {
            setLoading(true);
            setFiles(await getTopicFiles(topic.id, credentials));
            setError('');
        } catch (err) {
            setError(`Failed to load files: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [topic.id, credentials]);

    useEffect(() => { loadFiles(); }, [loadFiles]);

    const handleProcess = async (fileId, strategies) => {
        setStrategyPicker(null);
        if (isBusy()) return;
        setActiveOp({ id: fileId, type: 'process' });
        try {
            await processFile(fileId, credentials, strategies);
            addToast(`⏳ Processing started with strategies: ${strategies.join(', ')}`, 'info', 4000);
            loadFiles();
        } catch (err) {
            addToast(`Processing failed: ${err.message}`, 'error', 8000);
        } finally {
            setActiveOp(null);
        }
    };

    const handleDelete = (fileId, title) => {
        if (isBusy()) return;
        setConfirmDialog({
            msg: `Delete "${title}"? This removes the paper and its chunks.`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setActiveOp({ id: fileId, type: 'delete' });
                try {
                    const res = await deleteFile(fileId, credentials);
                    addToast(`Deleted "${title}" — ${res.chunks_deleted} chunks removed.`, 'success');
                    loadFiles();
                } catch (err) {
                    addToast(`Delete failed: ${err.message}`, 'error');
                } finally {
                    setActiveOp(null);
                }
            }
        });
    };

    const handleReset = (fileId, title) => {
        if (isBusy()) return;
        setConfirmDialog({
            msg: `Reset all chunks for "${title}"?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setActiveOp({ id: fileId, type: 'reset' });
                try {
                    const res = await deleteChunks(fileId, credentials);
                    addToast(`Reset complete. ${res.chunks_deleted} chunks cleared.`, 'success');
                    loadFiles();
                } catch (err) {
                    addToast(`Reset failed: ${err.message}`, 'error');
                } finally {
                    setActiveOp(null);
                }
            }
        });
    };

    if (loading && files.length === 0) return <p style={{ color: '#94a3b8' }}>Loading documents in topic...</p>;
    if (error) return <p style={{ color: '#fca5a5' }}>{error}</p>;

    return (
        <div className="fade-slide-up">
            <Toasts toasts={toasts} remove={removeToast} />
            {confirmDialog && <Confirm msg={confirmDialog.msg} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
            {strategyPicker && (
                <StrategyPicker
                    fileId={strategyPicker.fileId}
                    defaultStrategies={strategyPicker.existing || ['recursive']}
                    onRun={strategies => handleProcess(strategyPicker.fileId, strategies)}
                    onCancel={() => setStrategyPicker(null)}
                />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button onClick={onBack} style={styles.backBtn}>← Back to Topics</button>
                <h3 style={{ color: '#f8fafc', margin: 0 }}>Documents in: <span style={{ color: '#60a5fa' }}>{topic.name}</span></h3>
            </div>

            {files.length === 0 ? (
                <div style={styles.emptyState}>No documents in this topic yet.</div>
            ) : (
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.theadRow}>
                                <th style={styles.th}>Title</th>
                                <th style={styles.th}>Filename &amp; Stats</th>
                                <th style={styles.th}>Uploaded</th>
                                <th style={styles.th}>Status</th>
                                <th style={styles.th}>Chunks</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map(f => {
                                const busy = isBusy();
                                const isProcessing = f.status === 'processing';
                                return (
                                    <tr key={f._id} style={styles.tr}>
                                        <td style={{ ...styles.td, fontWeight: '600', color: '#f8fafc' }}>{f.title}</td>
                                        <td style={{ ...styles.td, fontSize: '0.85rem', color: '#94a3b8' }}>
                                            <div>{f.filename}</div>
                                            <StrategyBadges stats={f.strategy_stats} />
                                        </td>
                                        <td style={styles.td}>{new Date(f.uploaded_at).toLocaleDateString()}</td>
                                        <td style={styles.td}>
                                            <span style={{ ...styles.statusBadge, ...getStatusColor(f.status) }}>
                                                {isProcessing ? '⏳ processing…' : f.status}
                                            </span>
                                        </td>
                                        <td style={styles.td}>{f.chunks_count || 0}</td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                {(f.status === 'chunked' || f.status === 'embedded') && (
                                                    <button onClick={() => { setSelectedPaper(f); setIsChunksModalOpen(true); }} disabled={busy} style={{ ...s.btnView, opacity: busy ? 0.5 : 1 }}>Chunks</button>
                                                )}
                                                {(f.status === 'uploaded' || f.status === 'error') ? (
                                                    <button disabled={busy} onClick={() => setStrategyPicker({ fileId: f._id })} style={{ ...s.btnProcess, opacity: busy ? 0.5 : 1 }}>Process</button>
                                                ) : !isProcessing && (
                                                    <>
                                                        <button disabled={busy} onClick={() => setStrategyPicker({ fileId: f._id, existing: f.active_strategies })} style={{ ...s.btnRemake, opacity: busy ? 0.5 : 1 }}>Rebuild</button>
                                                        <button disabled={busy} onClick={() => handleReset(f._id, f.title)} style={{ ...s.btnReset, opacity: busy ? 0.5 : 1 }}>Reset</button>
                                                    </>
                                                )}
                                                {!isProcessing && (
                                                    <button disabled={busy} onClick={() => handleDelete(f._id, f.title)} style={{ ...s.btnDelete, opacity: busy ? 0.5 : 1 }}>Delete</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <ChunksModal isOpen={isChunksModalOpen} onClose={() => setIsChunksModalOpen(false)} paper={selectedPaper} credentials={credentials} />
        </div>
    );
}

// ─── Main Component: Topics List ───────────────────────────────────────────────
export default function PapersList({ credentials, refreshTrigger }) {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTopic, setSelectedTopic] = useState(null); // stores the topic object
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [isBusy, setIsBusy] = useState(false);

    const { toasts, add: addToast, remove: removeToast } = useToast();

    const loadTopics = useCallback(async () => {
        try {
            setLoading(true);
            setTopics(await getTopics(credentials));
            setError('');
        } catch (err) {
            setError(`Failed to load topics: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [credentials]);

    useEffect(() => { loadTopics(); }, [loadTopics, refreshTrigger]);

    const handleDeleteTopic = (topic) => {
        setConfirmDialog({
            msg: `Delete Research Topic "${topic.name}"? This removes the topic and ALL its documents and chunks permanently.`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setIsBusy(true);
                try {
                    const res = await deleteTopic(topic.id, credentials);
                    addToast(`Topic deleted! Removed ${res.documents_deleted} docs and ${res.chunks_deleted} chunks.`, 'success');
                    if (selectedTopic?.id === topic.id) setSelectedTopic(null);
                    loadTopics();
                } catch (err) {
                    addToast(`Delete topic failed: ${err.message}`, 'error');
                } finally {
                    setIsBusy(false);
                }
            }
        });
    };

    if (loading && topics.length === 0) return <p style={{ color: '#94a3b8' }}>Loading research topics…</p>;
    if (error) return <p style={{ color: '#fca5a5' }}>{error}</p>;

    return (
        <div style={{ marginTop: '3rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
            <Toasts toasts={toasts} remove={removeToast} />
            {confirmDialog && <Confirm msg={confirmDialog.msg} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}

            {selectedTopic ? (
                <TopicFilesView topic={selectedTopic} credentials={credentials} onBack={() => setSelectedTopic(null)} />
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ color: '#f8fafc', margin: 0 }}>Research Topics ({topics.length})</h3>
                    </div>

                    {topics.length === 0 ? (
                        <div style={styles.emptyState}>No topics or papers uploaded yet.</div>
                    ) : (
                        <div style={styles.tableWrapper}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={styles.theadRow}>
                                        <th style={styles.th}>Topic Name</th>
                                        <th style={styles.th}>Documents</th>
                                        <th style={styles.th}>Total Chunks</th>
                                        <th style={styles.th}>Active Strategies</th>
                                        <th style={styles.th}>Overall Status</th>
                                        <th style={styles.th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topics.map(t => (
                                        <tr key={t.id} style={styles.tr}>
                                            <td style={{ ...styles.td, fontWeight: '700', color: '#60a5fa', fontSize: '1rem' }}>
                                                📁 {t.name}
                                            </td>
                                            <td style={{ ...styles.td, fontWeight: '600' }}>{t.documents_count}</td>
                                            <td style={styles.td}>{t.chunks_count}</td>
                                            <td style={styles.td}>
                                                <StrategyListBadges strategies={t.active_strategies} />
                                            </td>
                                            <td style={styles.td}>
                                                <span style={{ ...styles.statusBadge, ...getStatusColor(t.status) }}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <button
                                                        onClick={() => setSelectedTopic(t)}
                                                        style={{ ...s.btnView, padding: '0.4rem 0.8rem', fontWeight: 'bold' }}>
                                                        View
                                                    </button>
                                                    <button
                                                        disabled={isBusy}
                                                        onClick={() => handleDeleteTopic(t)}
                                                        style={{ ...s.btnDelete, padding: '0.4rem 0.8rem' }}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

const getStatusColor = (status) => ({
    uploaded: { backgroundColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' },
    processing: { backgroundColor: 'rgba(234,179,8,0.2)', color: '#facc15' },
    chunked: { backgroundColor: 'rgba(34,197,94,0.2)', color: '#4ade80' },
    embedded: { backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa' },
    error: { backgroundColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' },
}[status] || { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white' });

const toastBase = { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1.2rem', borderRadius: '12px', fontSize: '0.9rem', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 10000 };
const toastSuccess = { background: 'rgba(20,83,45,0.95)', border: '1px solid rgba(74,222,128,0.4)', color: '#bbf7d0' };
const toastError = { background: 'rgba(127,29,29,0.95)', border: '1px solid rgba(252,165,165,0.4)', color: '#fecaca' };
const toastInfo = { background: 'rgba(30,41,59,0.95)', border: '1px solid rgba(148,163,184,0.3)', color: '#e2e8f0' };

const styles = {
    tableWrapper: { overflowX: 'auto', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.85)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' },
    table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 },
    theadRow: { background: 'rgba(30,41,59,0.95)', textAlign: 'left' },
    th: { padding: '1rem', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    tr: { transition: 'background 0.2s' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1', fontSize: '0.9rem' },
    statusBadge: { padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'capitalize' },
    emptyState: { textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', color: '#94a3b8' },
    backBtn: { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', padding: '0.5rem 0.75rem', borderRadius: '6px', ':hover': { background: 'rgba(255,255,255,0.05)' } },
    badge: { padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', width: 'fit-content' }
};
const s = {
    btnView: { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' },
    btnProcess: { background: '#2563eb', color: 'white', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' },
    btnRemake: { background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' },
    btnReset: { background: 'rgba(249,115,22,0.2)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' },
    btnDelete: { background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' },
};
