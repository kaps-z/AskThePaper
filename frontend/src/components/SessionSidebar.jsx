import React from 'react';

export default function SessionSidebar({
    sessions,
    activeSessionId,
    onSelectSession,
    onNewChat,
    onDeleteSession,
    config,
    selectedModel,
    setSelectedModel,
    selectedStrategy,
    setSelectedStrategy,
    documents, // Note: this prop is now an array of topics, not documents
    selectedPaperId, // Note: this now holds selectedTopicId
    setSelectedPaperId
}) {
    return (
        <div style={{
            width: '260px',
            backgroundColor: '#050505', /* Drier, deeper black for futuristic look */
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden'
        }}>
            <div style={{ padding: '1rem' }}>
                <button
                    onClick={onNewChat}
                    style={{
                        width: '100%', padding: '0.75rem', backgroundColor: '#3b82f6',
                        color: 'white', border: 'none', borderRadius: '0.5rem',
                        cursor: 'pointer', fontWeight: '500', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    New Chat
                </button>
            </div>

            <div style={{ padding: '0 1rem 1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.25rem' }}>Research Topic</label>
                <select
                    value={selectedPaperId} // holds topic id
                    onChange={(e) => setSelectedPaperId(e.target.value)}
                    style={{
                        width: '100%', padding: '0.6rem 0.75rem', backgroundColor: '#111', color: '#f8fafc',
                        border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', outline: 'none',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)',
                        transition: 'box-shadow 0.2s', cursor: 'pointer'
                    }}
                    onFocus={(e) => e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px #3b82f6'}
                    onBlur={(e) => e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)'}

                >
                    <option value="">-- Select Topic --</option>
                    {documents && Array.isArray(documents) && documents.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Recent</div>
                {sessions.length === 0 ? (
                    <div style={{ fontSize: '0.875rem', color: '#475569', textAlign: 'center', marginTop: '1rem' }}>No sessions yet</div>
                ) : (
                    sessions.map(session => (
                        <div
                            key={session.session_id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                backgroundColor: activeSessionId === session.session_id ? '#171717' : 'transparent',
                                color: activeSessionId === session.session_id ? '#f8fafc' : '#cbd5e1',
                                marginBottom: '0.25rem',
                                fontSize: '0.875rem'
                            }}
                        >
                            <div
                                style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                onClick={() => onSelectSession(session.session_id)}
                            >
                                {session.title || "New Chat"}
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.session_id); }}
                                style={{
                                    background: 'transparent', border: 'none', color: '#64748b',
                                    cursor: 'pointer', padding: '2px', display: activeSessionId === session.session_id ? 'block' : 'none'
                                }}
                                title="Delete Session"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid #111' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.25rem' }}>Model</label>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        style={{
                            width: '100%', padding: '0.6rem 0.75rem', backgroundColor: '#111', color: '#f8fafc',
                            border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', outline: 'none',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)',
                            transition: 'box-shadow 0.2s', cursor: 'pointer'
                        }}
                        onFocus={(e) => e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px #3b82f6'}
                        onBlur={(e) => e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)'}
                    >
                        {config?.llm_catalogue && Object.entries(config.llm_catalogue).map(([provider, models]) => {
                            const providerNames = {
                                google: 'Google Gemini', openai: 'OpenAI', anthropic: 'Anthropic Claude', groq: 'Groq'
                            };
                            return (
                                <optgroup key={provider} label={providerNames[provider] || provider.toUpperCase()}>
                                    {models.map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </optgroup>
                            );
                        })}
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.25rem' }}>Strategy</label>
                    <select
                        value={selectedStrategy}
                        onChange={(e) => setSelectedStrategy(e.target.value)}
                        style={{
                            width: '100%', padding: '0.6rem 0.75rem', backgroundColor: '#111', color: '#f8fafc',
                            border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', outline: 'none',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)',
                            transition: 'box-shadow 0.2s', cursor: 'pointer'
                        }}
                        onFocus={(e) => e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px #3b82f6'}
                        onBlur={(e) => e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)'}
                    >
                        <option value="">Auto (Default)</option>
                        <option value="all" disabled>All Strategies (Coming Soon)</option>
                        {config?.available_strategies?.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
