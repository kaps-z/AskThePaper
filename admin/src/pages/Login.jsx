import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../api';

export default function Login({ setCredentials }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await loginAdmin(username, password);
            const creds = { username, password };
            setCredentials(creds);
            localStorage.setItem('admin_credentials', JSON.stringify(creds));
            navigate('/dashboard');
        } catch (err) {
            setError('Invalid username or password');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* Background Blob Decorations */}
            <div style={styles.blob1} />
            <div style={styles.blob2} />

            <div style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.logoIcon}>📄</div>
                    <h1 style={styles.title}>AskThePaper</h1>
                    <p style={styles.subtitle}>Admin Ingestion Portal</p>
                </div>

                <form onSubmit={handleLogin} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Username</label>
                        <input
                            type="text"
                            placeholder="e.g. admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={styles.input}
                        />
                    </div>

                    {error && (
                        <div style={styles.errorBadge}>
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            ...styles.button,
                            ...(isSubmitting ? styles.buttonDisabled : {})
                        }}
                    >
                        {isSubmitting ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <div style={styles.footer}>
                    <p>© 2026 Research Labs — Authorized Access Only</p>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        fontFamily: "'Inter', -apple-system, blinkmacsystemfont, sans-serif",
        position: 'relative',
        overflow: 'hidden',
    },
    blob1: {
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'rgba(37, 99, 235, 0.2)',
        filter: 'blur(100px)',
        borderRadius: '50%',
        top: '-100px',
        left: '-100px',
    },
    blob2: {
        position: 'absolute',
        width: '300px',
        height: '300px',
        background: 'rgba(79, 70, 229, 0.15)',
        filter: 'blur(80px)',
        borderRadius: '50%',
        bottom: '-50px',
        right: '-50px',
    },
    card: {
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        margin: '1rem',
    },
    header: {
        textAlign: 'center',
        marginBottom: '2rem',
    },
    logoIcon: {
        fontSize: '3rem',
        marginBottom: '0.5rem',
    },
    title: {
        fontSize: '1.8rem',
        fontWeight: '800',
        color: '#f8fafc',
        margin: 0,
        letterSpacing: '-0.025em',
    },
    subtitle: {
        fontSize: '0.9rem',
        color: '#94a3b8',
        marginTop: '0.25rem',
        fontWeight: '500',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.85rem',
        fontWeight: '600',
        color: '#cbd5e1',
        marginLeft: '4px',
    },
    input: {
        padding: '0.875rem 1rem',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        fontSize: '1rem',
        outline: 'none',
        transition: 'all 0.2s',
    },
    errorBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        color: '#fca5a5',
        padding: '0.75rem',
        borderRadius: '12px',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    button: {
        marginTop: '0.5rem',
        padding: '0.875rem',
        borderRadius: '12px',
        border: 'none',
        background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 100%)',
        color: 'white',
        fontSize: '1rem',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'transform 0.1s, opacity 0.2s',
        boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
    },
    buttonDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed',
        boxShadow: 'none',
    },
    footer: {
        marginTop: '2rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        paddingTop: '1.5rem',
    },
    footerText: {
        fontSize: '0.75rem',
        color: '#64748b',
        fontWeight: '500',
    }
};
