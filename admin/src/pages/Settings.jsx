import { useState, useEffect } from 'react';
import { getConfig, updateConfig } from '../api';

export default function Settings({ credentials }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    // 1. Fetch system config on load
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const data = await getConfig(credentials);
                setConfig(data);
            } catch (err) {
                setStatusMsg('Error loading config. Is the seeder run?');
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [credentials]);

    // 2. Handle form submission to update config
    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setStatusMsg('');

        try {
            // The API expects this flat structure for the update bodies
            const updateData = {
                chunking: config.chunking.active,
                embedding: config.embedding.active,
                evaluation: config.evaluation.active
            };

            await updateConfig(updateData, credentials);
            setStatusMsg('Settings saved successfully!');
        } catch (err) {
            console.error(err);
            setStatusMsg('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    // 3. Helper to update the state when a dropdown changes
    const handleChange = (section, newValue) => {
        setConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                active: newValue
            }
        }));
    };

    if (loading) return <div style={{ padding: '2rem' }}>Loading settings...</div>;
    if (!config) return <div style={{ padding: '2rem', color: 'red' }}>{statusMsg}</div>;

    return (
        <div style={{ maxWidth: '600px', margin: '50px auto', fontFamily: 'sans-serif' }}>
            <h2>System Strategy Settings</h2>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
                Configure which embedding and chunking models the backend pipeline will use.
            </p>

            <div style={{ border: '1px solid #ccc', padding: '2rem', borderRadius: '8px' }}>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Chunking Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 'bold' }}>Chunking Strategy</label>
                        <select
                            value={config.chunking.active}
                            onChange={(e) => handleChange('chunking', e.target.value)}
                            style={{ padding: '0.5rem', width: '100%' }}
                        >
                            {config.chunking.options.map(opt => (
                                <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    {/* Embedding Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 'bold' }}>Embedding Model</label>
                        <select
                            value={config.embedding.active}
                            onChange={(e) => handleChange('embedding', e.target.value)}
                            style={{ padding: '0.5rem', width: '100%' }}
                        >
                            {config.embedding.options.map(opt => (
                                <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    {/* Evaluation Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 'bold' }}>Evaluation Framework</label>
                        <select
                            value={config.evaluation.active}
                            onChange={(e) => handleChange('evaluation', e.target.value)}
                            style={{ padding: '0.5rem', width: '100%' }}
                        >
                            {config.evaluation.options.map(opt => (
                                <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            marginTop: '1rem',
                            padding: '0.8rem',
                            background: '#0ea5e9',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </form>

                {statusMsg && (
                    <p style={{
                        marginTop: '1rem',
                        fontWeight: 'bold',
                        color: statusMsg.includes('Failed') ? 'red' : 'green'
                    }}>
                        {statusMsg}
                    </p>
                )}
            </div>
        </div>
    );
}
