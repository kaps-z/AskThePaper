import { useState, useEffect } from 'react';
import { getConfig, updateConfig } from '../api';

// ─── Static reference data (matches backend catalogues) ──────────────────────
const STRATEGY_INFO = {
    recursive: { label: 'Recursive', icon: '🔀', desc: 'Paragraph → sentence → word. Best all-purpose strategy.' },
    sentence: { label: 'Sentence', icon: '📝', desc: 'Merges sentences to ~800 chars. Preserves prose flow.' },
    paragraph: { label: 'Paragraph', icon: '📄', desc: 'Splits on double-newlines. Great for structured papers.' },
    semantic: { label: 'Semantic', icon: '🧠', desc: 'Topic breakpoints via cosine similarity. Most intelligent.' },
};

const PROVIDER_META = {
    google: { label: 'Google Gemini', icon: '✨', color: '#4285f4', envVar: 'GOOGLE_API_KEY', hasFree: true },
    openai: { label: 'OpenAI', icon: '🟢', color: '#10a37f', envVar: 'OPENAI_API_KEY', hasFree: false },
    anthropic: { label: 'Anthropic', icon: '🟣', color: '#cc785c', envVar: 'ANTHROPIC_API_KEY', hasFree: false },
    groq: { label: 'Groq', icon: '⚡', color: '#f59e0b', envVar: 'GROQ_API_KEY', hasFree: true },
};

const EMBED_INFO = {
    'all-MiniLM-L6-v2': { label: 'all-MiniLM-L6-v2', dims: 384, ctx: '512', free: true, badge: 'Default / Fast', desc: 'Small and very fast. Best for quick prototyping or low-resource environments.' },
    'BAAI/bge-m3': { label: 'BGE-M3', dims: 1024, ctx: '8192', free: true, badge: 'Best for RAG', desc: 'Hybrid dense+sparse retrieval. Top choice for academic paper search.' },
    'intfloat/e5-large-v2': { label: 'E5-large-v2', dims: 1024, ctx: '512', free: true, badge: 'Popular', desc: 'Microsoft model. Efficient and reliable for general semantic search.' },
    'Snowflake/snowflake-arctic-embed-l-v2.0': { label: 'Arctic-Embed-L v2', dims: 1024, ctx: '512', free: true, badge: 'High Quality', desc: 'High-quality retrieval embeddings from Snowflake AI Research.' },
    'jinaai/jina-embeddings-v3': { label: 'Jina Embeddings v3', dims: 1024, ctx: '8192', free: true, badge: 'Multi-Task', desc: 'Task-type routing. Flexible and powerful for diverse document types.' },
};

const EVAL_INFO = {
    custom: { label: 'Custom', icon: '🛠️', free: true, desc: 'Built-in metrics: answer relevance, context precision, groundedness.' },
    ragas: { label: 'RAGAS', icon: '📊', free: true, desc: 'Open-source RAG evaluation framework. Faithfulness, answer relevancy, context recall.' },
    deepeval: { label: 'DeepEval', icon: '🔬', free: true, desc: 'Pytest-like framework with 14+ LLM metrics including G-Eval and DAG.' },
    trulens: { label: 'TruLens', icon: '🔭', free: true, desc: 'RAG triad evaluation: context relevance, groundedness, answer relevance.' },
    langsmith: { label: 'LangSmith', icon: '🦜', free: false, desc: 'LangChain\'s observability + evaluation platform. Free tier available.' },
};

