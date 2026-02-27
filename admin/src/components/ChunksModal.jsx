import { useState, useEffect, useCallback } from 'react';
import { getChunks } from '../api';

// ─── Strategy metadata (kept in sync with backend AVAILABLE_STRATEGIES) ───────
export const STRATEGY_INFO = {
    recursive: { icon: '🔀', label: 'Recursive', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
    sentence: { icon: '📝', label: 'Sentence', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.4)' },
    paragraph: { icon: '📄', label: 'Paragraph', color: '#34d399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.4)' },
    semantic: { icon: '🧠', label: 'Semantic', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' },
};
export const ALL_STRATEGIES = Object.keys(STRATEGY_INFO);

// ─── Modes: 'single' or 'compare' ─────────────────────────────────────────────
const MODES = ['Single View', 'Compare (2)', 'Compare (3)'];

export default function ChunksModal({ isOpen, onClose, paper, credentials }) {
    const [mode, setMode] = useState('Single View');
    const [primaryStrategy, setPrimary] = useState(null);
    const [compareStrategies, setCompare] = useState([]);

    // Cache: strategy -> chunks[]
    const [chunkCache, setCache] = useState({});
    const [loading, setLoading] = useState({});
    const [error, setError] = useState({});

    // Reset when opening a new paper
    useEffect(() => {
        if (isOpen && paper) {
            setCache({});
            setError({});
            setLoading({});
            setMode('Single View');
            // Auto-select first available strategy
            const first = (paper.active_strategies || ALL_STRATEGIES)[0] || 'recursive';
            setPrimary(first);
            setCompare([]);
        }
    }, [isOpen, paper?._id]);

    // Fetch chunks for a strategy (cached)
    const fetchStrategy = useCallback(async (strategy) => {
        if (!paper || chunkCache[strategy] !== undefined || loading[strategy]) return;
        setLoading(p => ({ ...p, [strategy]: true }));
        try {
            const data = await getChunks(paper._id, credentials, strategy);
            setCache(p => ({ ...p, [strategy]: data }));
        } catch (err) {
            setError(p => ({ ...p, [strategy]: 'Failed to load.' }));
        } finally {
            setLoading(p => ({ ...p, [strategy]: false }));
        }
    }, [paper, credentials, chunkCache, loading]);

    // Trigger fetches when selections change
    useEffect(() => {
        if (!isOpen) return;
        if (primaryStrategy) fetchStrategy(primaryStrategy);
        compareStrategies.forEach(s => fetchStrategy(s));
    }, [isOpen, primaryStrategy, compareStrategies]);

    if (!isOpen || !paper) return null;

    const availableStrategies = paper.active_strategies?.length
        ? paper.active_strategies
        : ALL_STRATEGIES;

    const numCompare = mode === 'Compare (2)' ? 2 : mode === 'Compare (3)' ? 3 : 0;

    // Ensure compare list has the right length
    const ensureCompareLength = (len) => {
        const trimmed = compareStrategies.slice(0, len);
        while (trimmed.length < len) {
            const next = availableStrategies.find(s => !trimmed.includes(s));
            if (next) trimmed.push(next); else break;
        }
        setCompare(trimmed);
    };

    const handleModeChange = (newMode) => {
        setMode(newMode);
        if (newMode === 'Single View') {
            setCompare([]);
        } else {
            const len = newMode === 'Compare (2)' ? 2 : 3;
            ensureCompareLength(len);
        }
    };

    const setCompareAt = (idx, strategy) => {
        const next = [...compareStrategies];
        next[idx] = strategy;
        setCompare(next);
        fetchStrategy(strategy);
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div style={st.overlay}>
            <div style={{ ...st.modal, maxWidth: mode !== 'Single View' ? '95vw' : '800px', width: mode !== 'Single View' ? '95vw' : '800px' }}>

                {/* Header */}
                <div style={st.header}>
                    <div>
                        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', color: '#f8fafc' }}>
                            Chunks — "{paper.title || paper.filename}"
                        </h3>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {availableStrategies.map(s => {
                                const info = STRATEGY_INFO[s] || {};
                                const count = chunkCache[s]?.length;
                                return (
                                    <span key={s} style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', background: info.bg, border: `1px solid ${info.border}`, color: info.color }}>
                                        {info.icon} {info.label}{count !== undefined ? ` · ${count}` : ''}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                    <button onClick={onClose} style={st.closeBtn}>×</button>
                </div>

                {/* Mode Tabs */}
                <div style={st.tabs}>
                    {MODES.map(m => (
                        <button
                            key={m}
                            onClick={() => handleModeChange(m)}
                            disabled={m !== 'Single View' && availableStrategies.length < 2}
                            style={{ ...st.tab, ...(mode === m ? st.tabActive : {}), opacity: (m !== 'Single View' && availableStrategies.length < 2) ? 0.4 : 1 }}
                        >
                            {m === 'Single View' ? '📋' : m === 'Compare (2)' ? '⚖️' : '🔬'} {m}
                        </button>
                    ))}
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#475569', alignSelf: 'center' }}>
                        {availableStrategies.length} strateg{availableStrategies.length === 1 ? 'y' : 'ies'} available
                    </span>
                </div>

                {/* Content */}
                {mode === 'Single View' ? (
                    <SingleView
                        strategies={availableStrategies}
                        selected={primaryStrategy}
                        onSelect={setPrimary}
                        chunks={chunkCache[primaryStrategy]}
                        loading={loading[primaryStrategy]}
                        error={error[primaryStrategy]}
                    />
                ) : (
                    <CompareView
                        slots={numCompare}
                        strategies={availableStrategies}
                        selected={compareStrategies}
                        onSelect={setCompareAt}
                        cache={chunkCache}
                        loading={loading}
                        errors={error}
                    />
                )}

                {/* Footer */}
                <div style={st.footer}>
                    <button onClick={onClose} style={st.closeFooterBtn}>Close</button>
                </div>
            </div>
        </div>
    );
}

// ─── Single View ──────────────────────────────────────────────────────────────
function SingleView({ strategies, selected, onSelect, chunks, loading, error }) {
    const info = STRATEGY_INFO[selected] || {};
    return (
        <>
            {/* Strategy selector */}
            <div style={st.strategyBar}>
                {strategies.map(s => {
                    const si = STRATEGY_INFO[s] || {};
                    const active = s === selected;
                    return (
                        <button key={s} onClick={() => onSelect(s)} style={{
                            ...st.stratBtn,
                            background: active ? si.bg : 'rgba(255,255,255,0.03)',
                            border: `1.5px solid ${active ? si.border : 'rgba(255,255,255,0.08)'}`,
                            color: active ? si.color : '#94a3b8',
                            fontWeight: active ? '700' : '400',
                        }}>
                            {si.icon} {si.label}
                        </button>
                    );
                })}
            </div>
            <div style={{ ...st.content, flex: 1 }}>
                <ChunkList chunks={chunks} loading={loading} error={error} accentColor={info.color} />
            </div>
        </>
    );
}

// ─── Compare View ─────────────────────────────────────────────────────────────
function CompareView({ slots, strategies, selected, onSelect, cache, loading, errors }) {
    const cols = Array.from({ length: slots }, (_, i) => i);
    return (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
            {cols.map(idx => {
                const strategy = selected[idx] || strategies[idx] || strategies[0];
                const info = STRATEGY_INFO[strategy] || {};
                return (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: idx > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                        {/* Column header with strategy selector */}
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {strategies.map(s => {
                                const si = STRATEGY_INFO[s] || {};
                                const active = s === strategy;
                                return (
                                    <button key={s} onClick={() => onSelect(idx, s)} style={{
                                        ...st.stratBtn, fontSize: '0.75rem', padding: '0.2rem 0.6rem',
                                        background: active ? si.bg : 'rgba(255,255,255,0.03)',
                                        border: `1.5px solid ${active ? si.border : 'rgba(255,255,255,0.06)'}`,
                                        color: active ? si.color : '#64748b',
                                        fontWeight: active ? '700' : '400',
                                    }}>
                                        {si.icon} {si.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ ...st.content, flex: 1 }}>
                            <ChunkList
                                chunks={cache[strategy]}
                                loading={loading[strategy]}
                                error={errors[strategy]}
                                accentColor={info.color}
                                compact
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Chunk List ───────────────────────────────────────────────────────────────
function ChunkList({ chunks, loading, error, accentColor = '#3b82f6', compact = false }) {
    if (loading) return <div style={st.state}>⏳ Loading chunks…</div>;
    if (error) return <div style={{ ...st.state, color: '#fca5a5' }}>{error}</div>;
    if (!chunks) return <div style={st.state}>Select a strategy to view its chunks.</div>;
    if (chunks.length === 0) return <div style={st.state}>No chunks. Run this strategy first.</div>;

    return (
        <>
            <div style={{ padding: compact ? '0.5rem 0.75rem' : '0.5rem 1rem', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {chunks.length} chunks
            </div>
            {chunks.map((chunk, i) => (
                <div key={chunk._id || i} style={{ ...st.chunkCard, borderLeft: `3px solid ${accentColor}`, margin: compact ? '0.5rem 0.75rem' : '0.75rem 1rem' }}>
                    <div style={st.chunkMeta}>
                        <span style={{ ...st.badge, background: accentColor + '33', color: accentColor }}>
                            Pg {chunk.metadata?.page}
                        </span>
                        <span style={{ color: '#475569', fontSize: '0.7rem' }}>#{chunk.metadata?.chunk_index} · {chunk.content?.length} chars</span>
                    </div>
                    <div style={{ ...st.chunkText, fontSize: compact ? '0.8rem' : '0.9rem' }}>{chunk.content}</div>
                </div>
            ))}
        </>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(5px)' },
    modal: { background: 'rgba(15,23,42,0.99)', color: '#f8fafc', maxHeight: '90vh', borderRadius: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden', backdropFilter: 'blur(20px)' },
    header: { padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'rgba(255,255,255,0.04)', gap: '1rem' },
    closeBtn: { background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: '0', flexShrink: 0 },
    tabs: { display: 'flex', gap: '0.5rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', alignItems: 'center' },
    tab: { padding: '0.4rem 0.9rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '500', transition: 'all 0.2s' },
    tabActive: { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.5)', color: '#93c5fd', fontWeight: '700' },
    strategyBar: { display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' },
    stratBtn: { padding: '0.35rem 0.85rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.82rem', transition: 'all 0.2s', flexShrink: 0 },
    content: { overflowY: 'auto', background: '#080f1e' },
    chunkCard: { background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' },
    chunkMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' },
    badge: { padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700' },
    chunkText: { color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: '1.6' },
    state: { textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.9rem' },
    footer: { padding: '0.75rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.02)' },
    closeFooterBtn: { padding: '0.45rem 1.25rem', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
};
