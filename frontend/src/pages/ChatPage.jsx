import React, { useState, useEffect, useRef } from 'react';
import SessionSidebar from '../components/SessionSidebar';
import DebugPanel from '../components/DebugPanel';
import { getChatConfig, getWittyPhrase, askQuestion, getSessions, getSession, deleteSession } from '../api';

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

    // Debug state
    const [isDebugVisible, setIsDebugVisible] = useState(false);
    const [currentDebugPayload, setCurrentDebugPayload] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Initial load
    useEffect(() => {
        getChatConfig().then(cfg => {
            setConfig(cfg);
            setSelectedModel(cfg.active_model);
            if (!cfg.chat_enabled) {
                // Should show maintenance screen
            }
        }).catch(err => console.error("Failed to load config", err));

        loadSessions();
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
        if (!input.trim() || isLoading) return;

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
                strategy: selectedStrategy || null,
                model_id: selectedModel || null,
                top_k: 5
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

    if (config && !config.chat_enabled) {
        return (
            <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#080f1e', color: '#f8fafc' }}>
                <div style={{ textAlign: 'center' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" style={{ margin: '0 auto 1.5rem auto' }}><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Chat Interface Disabled</h1>
                    <p style={{ color: '#94a3b8' }}>The administrator has temporarily disabled chat access.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#080f1e', position: 'relative', overflow: 'hidden' }}>
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
            />

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

                {/* Header Navbar */}
                <div style={{
                    height: '60px', borderBottom: '1px solid #1e293b', display: 'flex',
                    alignItems: 'center', padding: '0 1.5rem', justifyContent: 'space-between',
                    background: 'rgba(8, 15, 30, 0.8)', backdropFilter: 'blur(8px)', zIndex: 5
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
                                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem',
                                background: isDebugVisible ? '#f59e0b20' : '#1e293b',
                                border: `1px solid ${isDebugVisible ? '#f59e0b' : '#334155'}`,
                                color: isDebugVisible ? '#f59e0b' : '#94a3b8',
                                borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500'
                            }}
                            title="Toggle Debug Panel"
                            disabled={!currentDebugPayload}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            Debug {currentDebugPayload ? '(Ready)' : ''}
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
                                        background: msg.role === 'user' ? '#1e293b' : 'transparent',
                                        padding: msg.role === 'user' ? '1rem' : '0.25rem 0',
                                        borderRadius: '1rem',
                                        borderBottomRightRadius: msg.role === 'user' ? 0 : '1rem',
                                        color: msg.role === 'user' ? '#f8fafc' : '#e2e8f0',
                                        lineHeight: '1.6',
                                        fontSize: '0.95rem',
                                        whiteSpace: 'pre-wrap'
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
                <div style={{ padding: '0 1.5rem 2rem 1.5rem', maxWidth: '840px', margin: '0 auto', width: '100%' }}>
                    <form
                        onSubmit={handleSend}
                        style={{
                            position: 'relative', background: '#0f172a', borderRadius: '1rem',
                            border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
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
                                position: 'absolute', right: '0.75rem', bottom: '0.75rem', width: '32px', height: '32px',
                                background: input.trim() && !isLoading ? '#f8fafc' : '#334155',
                                color: input.trim() && !isLoading ? '#0f172a' : '#64748b',
                                border: 'none', borderRadius: '0.5rem', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
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
            </main>
        </div>
    );
}