const SETUP_GUIDES = [
    { provider: 'google', icon: '✨', color: '#4285f4', label: 'Google Gemini', free: true, freeNote: 'Free tier — 1500 req/day, no credit card needed.', steps: [{ step: '1', text: 'Go to Google AI Studio', link: 'https://aistudio.google.com', linkLabel: 'aistudio.google.com' }, { step: '2', text: 'Sign in with your Google account.' }, { step: '3', text: 'Click "Get API Key" → "Create API key".' }, { step: '4', text: 'Add to .env:', code: 'GOOGLE_API_KEY=AIza...' }], models: 'Gemini 2.0 Flash, 1.5 Flash (free) · 1.5 Pro (paid)', enterprise: 'Use Vertex AI for production SLAs and regional data residency.' },
    { provider: 'openai', icon: '🟢', color: '#10a37f', label: 'OpenAI', free: false, freeNote: 'No free tier. GPT-4o Mini is very affordable ($0.15/1M tokens).', steps: [{ step: '1', text: 'Go to OpenAI Platform', link: 'https://platform.openai.com', linkLabel: 'platform.openai.com' }, { step: '2', text: 'Create account and add a payment method.' }, { step: '3', text: 'Navigate to API Keys → Create new secret key.' }, { step: '4', text: 'Add to .env:', code: 'OPENAI_API_KEY=sk-proj-...' }], models: 'GPT-4o, GPT-4o Mini, GPT-3.5 Turbo', enterprise: 'Enterprise plan with dedicated capacity and Zero Data Retention (ZDR).' },
    { provider: 'anthropic', icon: '🟣', color: '#cc785c', label: 'Anthropic', free: false, freeNote: 'No free tier. Claude 3 Haiku is the cheapest option.', steps: [{ step: '1', text: 'Go to Anthropic Console', link: 'https://console.anthropic.com', linkLabel: 'console.anthropic.com' }, { step: '2', text: 'Create account and add payment method.' }, { step: '3', text: 'Go to API Keys → Create Key.' }, { step: '4', text: 'Add to .env:', code: 'ANTHROPIC_API_KEY=sk-ant-...' }], models: 'Claude 3 Haiku · Sonnet · 3.5 Sonnet · Opus', enterprise: 'BAA, SSO, and audit logs available on enterprise plan.' },
    { provider: 'groq', icon: '⚡', color: '#f59e0b', label: 'Groq', free: true, freeNote: 'Free tier with generous rate limits. No credit card needed.', steps: [{ step: '1', text: 'Go to Groq Console', link: 'https://console.groq.com', linkLabel: 'console.groq.com' }, { step: '2', text: 'Sign up — no payment method required.' }, { step: '3', text: 'Navigate to API Keys → Create API Key.' }, { step: '4', text: 'Add to .env:', code: 'GROQ_API_KEY=gsk_...' }], models: 'Llama 3.1 70B, 8B · Mixtral 8x7B · Gemma 2 9B', enterprise: 'Custom LPU hardware — ~500 tok/s. Excellent for latency-sensitive apps.' },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Settings({ credentials }) {
    const [tab, setTab] = useState('config');
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [activeLLMProv, setLLMProv] = useState('google');

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4500);
    };

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getConfig(credentials);
                setConfig(data);
                const active = data.llm?.active_model || '';
                for (const [p, models] of Object.entries(data.llm?.catalogue || {})) {
                    if (models.some(([id]) => id === active)) { setLLMProv(p); break; }
                }
            } catch (err) {
                showToast('Failed to load: ' + (err.response?.data?.detail || err.message), 'error');
            } finally { setLoading(false); }
        };
        load();
    }, [credentials]);

    const toggleStrategy = s => setConfig(p => {
        const cur = p.chunking.active_strategies || [];
        const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s];
        return { ...p, chunking: { ...p.chunking, active_strategies: next } };
    });

    const handleSave = async e => {
        e.preventDefault();
        const strategies = config.chunking?.active_strategies || [];
        if (!strategies.length) { showToast('Select at least one chunking strategy.', 'error'); return; }
        setSaving(true);
        try {
            await updateConfig({
                active_strategies: strategies,
                embedding: config.embedding?.active,
                evaluation: config.evaluation?.active,
                active_model: config.llm?.active_model,
            }, credentials);
            showToast('Settings saved!');
        } catch (err) {
            showToast('Save failed: ' + (err.response?.data?.detail || err.message), 'error');
        } finally { setSaving(false); }
    };

    if (loading) return <div style={st.centered}><p style={{ color: '#94a3b8' }}>⏳ Loading settings…</p></div>;
    if (!config) return <div style={st.centered}><p style={{ color: '#fca5a5' }}>Could not load config.</p></div>;

    const strategies = config.chunking?.active_strategies || [];
    const catalogue = config.llm?.catalogue || {};
    const activeModel = config.llm?.active_model || '';
    const provModels = catalogue[activeLLMProv] || [];
    const activeEmbed = config.embedding?.active || '';
    const embedOptions = config.embedding?.options || Object.keys(EMBED_INFO);
    const evalOptions = config.evaluation?.options || Object.keys(EVAL_INFO);

    return (
        <div style={st.page}>
            {toast && <div style={{ ...st.toast, ...(toast.type === 'error' ? st.toastErr : st.toastOk) }}>{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>}

            <div style={st.header}>
                <h2 style={st.title}>⚙️ Settings</h2>
                <p style={st.subtitle}>Configure the pipeline, models, and evaluation for AskThePaper.</p>
            </div>

            {/* Page-level tabs */}
            <div style={st.pageTabs}>
                {[['config', '⚙️ Configuration'], ['guide', '📖 Setup Guide'], ['info', '📚 Model Info']].map(([id, lbl]) => (
                    <button key={id} onClick={() => setTab(id)} style={{ ...st.pageTab, ...(tab === id ? st.pageTabOn : {}) }}>{lbl}</button>
                ))}
            </div>

            {/* ─── CONFIG TAB ──────────────────────────────────────────── */}
            {tab === 'config' && (
                <form onSubmit={handleSave} style={st.form}>

                    {/* Chunking */}
                    <Section title="🔀 Chunking Strategies" sub="All selected strategies run in parallel on every upload.">
                        <div style={st.grid2}>
                            {Object.entries(STRATEGY_INFO).map(([key, info]) => {
                                const on = strategies.includes(key);
                                return (
                                    <label key={key} onClick={() => toggleStrategy(key)} style={{ ...st.selCard, ...(on ? st.selCardOn : {}) }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '1.3rem' }}>{info.icon}</span>
                                            <span style={{ ...st.check, ...(on ? st.checkOn : {}) }}>{on ? '✓' : ''}</span>
                                        </div>
                                        <div style={st.selLabel}>{info.label}</div>
                                        <div style={st.selDesc}>{info.desc}</div>
                                    </label>
                                );
                            })}
                        </div>
                        {!strategies.length && <p style={st.warn}>⚠️ Select at least one strategy.</p>}
                    </Section>

                    {/* Embedding */}
                    <Section title="🧬 Embedding Model" sub="Generates vectors for semantic chunk retrieval. Changing this requires reprocessing all files.">
                        <div style={st.grid2}>
                            {embedOptions.map(id => {
                                const info = EMBED_INFO[id] || { label: id, dims: '?', ctx: '?', free: true, badge: '', desc: '' };
                                const on = id === activeEmbed;
                                return (
                                    <label key={id} onClick={() => setConfig(p => ({ ...p, embedding: { ...p.embedding, active: id } }))}
                                        style={{ ...st.selCard, ...(on ? { ...st.selCardOn, borderColor: '#8b5cf6', background: 'rgba(139,92,246,0.1)' } : {}) }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '999px', background: info.free ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: info.free ? '#4ade80' : '#f87171', fontWeight: '700', border: `1px solid ${info.free ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}` }}>{info.badge || (info.free ? 'Free' : 'Paid')}</span>
                                            <span style={{ ...st.radio, ...(on ? { background: '#8b5cf6', borderColor: '#8b5cf6' } : {}) }} />
                                        </div>
                                        <div style={st.selLabel}>{info.label}</div>
                                        <div style={{ display: 'flex', gap: '0.5rem', margin: '0.25rem 0 0.4rem', flexWrap: 'wrap' }}>
                                            <span style={st.pill}>📐 {info.dims}d</span>
                                            <span style={st.pill}>📄 {info.ctx} tok</span>
                                        </div>
                                        <div style={st.selDesc}>{info.desc}</div>
                                    </label>
                                );
                            })}
                        </div>
                    </Section>

                    {/* LLM */}
                    <Section title="🤖 Chat LLM Model" sub="Model used by the chatbot to generate answers from retrieved chunks.">
                        <div style={st.provTabs}>
                            {Object.entries(PROVIDER_META).map(([prov, meta]) => {
                                const on = prov === activeLLMProv;
                                return (
                                    <button key={prov} type="button" onClick={() => setLLMProv(prov)}
                                        style={{ ...st.provTab, ...(on ? { ...st.provTabOn, borderColor: meta.color, color: meta.color } : {}) }}>
                                        {meta.icon} {meta.label}
                                        {meta.hasFree && <span style={st.freeBadge}>FREE</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={st.envNote}>
                            <span>🔑</span>
                            <span>Requires: <code style={st.code}>{PROVIDER_META[activeLLMProv]?.envVar}</code></span>
                            <button type="button" onClick={() => setTab('guide')} style={st.guideLink}>📖 How to get this key →</button>
                        </div>
                        <div style={st.modelGrid}>
                            {provModels.map(([modelId, modelName]) => {
                                const on = modelId === activeModel;
                                const pm = PROVIDER_META[activeLLMProv];
                                return (
                                    <label key={modelId} onClick={() => setConfig(p => ({ ...p, llm: { ...p.llm, active_model: modelId } }))}
                                        style={{ ...st.modelCard, ...(on ? { border: `1.5px solid ${pm.color}`, background: pm.color + '18' } : {}) }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ ...st.radioBtn, ...(on ? { background: pm.color, borderColor: pm.color } : {}) }} />
                                            <div>
                                                <div style={{ color: '#f8fafc', fontWeight: on ? '700' : '500', fontSize: '0.88rem' }}>{modelName}</div>
                                                <div style={{ color: '#64748b', fontSize: '0.7rem', fontFamily: 'monospace' }}>{modelId}</div>
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </Section>

                    {/* Evaluation */}
                    <Section title="📊 Evaluation Framework" sub="Metrics framework for measuring RAG answer quality.">
                        <div style={{ ...st.grid2, gridTemplateColumns: '1fr 1fr' }}>
                            {evalOptions.map(id => {
                                const info = EVAL_INFO[id] || { label: id, icon: '🔧', free: true, desc: '' };
                                const on = id === (config.evaluation?.active || '');
                                return (
                                    <label key={id} onClick={() => setConfig(p => ({ ...p, evaluation: { ...p.evaluation, active: id } }))}
                                        style={{ ...st.selCard, ...(on ? { ...st.selCardOn, borderColor: '#22d3ee', background: 'rgba(34,211,238,0.08)' } : {}) }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
                                            <span>{info.icon} <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>{info.label}</strong></span>
                                            <span style={{ ...st.radio, ...(on ? { background: '#22d3ee', borderColor: '#22d3ee' } : {}) }} />
                                        </div>
                                        <div style={st.selDesc}>{info.desc}</div>
                                    </label>
                                );
                            })}
                        </div>
                    </Section>

                    <button type="submit" disabled={saving || !strategies.length}
                        style={{ ...st.saveBtn, opacity: (saving || !strategies.length) ? 0.5 : 1 }}>
                        {saving ? '⏳ Saving…' : '💾 Save Settings'}
                    </button>
                </form>
            )}

            {/* ─── SETUP GUIDE TAB ─────────────────────────────────────── */}
            {tab === 'guide' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {SETUP_GUIDES.map(guide => (
                        <div key={guide.provider} style={{ ...st.card, borderLeft: `3px solid ${guide.color}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.4rem' }}>{guide.icon}</span>
                                    <div>
                                        <h3 style={{ margin: 0, color: guide.color, fontSize: '1rem', fontWeight: '700' }}>{guide.label}</h3>
                                        <a href={`https://${guide.provider === 'google' ? 'aistudio.google.com' : guide.provider === 'openai' ? 'platform.openai.com' : guide.provider === 'anthropic' ? 'console.anthropic.com' : 'console.groq.com'}`} target="_blank" rel="noreferrer" style={{ color: '#64748b', fontSize: '0.72rem', textDecoration: 'none' }}>🔗 external link</a>
                                    </div>
                                </div>
                                <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700', background: guide.free ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: guide.free ? '#4ade80' : '#f87171', border: `1px solid ${guide.free ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}` }}>{guide.free ? '✓ Free tier' : '$ Paid only'}</span>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${guide.free ? '#4ade80' : '#f87171'}`, borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>{guide.freeNote}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1rem' }}>
                                {guide.steps.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
                                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: guide.color + '33', border: `1.5px solid ${guide.color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '700', color: guide.color, flexShrink: 0, marginTop: '2px' }}>{s.step}</span>
                                        <div style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5' }}>
                                            {s.text} {s.link && <a href={s.link} target="_blank" rel="noreferrer" style={{ color: guide.color }}>{s.linkLabel}</a>}
                                            {s.code && <div style={{ marginTop: '0.35rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', padding: '0.35rem 0.65rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#93c5fd' }}>{s.code}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.4rem' }}><strong style={{ color: '#94a3b8' }}>Models:</strong> {guide.models}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: '5px', padding: '0.35rem 0.65rem' }}><strong style={{ color: '#60a5fa' }}>🏢 Enterprise:</strong> {guide.enterprise}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── INFO TAB ────────────────────────────────────────────── */}
            {tab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Chunking Strategies */}
                    <InfoSection title="🔀 Chunking Strategies" desc="How documents are split into retrievable chunks.">
                        <InfoTable headers={['Strategy', 'Best For', 'Approach']}>
                            <tr style={st.tr}><td style={st.td}><b>🔀 Recursive</b></td><td style={st.td}>General use</td><td style={st.td}>Splits paragraph → sentence → word hierarchy</td></tr>
                            <tr style={st.tr}><td style={st.td}><b>📝 Sentence</b></td><td style={st.td}>Dense prose</td><td style={st.td}>Merges sentences to ~800 chars</td></tr>
                            <tr style={st.tr}><td style={st.td}><b>📄 Paragraph</b></td><td style={st.td}>Structured papers</td><td style={st.td}>Splits on double-newlines (section breaks)</td></tr>
                            <tr style={st.tr}><td style={st.td}><b>🧠 Semantic</b></td><td style={st.td}>Best quality</td><td style={st.td}>Cosine-similarity breakpoints via SentenceTransformers</td></tr>
                        </InfoTable>
                    </InfoSection>

                    {/* Embedding Models */}
                    <InfoSection title="🧬 Embedding Models" desc="All models are open-source and downloaded from HuggingFace. Models over ~400MB are downloaded on first use.">
                        <InfoTable headers={['Model', 'Dims', 'Context', 'Strengths']}>
                            {Object.entries(EMBED_INFO).map(([id, info]) => (
                                <tr key={id} style={st.tr}>
                                    <td style={st.td}><b>{info.label}</b><br /><span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#475569' }}>{id}</span></td>
                                    <td style={st.td}>{info.dims}</td>
                                    <td style={st.td}>{info.ctx} tok</td>
                                    <td style={st.td}>{info.desc}</td>
                                </tr>
                            ))}
                        </InfoTable>
                    </InfoSection>

                    {/* LLM Models */}
                    <InfoSection title="🤖 LLM Providers" desc="Used for answer generation. Provider SDKs are lazy-loaded — missing packages won't break the server.">
                        <InfoTable headers={['Provider', 'Free?', 'Models', 'Env Var']}>
                            {Object.entries(PROVIDER_META).map(([prov, meta]) => (
                                <tr key={prov} style={st.tr}>
                                    <td style={st.td}><b style={{ color: meta.color }}>{meta.icon} {meta.label}</b></td>
                                    <td style={st.td}><span style={{ color: meta.hasFree ? '#4ade80' : '#f87171', fontWeight: '700' }}>{meta.hasFree ? '✓ Yes' : '✗ No'}</span></td>
                                    <td style={st.td}>{(catalogue[prov] || []).map(([, n]) => n).join(' · ') || '—'}</td>
                                    <td style={st.td}><code style={st.code}>{meta.envVar}</code></td>
                                </tr>
                            ))}
                        </InfoTable>
                    </InfoSection>

                    {/* Evaluation */}
                    <InfoSection title="📊 Evaluation Frameworks" desc="Frameworks for measuring RAG pipeline quality. RAGAS and DeepEval are free and open-source.">
                        <InfoTable headers={['Framework', 'Free?', 'Key Metrics']}>
                            {Object.entries(EVAL_INFO).map(([id, info]) => (
                                <tr key={id} style={st.tr}>
                                    <td style={st.td}><b>{info.icon} {info.label}</b></td>
                                    <td style={st.td}><span style={{ color: info.free ? '#4ade80' : '#f87171', fontWeight: '700' }}>{info.free ? '✓ Free' : 'Free tier'}</span></td>
                                    <td style={st.td}>{info.desc}</td>
                                </tr>
                            ))}
                        </InfoTable>
                    </InfoSection>

                    {/* Env vars quick-ref */}
                    <InfoSection title="🔑 Environment Variables" desc="All required env vars for your .env file or docker-compose.yml.">
                        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem 1.25rem', fontFamily: 'monospace', fontSize: '0.82rem', color: '#93c5fd', lineHeight: '2' }}>
                            {`MONGODB_URL=mongodb://...          # Required — MongoDB Atlas or local\nDATABASE_NAME=askthepaper         # Required\nADMIN_USERNAME=admin              # Required\nADMIN_PASSWORD=changeme           # Required\n\n# LLM providers (set whichever you use)\nGOOGLE_API_KEY=AIza...            # Free via aistudio.google.com\nOPENAI_API_KEY=sk-proj-...        # Paid — platform.openai.com\nANTHROPIC_API_KEY=sk-ant-...      # Paid — console.anthropic.com\nGROQ_API_KEY=gsk_...              # Free — console.groq.com`}
                        </div>
                    </InfoSection>
                </div>
            )}
        </div>
    );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────
function Section({ title, sub, children }) {
    return (
        <div style={st.card}>
            <h3 style={st.cardTitle}>{title}</h3>
            {sub && <p style={st.cardSub}>{sub}</p>}
            {children}
        </div>
    );
}
function InfoSection({ title, desc, children }) {
    return (
        <div style={{ ...st.card }}>
            <h3 style={st.cardTitle}>{title}</h3>
            {desc && <p style={st.cardSub}>{desc}</p>}
            {children}
        </div>
    );
}
function InfoTable({ headers, children }) {
    return (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {headers.map(h => <th key={h} style={st.th}>{h}</th>)}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = {
    page: { maxWidth: '820px', margin: '0 auto', padding: '2rem 1rem', position: 'relative' },
    centered: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' },
    header: { marginBottom: '1.25rem' },
    title: { color: '#f8fafc', margin: '0 0 0.4rem', fontSize: '1.5rem', fontWeight: '700' },
    subtitle: { color: '#94a3b8', margin: 0, fontSize: '0.9rem' },
    pageTabs: { display: 'flex', gap: '0.25rem', marginBottom: '1.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)' },
    pageTab: { padding: '0.6rem 1.2rem', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '600', transition: 'all 0.2s', marginBottom: '-1px' },
    pageTabOn: { color: '#f8fafc', borderBottomColor: '#3b82f6' },
    form: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
    card: { background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1.35rem', backdropFilter: 'blur(8px)' },
    cardTitle: { color: '#f8fafc', margin: '0 0 0.3rem', fontSize: '0.98rem', fontWeight: '700' },
    cardSub: { color: '#94a3b8', margin: '0 0 1.1rem', fontSize: '0.8rem' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
    selCard: { background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.9rem', cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s' },
    selCardOn: { background: 'rgba(37,99,235,0.12)', border: '1.5px solid rgba(59,130,246,0.5)' },
    selLabel: { color: '#f8fafc', fontWeight: '700', fontSize: '0.88rem', marginBottom: '0.25rem' },
    selDesc: { color: '#64748b', fontSize: '0.74rem', lineHeight: '1.4' },
    check: { width: '18px', height: '18px', borderRadius: '4px', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold', color: 'white', flexShrink: 0 },
    checkOn: { background: '#2563eb', border: '2px solid #3b82f6' },
    radio: { width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0, transition: 'all 0.2s', display: 'inline-block' },
    pill: { fontSize: '0.68rem', padding: '1px 6px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' },
    warn: { color: '#fbbf24', fontSize: '0.8rem', marginTop: '0.75rem' },
    provTabs: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' },
    provTab: { padding: '0.38rem 0.8rem', borderRadius: '8px', border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' },
    provTabOn: { background: 'rgba(255,255,255,0.07)', fontWeight: '700' },
    freeBadge: { fontSize: '0.58rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(34,197,94,0.2)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', fontWeight: '700' },
    envNote: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '7px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' },
    code: { background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace', color: '#93c5fd', fontSize: '0.76rem' },
    guideLink: { marginLeft: 'auto', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.76rem', fontWeight: '600', whiteSpace: 'nowrap' },
    modelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.55rem' },
    modelCard: { background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: '9px', padding: '0.65rem 0.9rem', cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none' },
    radioBtn: { width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0, transition: 'all 0.2s' },
    select: { width: '100%', padding: '0.6rem 2.25rem 0.6rem 0.9rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', color: '#f8fafc', fontSize: '0.88rem', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.65rem center', backgroundSize: '12px' },
    option: { background: '#1e293b', color: '#f8fafc' },
    saveBtn: { padding: '0.75rem 1.75rem', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: 'white', border: 'none', borderRadius: '9px', fontWeight: '700', fontSize: '0.95rem', alignSelf: 'flex-start', cursor: 'pointer', transition: 'opacity 0.2s' },
    // Info table
    th: { padding: '0.6rem 0.9rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' },
    td: { padding: '0.65rem 0.9rem', color: '#cbd5e1', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.04)', lineHeight: '1.5', verticalAlign: 'top' },
    tr: { transition: 'background 0.15s' },
    // Toast
    toast: { position: 'fixed', bottom: '1.5rem', right: '1.5rem', padding: '0.85rem 1.3rem', borderRadius: '12px', fontSize: '0.88rem', zIndex: 9999, backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxWidth: '400px', animation: 'slideInRight 0.3s ease' },
    toastOk: { background: 'rgba(20,83,45,0.95)', border: '1px solid rgba(74,222,128,0.4)', color: '#bbf7d0' },
    toastErr: { background: 'rgba(127,29,29,0.95)', border: '1px solid rgba(252,165,165,0.4)', color: '#fecaca' },
};
