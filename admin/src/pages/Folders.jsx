import React from 'react';

// STYLES
const st = {
    page: { maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'Inter, sans-serif' },
    header: { marginBottom: '2rem' },
    title: { fontSize: '1.75rem', fontWeight: '700', color: '#111827', margin: '0 0 0.5rem 0' },
    subtitle: { color: '#6b7280', margin: 0 },
    card: { background: 'white', borderRadius: '12px', padding: '3rem 2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', textAlign: 'center' },
    icon: { fontSize: '4rem', marginBottom: '1rem' },
    cardTitle: { fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.75rem' },
    cardText: { color: '#6b7280', maxWidth: '500px', margin: '0 auto', lineHeight: '1.5' },
};

export default function Folders({ credentials }) {
    return (
        <div style={st.page}>
            <div style={st.header}>
                <h2 style={st.title}>📁 Enterprise Folders</h2>
                <p style={st.subtitle}>Organize papers into dedicated folders to manage access.</p>
            </div>

            <div style={st.card}>
                <div style={st.icon}>🚧</div>
                <h3 style={st.cardTitle}>Coming Soon</h3>
                <p style={st.cardText}>
                    Enterprise multi-tenancy and folder organization are currently under development.
                    Once completed, you will be able to create independent folders and assign documents to them.
                </p>
            </div>
        </div>
    );
}
