import { useState, useEffect } from 'react';
import { getConfig, updateConfig } from '../api';

const STRATEGY_INFO = {
    recursive: {
        label: 'Recursive',
        icon: '🔀',
        desc: 'Splits on paragraph → sentence → word. Best general-purpose strategy.',
    },
    sentence: {
        label: 'Sentence',
        icon: '📝',
        desc: 'Merges sentences into ~800-char groups. Preserves natural language flow.',
    },
    paragraph: {
        label: 'Paragraph',
        icon: '📄',
        desc: 'Splits on double-newlines. Great for structured academic papers.',
    },
    semantic: {
        label: 'Semantic',
        icon: '🧠',
        desc: 'Detects topic shifts via sentence embedding cosine similarity. Most intelligent strategy.',
    },
};

export default function Settings({ credentials }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const data = await getConfig(credentials);
                setConfig(data);
            } catch (err) {
                showToast('Failed to load config: ' + (err.response?.data?.detail || err.message), 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [credentials]);

    const toggleStrategy = (strategy) => {
        setConfig(prev => {
            const current = prev.chunking.active_strategies || [];
            const next = current.includes(strategy)
                ? current.filter(s => s !== strategy)
                : [...current, strategy];
            return { ...prev, chunking: { ...prev.chunking, active_strategies: next } };
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const strategies = config.chunking.active_strategies || [];
        if (strategies.length === 0) {
            showToast('Select at least one chunking strategy.', 'error');
            return;
        }
        setSaving(true);
        try {
            await updateConfig({
                active_strategies: strategies,
                embedding: config.embedding?.active,
                evaluation: config.evaluation?.active,
            }, credentials);
            showToast('Settings saved! New uploads will use these strategies.');
        } catch (err) {
            showToast('Save failed: ' + (err.response?.data?.detail || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div style={styles.centered}>
            <div style={styles.spinner}>⏳</div>
            <p style={{ color: '#94a3b8' }}>Loading settings…</p>
        </div>
    );

    if (!config) return (
        <div style={styles.centered}>
            <p style={{ color: '#fca5a5' }}>Could not load configuration.</p>
        </div>
    );

    const activeStrategies = config.chunking?.active_strategies || [];

    return (
        <div style={styles.page}>
            {/* Toast */}
            {toast && (
                <div style={{ ...styles.toast, ...(toast.type === 'error' ? styles.toastError : styles.toastSuccess) }}>
                    {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
                </div>
            )}

            <div style={styles.header}>
                <h2 style={styles.title}>⚙️ Pipeline Settings</h2>
                <p style={styles.subtitle}>
                    Control which strategies run automatically when a paper is uploaded.
                </p>
            </div>

            <form onSubmit={handleSave} style={styles.form}>

                {/* ── Chunking Strategies (multi-select checkboxes) ── */}
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h3 style={styles.cardTitle}>🔀 Chunking Strategies</h3>
                        <p style={styles.cardSubtitle}>
                            Select one or more. All checked strategies will run in parallel on every upload.
                        </p>
                    </div>
                    <div style={styles.strategyGrid}>
                        {Object.entries(STRATEGY_INFO).map(([key, info]) => {
                            const isActive = activeStrategies.includes(key);
                            return (
                                <label
                                    key={key}
                                    style={{
                                        ...styles.strategyCard,
                                        ...(isActive ? styles.strategyCardActive : {}),
                                    }}
                                    onClick={() => toggleStrategy(key)}
                                >
                                    <div style={styles.strategyTop}>
                                        <div style={styles.strategyIcon}>{info.icon}</div>
                                        <div style={{
                                            ...styles.checkbox,
                                            ...(isActive ? styles.checkboxActive : {}),
                                        }}>
                                            {isActive && '✓'}
                                        </div>
                                    </div>
                                    <div style={styles.strategyLabel}>{info.label}</div>
                                    <div style={styles.strategyDesc}>{info.desc}</div>
                                </label>
                            );
                        })}
                    </div>
                    {activeStrategies.length === 0 && (
                        <p style={styles.warning}>⚠️ No strategy selected — select at least one.</p>
                    )}
                </div>

                {/* ── Embedding Model ── */}
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h3 style={styles.cardTitle}>🧠 Embedding Model</h3>
                    </div>
                    <select
                        value={config.embedding?.active || ''}
                        onChange={e => setConfig(p => ({ ...p, embedding: { ...p.embedding, active: e.target.value } }))}
                        style={styles.select}
                    >
                        {(config.embedding?.options || []).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                    <p style={styles.fieldNote}>Used to generate vector embeddings for semantic search.</p>
                </div>

                {/* ── Evaluation ── */}
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h3 style={styles.cardTitle}>📊 Evaluation Framework</h3>
                    </div>
                    <select
                        value={config.evaluation?.active || ''}
                        onChange={e => setConfig(p => ({ ...p, evaluation: { ...p.evaluation, active: e.target.value } }))}
                        style={styles.select}
                    >
                        {(config.evaluation?.options || []).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                    <p style={styles.fieldNote}>Metric framework for measuring RAG answer quality.</p>
                </div>

                <button
                    type="submit"
                    disabled={saving || activeStrategies.length === 0}
                    style={{
                        ...styles.saveBtn,
                        opacity: (saving || activeStrategies.length === 0) ? 0.5 : 1,
                        cursor: (saving || activeStrategies.length === 0) ? 'not-allowed' : 'pointer',
                    }}
                >
                    {saving ? '⏳ Saving…' : '💾 Save Settings'}
                </button>
            </form>
        </div>
    );
}

const styles = {
    page: {
        maxWidth: '720px',
        margin: '0 auto',
        padding: '2rem 1rem',
        position: 'relative',
    },
    centered: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '4rem', gap: '1rem',
    },
    spinner: { fontSize: '2rem' },
    header: { marginBottom: '2rem' },
    title: { color: '#f8fafc', margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: '700' },
    subtitle: { color: '#94a3b8', margin: 0, fontSize: '0.95rem' },
    form: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
    card: {
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '1.5rem',
        backdropFilter: 'blur(8px)',
    },
    cardHeader: { marginBottom: '1.25rem' },
    cardTitle: { color: '#f8fafc', margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: '700' },
    cardSubtitle: { color: '#94a3b8', margin: 0, fontSize: '0.85rem' },
    strategyGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' },
    strategyCard: {
        background: 'rgba(255,255,255,0.03)',
        border: '1.5px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '1.1rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        userSelect: 'none',
    },
    strategyCardActive: {
        background: 'rgba(37, 99, 235, 0.15)',
        border: '1.5px solid rgba(59, 130, 246, 0.6)',
        boxShadow: '0 0 16px rgba(59, 130, 246, 0.15)',
    },
    strategyTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' },
    strategyIcon: { fontSize: '1.4rem' },
    checkbox: {
        width: '20px', height: '20px',
        border: '2px solid rgba(255,255,255,0.2)',
        borderRadius: '5px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.8rem', fontWeight: 'bold', color: 'white',
        flexShrink: 0,
    },
    checkboxActive: {
        background: '#2563eb',
        border: '2px solid #3b82f6',
    },
    strategyLabel: { color: '#f8fafc', fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.4rem' },
    strategyDesc: { color: '#64748b', fontSize: '0.78rem', lineHeight: '1.4' },
    warning: { color: '#fbbf24', marginTop: '1rem', fontSize: '0.85rem', margin: '1rem 0 0' },
    select: {
        width: '100%', padding: '0.65rem 1rem',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px', color: '#f8fafc',
        fontSize: '0.9rem', cursor: 'pointer',
    },
    fieldNote: { color: '#64748b', fontSize: '0.8rem', margin: '0.5rem 0 0' },
    saveBtn: {
        padding: '0.8rem 2rem',
        background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
        color: 'white', border: 'none', borderRadius: '10px',
        fontWeight: '700', fontSize: '1rem',
        alignSelf: 'flex-start', transition: 'opacity 0.2s',
    },
    toast: {
        position: 'fixed', bottom: '1.5rem', right: '1.5rem',
        padding: '0.9rem 1.4rem', borderRadius: '12px',
        fontSize: '0.9rem', zIndex: 9999,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: '400px',
        animation: 'slideInRight 0.3s ease',
    },
    toastSuccess: {
        background: 'rgba(20, 83, 45, 0.95)',
        border: '1px solid rgba(74, 222, 128, 0.4)',
        color: '#bbf7d0',
    },
    toastError: {
        background: 'rgba(127, 29, 29, 0.95)',
        border: '1px solid rgba(252, 165, 165, 0.4)',
        color: '#fecaca',
    },
};
