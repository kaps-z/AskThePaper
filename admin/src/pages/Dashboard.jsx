import { useState } from 'react';
import PapersList from '../components/PapersList';
import UploadModal from '../components/UploadModal';

export default function Dashboard({ credentials }) {
    // This state controls whether the Upload Modal is visible
    const [isModalOpen, setIsModalOpen] = useState(false);

    // This state triggers a re-render in PapersList when an upload succeeds
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleUploadSuccess = () => {
        setIsModalOpen(false);
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Files Dashboard</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        cursor: 'pointer', padding: '0.6rem 1.2rem',
                        background: '#2563eb', color: 'white',
                        border: 'none', borderRadius: '4px', fontWeight: 'bold'
                    }}
                >
                    + Upload Paper
                </button>
            </div>

            {/* Table to display and delete uploaded files */}
            <PapersList credentials={credentials} refreshTrigger={refreshTrigger} />

            {/* The Overlay Modal for Uploading */}
            <UploadModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleUploadSuccess}
                credentials={credentials}
            />
        </div>
    );
}

