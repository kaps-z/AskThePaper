import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({ isOpen, toggleSidebar }) {
    const location = useLocation();

    const linkStyle = (path) => ({
        display: 'block',
        padding: '1rem',
        color: 'white',
        textDecoration: 'none',
        backgroundColor: location.pathname === path ? '#374151' : 'transparent',
        borderLeft: location.pathname === path ? '4px solid #3b82f6' : '4px solid transparent',
    });

    return (
        <div style={{
            width: isOpen ? '250px' : '0px',
            overflow: 'hidden',
            transition: 'width 0.3s ease',
            backgroundColor: '#1f2937',
            height: '100%',
            minHeight: '100vh',
            flexShrink: 0
        }}>
            <div style={{ padding: '1rem 0' }}>
                <Link to="/dashboard" style={linkStyle('/dashboard')}>
                    📄 Files Dashboard
                </Link>
                <Link to="/settings" style={linkStyle('/settings')}>
                    ⚙️ Pipeline Settings
                </Link>
                <Link to="/visibility" style={linkStyle('/visibility')}>
                    👁️ Settings
                </Link>
            </div>
        </div>
    );
}
