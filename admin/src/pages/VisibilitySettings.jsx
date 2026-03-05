import { useState, useEffect } from 'react';
import { getConfig, updateConfig } from '../api';

const STRATEGY_LABELS = {
    recursive: 'Recursive Character',
    sentence: 'Sentence Splitting',
    paragraph: 'Paragraph Splitting',
    semantic: 'Semantic (AI-driven)'
};

export default function VisibilitySettings({ credentials }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        getConfig(credentials).then(data => {
            setConfig(data);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [credentials]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateConfig({
                frontend_settings: config.frontend_settings
            }, credentials);
            showToast('Visibility settings saved!');
        } catch (err) {
            showToast('Failed to save: ' + (err.response?.data?.detail || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleStrategy = (strat) => {
        const current = config.frontend_settings?.visible_strategies || [];
        const next = current.includes(strat)
            ? current.filter(s => s !== strat)
            : [...current, strat];
        setConfig({
            ...config,
            frontend_settings: { ...config.frontend_settings, visible_strategies: next }
        });
    };

    const toggleModel = (modelId) => {
        const current = config.frontend_settings?.visible_models || [];
        const next = current.includes(modelId)
            ? current.filter(id => id !== modelId)
            : [...current, modelId];
        setConfig({
            ...config,
            frontend_settings: { ...config.frontend_settings, visible_models: next }
        });
    };

    if (loading) return <div style={styles.centered}>Loading...</div>;
    if (!config) return <div style={styles.centered}>Error loading config.</div>;

    const visibleStrategies = config.frontend_settings?.visible_strategies || [];
    const visibleModels = config.frontend_settings?.visible_models || [];
    const catalogue = config.llm?.catalogue || {};

    return (
        <div style={styles.container}>
            {toast && (
                <div style={{
                    ...styles.toast,
                    backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981'
                }}>
                    {toast.msg}
                </div>
            )}

            <div style={styles.header}>
                <h2 style={styles.title}>👁️ Frontend Visibility Control</h2>
                <p style={styles.subtitle}>Choose which models and strategies are visible to end-users in the chat interface.</p>
            </div>

            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Chunking Strategies</h3>
                <div style={styles.grid}>
                    {['recursive', 'sentence', 'paragraph', 'semantic'].map(s => (
                        <label key={s} style={{
                            ...styles.card,
                            borderColor: visibleStrategies.includes(s) ? '#3b82f6' : '#e2e8f0',
                            background: visibleStrategies.includes(s) ? 'rgba(59,130,246,0.1)' : 'white'
                        }}>
                            <input
                                type="checkbox"
                                checked={visibleStrategies.includes(s)}
                                onChange={() => toggleStrategy(s)}
                                style={styles.checkbox}
                            />
                            <span style={styles.label}>{STRATEGY_LABELS[s]}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>LLM Models</h3>
                <p style={styles.sectionSub}>If none are selected, all available models will be shown.</p>
                <div style={styles.modelGrid}>
                    {Object.entries(catalogue).map(([provider, models]) => (
                        <div key={provider} style={styles.providerGroup}>
                            <h4 style={styles.providerName}>{provider.toUpperCase()}</h4>
                            <div style={styles.innerModelGrid}>
                                {models.map(([id, name]) => (
                                    <label key={id} style={{
                                        ...styles.modelCard,
                                        borderColor: visibleModels.includes(id) ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                        background: visibleModels.includes(id) ? 'rgba(59,130,246,0.1)' : 'transparent'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={visibleModels.includes(id)}
                                            onChange={() => toggleModel(id)}
                                            style={styles.checkbox}
                                        />
                                        <div style={styles.modelInfo}>
                                            <div style={styles.modelName}>{name}</div>
                                            <div style={styles.modelId}>{id}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={styles.footer}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        ...styles.saveBtn,
                        opacity: saving ? 0.7 : 1
                    }}
                >
                    {saving ? 'Saving...' : 'Save Visibility Settings'}
                </button>
            </div>
        </div>
    );
}

const styles = {
    container: { maxWidth: '900px', margin: '0 auto', padding: '1rem', color: '#1e293b' },
    centered: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#64748b' },
    header: { marginBottom: '2rem' },
    title: { fontSize: '1.5rem', fontWeight: '700', margin: '0 0 0.5rem', color: '#0f172a' },
    subtitle: { color: '#64748b', fontSize: '0.9rem' },
    section: { marginBottom: '2.5rem' },
    sectionTitle: { fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', color: '#334155' },
    sectionSub: { fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' },
    card: {
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
        borderRadius: '12px', border: '1px solid', cursor: 'pointer', transition: 'all 0.2s'
    },
    checkbox: { width: '18px', height: '18px', cursor: 'pointer' },
    label: { fontSize: '0.9rem', fontWeight: '500' },
    modelGrid: { display: 'flex', flexDirection: 'column', gap: '2rem' },
    providerGroup: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    providerName: { fontSize: '0.8rem', fontWeight: '700', color: '#3b82f6', letterSpacing: '0.05em' },
    innerModelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' },
    modelCard: {
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
        borderRadius: '10px', border: '1px solid', cursor: 'pointer', transition: 'all 0.2s'
    },
    modelInfo: { display: 'flex', flexDirection: 'column' },
    modelName: { fontSize: '0.85rem', fontWeight: '600', color: '#1e293b' },
    modelId: { fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' },
    footer: { marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' },
    saveBtn: {
        padding: '0.75rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none',
        borderRadius: '8px', fontWeight: '700', cursor: 'pointer'
    },
    toast: {
        position: 'fixed', top: '2rem', right: '2rem', padding: '1rem 1.5rem',
        borderRadius: '8px', color: 'white', fontWeight: '600', zIndex: 1000,
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
    }
};
