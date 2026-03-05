import React, { useState, useEffect, useRef } from 'react';
import SessionSidebar from '../components/SessionSidebar';
import DebugPanel from '../components/DebugPanel';
import { getChatConfig, getWittyPhrase, askQuestion, getSessions, getSession, deleteSession, getChatTopics } from '../api';

export default function ChatPage() {
    const [config, setConfig] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [wittyMessage, setWittyMessage] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [selectedStrategy, setSelectedStrategy] = useState('');
    const [topics, setTopics] = useState([]);
    const [selectedTopicId, setSelectedTopicId] = useState('');

    // Debug state
    const [isDebugVisible, setIsDebugVisible] = useState(false);
    const [currentDebugPayload, setCurrentDebugPayload] = useState(null);
    const [error, setError] = useState(null);
    const [actionError, setActionError] = useState('');

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Initial load
    useEffect(() => {
        setIsLoading(true);
        setError(null);

        Promise.all([
            getChatConfig(),
            getChatTopics(),
            getSessions()
        ]).then(([cfg, docs, sess]) => {
            if (cfg) {
                setConfig(cfg);
                if (cfg.active_model) setSelectedModel(cfg.active_model);
            }
            if (Array.isArray(docs)) setTopics(docs);
            if (Array.isArray(sess)) setSessions(sess);
        }).catch(err => {
            console.error("Failed to load initial data", err);
            setError("Could not connect to the research engine. Please make sure the backend is running.");
        }).finally(() => {
            setIsLoading(false);
        });
    }, []);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Witty message rotating interval
    useEffect(() => {
        let interval;
        if (isLoading) {
            const fetchWitty = () => getWittyPhrase().then(setWittyMessage).catch(() => { });
            fetchWitty(); // initial fetch
            interval = setInterval(fetchWitty, 4000);
        } else {
            setWittyMessage('');
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const loadSessions = () => {
        getSessions().then(setSessions).catch(() => { });
    };

    const handleSelectSession = async (sessionId) => {
        setActiveSessionId(sessionId);
        setCurrentDebugPayload(null);
        setIsDebugVisible(false);
        try {
            const msgs = await getSession(sessionId);
            setMessages(msgs.map(m => ([
                { role: 'user', content: m.question },
                { role: 'assistant', content: m.answer, debug: m.debug, message_id: m.message_id }
            ])).flat());
        } catch (err) {
            console.error(err);
        }
    };

    const handleNewChat = () => {
        setActiveSessionId(null);
        setMessages([]);
        setCurrentDebugPayload(null);
        setIsDebugVisible(false);
        inputRef.current?.focus();
    };

    const handleDeleteSession = async (sessionId) => {
        await deleteSession(sessionId);
        if (activeSessionId === sessionId) {
            handleNewChat();
        }
        loadSessions();
    };

    const handleSend = async (e) => {
        e?.preventDefault();
        setActionError('');
        if (!input.trim() || isLoading) return;
        if (!selectedTopicId) {
            setActionError("Please select a research topic from the sidebar first.");
            return;
        }

        const question = input.trim();
        setInput('');

        // Add optimistic user message
        const newMessages = [...messages, { role: 'user', content: question }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const res = await askQuestion({
                question,
                session_id: activeSessionId,
                topic_id: selectedTopicId,
                model_id: selectedModel,
                strategy: selectedStrategy
            });

            // If this was a new session, update active session ID
            if (!activeSessionId) {
                setActiveSessionId(res.session_id);
                // Also optimistically add it to the sidebar so it's visible immediately
                setSessions([{ session_id: res.session_id, title: question.substring(0, 60) }, ...sessions]);
                // Background refresh to ensure consistency
                setTimeout(loadSessions, 1000);
            }

            setMessages([...newMessages, {
                role: 'assistant',
                content: res.answer,
                debug: res.debug,
                message_id: res.message_id
            }]);

            if (res.debug) {
                setCurrentDebugPayload(res.debug);
            }

        } catch (err) {
            console.error(err);
            setMessages([...newMessages, {
                role: 'assistant',
                content: "Sorry, I encountered an error processing your request. " + (err.response?.data?.detail || err.message)
            }]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    if (error) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f8fafc', padding: '2rem', textAlign: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ marginBottom: '1.5rem' }}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Connection Failed</h1>
                <p style={{ color: '#94a3b8', maxWidth: '400px', marginBottom: '2rem' }}>{error}</p>
                <button onClick={() => window.location.reload()} style={{ padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>Retry Connection</button>
            </div>
        );
    }

    if (config && !config.chat_enabled) {
        return (
            <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#f8fafc' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: '#1e293b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto', border: '1px solid #334155' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="9" y1="10" x2="15" y2="10"></line></svg>
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.75rem' }}>Chat is Offline</h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>The research chat interface is currently in maintenance mode.</p>
                </div>
            </div>
        );
    }

    if (!config) {
        return (
            <div style={{
                height: '100vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#f8fafc'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', animation: 'pulse 1s infinite' }}></div>
                    <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', animation: 'pulse 1s infinite 0.2s' }}></div>
                    <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', animation: 'pulse 1s infinite 0.4s' }}></div>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f8fafc' }}>Waking up engine...</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a' }}>
            <SessionSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                onDeleteSession={handleDeleteSession}
                config={config}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                selectedStrategy={selectedStrategy}
                setSelectedStrategy={setSelectedStrategy}
                documents={topics}
                selectedPaperId={selectedTopicId}
                setSelectedPaperId={setSelectedTopicId}
            />

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

                {/* Header Navbar */}
                <div style={{
                    height: '60px', display: 'flex',
                    alignItems: 'center', padding: '0 1.5rem', justifyContent: 'space-between',
                    background: 'rgba(10, 10, 10, 0.8)', backdropFilter: 'blur(12px)', zIndex: 5,
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', background: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                        <h1 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#f8fafc', margin: 0 }}>AskThePaper</h1>
                    </div>

                    {config?.debug_mode && (
                        <button
                            onClick={() => setIsDebugVisible(!isDebugVisible)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
                                background: isDebugVisible ? '#f59e0b25' : '#111',
                                border: 'none',
                                color: isDebugVisible ? '#f59e0b' : '#94a3b8',
                                borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
                                boxShadow: isDebugVisible ? 'inset 0 0 0 1px rgba(245,158,11,0.5)' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 5px rgba(0,0,0,0.5)',
                                transition: 'all 0.2s'
                            }}
                            title="Toggle Debug Panel"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            Debug {currentDebugPayload ? '(Ready)' : '(Waiting)'}
                        </button>
                    )}
                </div>

                {/* Messages Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 0' }}>
                    {messages.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '1rem', opacity: 0.5 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '500', color: '#f8fafc', marginBottom: '0.5rem' }}>How can I help with your research?</h2>
                            <p>Ask a question, and I'll search through your uploaded papers to find the answer.</p>
                        </div>
                    ) : (
                        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
                            {messages.map((msg, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    gap: '1rem',
                                    marginBottom: '2rem',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                                }}>
                                    {msg.role === 'assistant' && (
                                        <div style={{
                                            flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
                                            background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10H12V2Z"></path><path d="M12 12 2.1 7.1"></path><path d="m12 12 9.9 4.9"></path></svg>
                                        </div>
                                    )}

                                    <div style={{
                                        maxWidth: '85%',
                                        background: msg.role === 'user' ? '#171717' : 'transparent',
                                        padding: msg.role === 'user' ? '1rem 1.25rem' : '0.25rem 0',
                                        borderRadius: '1.25rem',
                                        borderBottomRightRadius: msg.role === 'user' ? '0.25rem' : '1.25rem',
                                        color: msg.role === 'user' ? '#f8fafc' : '#e2e8f0',
                                        lineHeight: '1.6',
                                        fontSize: '0.95rem',
                                        whiteSpace: 'pre-wrap',
                                        boxShadow: msg.role === 'user' ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.5)' : 'none'
                                    }}>
                                        {msg.content}

                                        {/* Debug inspection badge for individual assistant messages */}
                                        {msg.role === 'assistant' && msg.debug && config?.debug_mode && (
                                            <div style={{ marginTop: '0.75rem' }}>
                                                <button
                                                    onClick={() => {
                                                        setCurrentDebugPayload(msg.debug);
                                                        setIsDebugVisible(true);
                                                    }}
                                                    style={{
                                                        background: 'transparent', border: '1px solid #334155', borderRadius: '999px',
                                                        color: '#64748b', fontSize: '0.7rem', padding: '0.125rem 0.5rem', cursor: 'pointer',
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                                                    }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                    Inspect Retrieval
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                                    <div style={{
                                        flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
                                        background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                                        animation: 'pulse 1.5s infinite ease-in-out'
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10H12V2Z"></path></svg>
                                    </div>
                                    <div style={{ alignSelf: 'center', color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic', animation: 'blink 2s infinite' }}>
                                        {wittyMessage || 'Thinking...'}
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div style={{ padding: '0 1.5rem 2rem 1.5rem', maxWidth: '840px', margin: '0 auto', width: '100%', position: 'relative' }}>
                    {actionError && (
                        <div style={{
                            marginBottom: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '0.5rem', color: '#fca5a5',
                            fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            animation: 'slideUp 0.3s ease'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                {actionError}
                            </div>
                            <button onClick={() => setActionError('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '0.25rem' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    )}
                    <form
                        onSubmit={handleSend}
                        style={{
                            position: 'relative', background: '#111', borderRadius: '1.25rem',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.8)',
                            transition: 'box-shadow 0.2s'
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                if (actionError) setActionError('');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask a question about the papers..."
                            style={{
                                width: '100%', minHeight: '56px', maxHeight: '200px', background: 'transparent',
                                border: 'none', color: '#f8fafc', padding: '1rem 3.5rem 1rem 1.25rem',
                                fontSize: '1rem', resize: 'none', outline: 'none', lineHeight: '1.5', fontFamily: 'inherit'
                            }}
                            rows={(input.match(/\n/g) || []).length + 1}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            style={{
                                position: 'absolute', right: '0.75rem', bottom: '0.75rem', width: '36px', height: '36px',
                                background: input.trim() && !isLoading ? '#f8fafc' : '#171717',
                                color: input.trim() && !isLoading ? '#050505' : '#475569',
                                border: 'none', borderRadius: '0.6rem', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                                boxShadow: input.trim() && !isLoading ? '0 0 10px rgba(255,255,255,0.2)' : 'none'
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                        </button>
                    </form>
                    <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: '#475569' }}>
                        AI can make mistakes. Verify important information with the original source papers.
                    </div>
                </div>

                <DebugPanel
                    debugInfo={currentDebugPayload}
                    isVisible={isDebugVisible}
                    onClose={() => setIsDebugVisible(false)}
                />
            </main >
        </div >
    );
}
