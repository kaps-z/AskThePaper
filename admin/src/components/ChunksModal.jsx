import { useState, useEffect } from 'react';
import { getChunks } from '../api';

export default function ChunksModal({ isOpen, onClose, paper, credentials }) {
    const [chunks, setChunks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && paper) {
            const fetchChunks = async () => {
                try {
                    setLoading(true);
                    const data = await getChunks(paper._id, credentials);
                    setChunks(data);
                } catch (err) {
                    console.error(err);
                    setError('Failed to load chunks.');
                } finally {
                    setLoading(false);
                }
            };
            fetchChunks();
        }
    }, [isOpen, paper, credentials]);

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <div style={styles.headerTitle}>
                        <h3 style={{ margin: 0 }}>Chunks for "{paper.title || paper.filename}"</h3>
                        <p style={styles.subtitle}>{chunks.length} chunks generated</p>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}>&times;</button>
                </div>

                <div style={styles.content}>
                    {loading ? (
                        <div style={styles.loading}>Loading chunks...</div>
                    ) : error ? (
                        <div style={styles.error}>{error}</div>
                    ) : chunks.length === 0 ? (
                        <div style={styles.empty}>No chunks found. Process the file first.</div>
                    ) : (
                        chunks.map((chunk, index) => (
                            <div key={chunk._id || index} style={styles.chunkCard}>
                                <div style={styles.chunkMeta}>
                                    <span style={styles.chunkBadge}>Page {chunk.metadata.page}</span>
                                    <span style={styles.chunkIndex}># {chunk.metadata.chunk_index}</span>
                                </div>
                                <div style={styles.chunkText}>
                                    {chunk.content}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div style={styles.footer}>
                    <button onClick={onClose} style={styles.button}>Close</button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(4px)',
    },
    modal: {
        background: 'rgba(30, 41, 59, 0.98)',
        color: '#f8fafc',
        width: '800px',
        maxWidth: '90%',
        maxHeight: '85vh',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        overflow: 'hidden',
        backdropFilter: 'blur(16px)',
    },
    header: {
        padding: '1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    headerTitle: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
    },
    subtitle: {
        margin: 0,
        fontSize: '0.85rem',
        color: '#94a3b8',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        fontSize: '1.8rem',
        cursor: 'pointer',
        color: '#94a3b8',
        padding: '0 0.5rem',
    },
    content: {
        padding: '1.5rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        backgroundColor: '#0f172a',
    },
    chunkCard: {
        padding: '1rem',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        lineHeight: '1.6',
    },
    chunkMeta: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    chunkBadge: {
        backgroundColor: '#1e40af',
        color: '#bfdbfe',
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
    },
    chunkIndex: {
        color: '#64748b',
    },
    chunkText: {
        fontSize: '0.95rem',
        color: '#cbd5e1',
        whiteSpace: 'pre-wrap',
    },
    loading: {
        textAlign: 'center',
        padding: '3rem',
        color: '#94a3b8',
    },
    error: {
        textAlign: 'center',
        padding: '3rem',
        color: '#fca5a5',
    },
    empty: {
        textAlign: 'center',
        padding: '3rem',
        color: '#94a3b8',
    },
    footer: {
        padding: '1rem 1.5rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    button: {
        padding: '0.5rem 1.5rem',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'background 0.2s',
    }
};
