import { useState, useEffect, useCallback } from 'react';
import { getFiles, deleteFile, processFile, deleteChunks } from '../api';
import ChunksModal from './ChunksModal';

// ─── Toast Notification System ───────────────────────────────────────────────
function Toast({ toasts, removeToast }) {
    return (
        <div style={toastStyles.container}>
            {toasts.map(t => (
                <div key={t.id} style={{ ...toastStyles.toast, ...toastStyles[t.type] }}>
                    <span style={toastStyles.icon}>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
                    <span style={toastStyles.msg}>{t.message}</span>
                    <button onClick={() => removeToast(t.id)} style={toastStyles.close}>×</button>
                </div>
            ))}
        </div>
    );
}

let _toastId = 0;

function useToast() {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((message, type = 'info', duration = 4500) => {
        const id = ++_toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }, []);
    const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);
    return { toasts, addToast, removeToast };
}

// ─── Confirm Dialog (inline, replaces window.confirm) ────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
    return (
        <div style={confirmStyles.overlay}>
            <div style={confirmStyles.box}>
                <p style={confirmStyles.msg}>{message}</p>
                <div style={confirmStyles.actions}>
                    <button onClick={onCancel} style={confirmStyles.cancelBtn}>Cancel</button>
                    <button onClick={onConfirm} style={confirmStyles.confirmBtn}>Confirm</button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PapersList({ credentials, refreshTrigger }) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // Track WHICH file is being acted on, and WHAT action is running
    const [activeOp, setActiveOp] = useState(null); // { id, type: 'process'|'delete'|'reset' }
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [isChunksModalOpen, setIsChunksModalOpen] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
    const { toasts, addToast, removeToast } = useToast();

    const isBusy = (fileId) => activeOp?.id === fileId;
    const isAnyBusy = () => activeOp !== null;

    const loadFiles = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getFiles(credentials);
            setFiles(data);
            setError('');
        } catch (err) {
            console.error(err);
            if (err.code === 'ERR_NETWORK') {
                setError('Backend unreachable — is the server running?');
            } else {
                setError(`Server error: ${err.response?.data?.detail || err.message}`);
            }
        } finally {
            setLoading(false);
        }
    }, [credentials]);

    useEffect(() => { loadFiles(); }, [loadFiles, refreshTrigger]);

    // ── Actions ──────────────────────────────────────────────────────────────

    const handleProcess = async (fileId, label = 'Process') => {
        if (isAnyBusy()) return;
        setActiveOp({ id: fileId, type: 'process' });
        try {
            const res = await processFile(fileId, credentials);
            addToast(
                `✨ ${label} complete — ${res.chunks_created} chunks across ${res.pages_extracted} pages`,
                'success',
                6000
            );
            loadFiles();
        } catch (err) {
            const detail = err.response?.data?.detail || err.message || 'Unknown error';
            addToast(`Processing failed: ${detail}`, 'error', 8000);
        } finally {
            setActiveOp(null);
        }
    };

    const handleDelete = (fileId, title) => {
        if (isAnyBusy()) return;
        setConfirmDialog({
            message: `Delete "${title}"? This will permanently remove the paper and all its chunks.`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setActiveOp({ id: fileId, type: 'delete' });
                try {
                    await deleteFile(fileId, credentials);
                    addToast('Paper deleted successfully.', 'success');
                    loadFiles();
                } catch (err) {
                    addToast(`Delete failed: ${err.response?.data?.detail || err.message}`, 'error');
                } finally {
                    setActiveOp(null);
                }
            }
        });
    };

    const handleReset = (fileId, title) => {
        if (isAnyBusy()) return;
        setConfirmDialog({
            message: `Reset chunks for "${title}"? Embeddings will be cleared and the status set back to "uploaded".`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setActiveOp({ id: fileId, type: 'reset' });
                try {
                    await deleteChunks(fileId, credentials);
                    addToast('Chunks and embeddings cleared. You can now re-process.', 'success');
                    loadFiles();
                } catch (err) {
                    addToast(`Reset failed: ${err.response?.data?.detail || err.message}`, 'error');
                } finally {
                    setActiveOp(null);
                }
            }
        });
    };

    const handleViewChunks = (paper) => {
        setSelectedPaper(paper);
        setIsChunksModalOpen(true);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading && files.length === 0) return <p style={{ color: '#94a3b8' }}>Loading papers...</p>;
    if (error) return <p style={{ color: '#fca5a5' }}>{error}</p>;

    return (
        <div style={{ marginTop: '3rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '2rem' }}>
            <Toast toasts={toasts} removeToast={removeToast} />
            {confirmDialog && (
                <ConfirmDialog
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#f8fafc', margin: 0 }}>Uploaded Papers Library ({files.length})</h3>
            </div>

            {files.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <p style={{ color: '#94a3b8' }}>No papers uploaded yet. Use the upload button to start.</p>
                </div>
            ) : (
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.theadRow}>
                                <th style={styles.th}>Title</th>
                                <th style={styles.th}>Filename / Models</th>
                                <th style={styles.th}>Uploaded</th>
                                <th style={styles.th}>Status</th>
                                <th style={styles.th}>Chunks</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map(f => {
                                const busy = isBusy(f._id);
                                const opType = activeOp?.id === f._id ? activeOp.type : null;
                                return (
                                    <tr key={f._id} style={styles.tr}>
                                        <td style={{ ...styles.td, fontWeight: '600', color: '#f8fafc' }}>
                                            {f.title || 'Untitled Paper'}
                                        </td>
                                        <td style={{ ...styles.td, fontSize: '0.85rem', color: '#94a3b8' }}>
                                            <div style={{ marginBottom: '0.4rem' }}>{f.filename}</div>
                                            {f.chunking_model && (
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span title="Chunking Model">🔨</span> {f.chunking_model}
                                                </div>
                                            )}
                                            {f.embedding_model && (
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                    <span title="Embedding Model">🧠</span> {f.embedding_model}
                                                </div>
                                            )}
                                            {f.status === 'error' && f.error_msg && (
                                                <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px', borderLeft: '2px solid #ef4444' }}>
                                                    <strong>Error:</strong> {f.error_msg}
                                                </div>
                                            )}
                                        </td>
                                        <td style={styles.td}>{new Date(f.uploaded_at).toLocaleDateString()}</td>
                                        <td style={styles.td}>
                                            <span style={{
                                                ...styles.statusBadge,
                                                backgroundColor: getStatusColor(f.status).bg,
                                                color: getStatusColor(f.status).text,
                                                ...(busy && opType === 'process' ? { animation: 'pulse 1.5s infinite' } : {})
                                            }}>
                                                {busy && opType === 'process' ? '⏳ processing…' : f.status}
                                            </span>
                                        </td>
                                        <td style={styles.td}>{f.chunks_count || 0}</td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {(f.status === 'chunked' || f.status === 'embedded') && (
                                                    <button
                                                        onClick={() => handleViewChunks(f)}
                                                        disabled={isAnyBusy()}
                                                        style={{ ...styles.btnView, opacity: isAnyBusy() ? 0.5 : 1 }}
                                                    >
                                                        View
                                                    </button>
                                                )}

                                                {f.status === 'uploaded' || f.status === 'error' ? (
                                                    <button
                                                        onClick={() => handleProcess(f._id, 'Processing')}
                                                        disabled={isAnyBusy()}
                                                        style={{ ...styles.btnProcess, opacity: isAnyBusy() ? 0.5 : 1, cursor: isAnyBusy() ? 'not-allowed' : 'pointer' }}
                                                    >
                                                        {busy && opType === 'process' ? '⏳ Processing…' : 'Process'}
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleProcess(f._id, 'Rebuild')}
                                                            disabled={isAnyBusy()}
                                                            style={{ ...styles.btnRemake, opacity: isAnyBusy() ? 0.5 : 1, cursor: isAnyBusy() ? 'not-allowed' : 'pointer' }}
                                                        >
                                                            {busy && opType === 'process' ? '⏳ Rebuilding…' : 'Rebuild'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleReset(f._id, f.title)}
                                                            disabled={isAnyBusy()}
                                                            style={{ ...styles.btnReset, opacity: isAnyBusy() ? 0.5 : 1, cursor: isAnyBusy() ? 'not-allowed' : 'pointer' }}
                                                        >
                                                            {busy && opType === 'reset' ? '⏳ Resetting…' : 'Reset'}
                                                        </button>
                                                    </>
                                                )}

                                                <button
                                                    onClick={() => handleDelete(f._id, f.title)}
                                                    disabled={isAnyBusy()}
                                                    style={{ ...styles.btnDelete, opacity: isAnyBusy() ? 0.5 : 1, cursor: isAnyBusy() ? 'not-allowed' : 'pointer' }}
                                                >
                                                    {busy && opType === 'delete' ? '⏳ Deleting…' : 'Delete'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <ChunksModal
                isOpen={isChunksModalOpen}
                onClose={() => setIsChunksModalOpen(false)}
                paper={selectedPaper}
                credentials={credentials}
            />
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStatusColor = (status) => {
    switch (status) {
        case 'uploaded': return { bg: 'rgba(51, 65, 85, 0.5)', text: '#cbd5e1' };
        case 'processing': return { bg: 'rgba(234, 179, 8, 0.2)', text: '#facc15' };
        case 'chunked': return { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80' };
        case 'embedded': return { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' };
        case 'error': return { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5' };
        default: return { bg: 'rgba(255,255,255,0.05)', text: 'white' };
    }
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
    tableWrapper: {
        overflowX: 'auto',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        background: 'rgba(15, 23, 42, 0.85)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
    },
    table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 },
    theadRow: { background: 'rgba(30, 41, 59, 0.95)', textAlign: 'left' },
    th: {
        padding: '1rem',
        color: '#94a3b8',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    },
    tr: { transition: 'background 0.2s' },
    td: {
        padding: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        color: '#cbd5e1',
        fontSize: '0.9rem',
    },
    statusBadge: {
        padding: '0.25rem 0.75rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        textTransform: 'capitalize',
    },
    btnView: { background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', transition: 'opacity 0.2s' },
    btnProcess: { background: '#2563eb', color: 'white', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', transition: 'opacity 0.2s' },
    btnRemake: { background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', transition: 'opacity 0.2s' },
    btnReset: { background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', transition: 'opacity 0.2s' },
    btnDelete: { background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', transition: 'opacity 0.2s' },
};

const toastStyles = {
    container: {
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        zIndex: 9999,
        maxWidth: '420px',
    },
    toast: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.9rem 1.2rem',
        borderRadius: '12px',
        fontSize: '0.9rem',
        backdropFilter: 'blur(12px)',
        animation: 'slideInRight 0.3s ease',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    },
    success: { background: 'rgba(20, 83, 45, 0.95)', border: '1px solid rgba(74, 222, 128, 0.4)', color: '#bbf7d0' },
    error: { background: 'rgba(127, 29, 29, 0.95)', border: '1px solid rgba(252, 165, 165, 0.4)', color: '#fecaca' },
    info: { background: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(148, 163, 184, 0.3)', color: '#e2e8f0' },
    icon: { fontSize: '1.1rem', flexShrink: 0 },
    msg: { flex: 1, lineHeight: '1.4' },
    close: { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.6, padding: 0, lineHeight: 1 },
};

const confirmStyles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 3000, backdropFilter: 'blur(4px)',
    },
    box: {
        background: 'rgba(30, 41, 59, 0.98)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '16px',
        padding: '2rem',
        maxWidth: '440px',
        width: '90%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
    },
    msg: { color: '#e2e8f0', lineHeight: '1.6', marginBottom: '1.5rem', fontSize: '0.95rem' },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' },
    cancelBtn: { padding: '0.5rem 1.2rem', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
    confirmBtn: { padding: '0.5rem 1.2rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
};
