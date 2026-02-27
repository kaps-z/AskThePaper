import { useState } from 'react';
import { uploadPaper } from '../api';

export default function UploadModal({ isOpen, onClose, onSuccess, credentials }) {
    const [file, setFile] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    if (!isOpen) return null; // Don't render anything if the modal is closed

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setStatusMsg('');
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;

        setIsUploading(true);
        setStatusMsg('');

        try {
            await uploadPaper(file, credentials);
            // Reset state so it's clean next time it opens
            setFile(null);
            // Let the parent know it worked
            onSuccess();
        } catch (err) {
            console.error(err);
            setStatusMsg('Error uploading file.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: 'white', padding: '2rem', borderRadius: '8px',
                width: '400px', maxWidth: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>Upload Research Paper</h3>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}
                        title="Close"
                    >&times;</button>
                </div>

                <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{
                        border: '2px dashed #ccc', padding: '2rem', textAlign: 'center', borderRadius: '4px',
                        backgroundColor: '#f9fafb'
                    }}>
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                            required
                            style={{ width: '100%' }}
                        />
                    </div>

                    {statusMsg && (
                        <div style={{ color: statusMsg.startsWith('Error') ? '#ef4444' : '#10b981', background: statusMsg.startsWith('Error') ? '#fee2e2' : '#d1fae5', padding: '0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                            {statusMsg}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isUploading}
                            style={{ padding: '0.5rem 1rem', cursor: 'pointer', border: '1px solid #ccc', background: 'white', borderRadius: '4px' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!file || isUploading}
                            style={{
                                padding: '0.5rem 1rem',
                                cursor: (!file || isUploading) ? 'not-allowed' : 'pointer',
                                backgroundColor: isUploading ? '#9ca3af' : '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: '600'
                            }}
                        >
                            {isUploading ? 'Uploading...' : 'Upload PDF'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
