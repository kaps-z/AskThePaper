import React from 'react';

export default function DebugPanel({ debugInfo, isVisible, onClose }) {
    if (!isVisible || !debugInfo) return null;

    return (
        <div className="fade-slide-up" style={{
            width: '350px',
            backgroundColor: '#0f172a',
            borderLeft: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 10,
            boxShadow: '-4px 0 15px rgba(0,0,0,0.5)'
        }}>
            <div style={{
                padding: '1rem', borderBottom: '1px solid #1e293b', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center'
            }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    Retrieval Debug
                </h3>
                <button onClick={onClose} style={{
                    background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer'
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem',
                    fontSize: '0.75rem', color: '#94a3b8'
                }}>
                    <div style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '0.375rem' }}>
                        <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Embedding Model</div>
                        <div style={{ color: '#f8fafc' }}>{debugInfo.embed_model}</div>
                    </div>
                    <div style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '0.375rem' }}>
                        <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Strategy Filter</div>
                        <div style={{ color: '#f8fafc' }}>{debugInfo.strategy_filter}</div>
                    </div>
                    <div style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '0.375rem' }}>
                        <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>LLM Model</div>
                        <div style={{ color: '#f8fafc' }}>{debugInfo.model_id}</div>
                    </div>
                    <div style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '0.375rem' }}>
                        <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Top K</div>
                        <div style={{ color: '#f8fafc' }}>{debugInfo.top_k}</div>
                    </div>
                </div>

                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    Retrieved Chunks ({debugInfo.chunks?.length || 0})
                </div>

                {debugInfo.chunks?.map((chunk, index) => (
                    <div key={index} style={{
                        background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem',
                        padding: '0.75rem', marginBottom: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{
                                fontSize: '0.7rem', fontWeight: '600', backgroundColor: '#3b82f620',
                                color: '#60a5fa', padding: '0.125rem 0.375rem', borderRadius: '99px'
                            }}>
                                {chunk.strategy}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: chunk.score > 0.7 ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
                                {(chunk.score * 100).toFixed(1)}% match
                            </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4', marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                            {chunk.content}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            {chunk.page && <span>Page {chunk.page}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
