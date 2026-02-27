import { useNavigate } from 'react-router-dom';

export default function Navbar({ setCredentials, toggleSidebar }) {
    const navigate = useNavigate();

    const handleLogout = () => {
        setCredentials(null);
        localStorage.removeItem('admin_credentials');
        navigate('/login');
    };

    return (
        <nav style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            backgroundColor: '#111827',
            color: 'white',
            borderBottom: '1px solid #374151',
            height: '64px',
            boxSizing: 'border-box'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    onClick={toggleSidebar}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        padding: '0'
                    }}
                >
                    ☰
                </button>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '0.5px' }}>
                    AskThePaper<span style={{ color: '#3b82f6', marginLeft: '4px' }}>Admin</span>
                </div>
            </div>

            <div>
                <button
                    onClick={handleLogout}
                    style={{
                        cursor: 'pointer',
                        padding: '0.4rem 1rem',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: '600'
                    }}
                >
                    Logout
                </button>
            </div>
        </nav>
    );
}
