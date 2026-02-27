import { useState } from 'react';
import { uploadPaper } from '../api';

export default function UploadModal({ isOpen, onClose, onSuccess, credentials }) {
    const [file, setFile] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [isError, setIsError] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setStatusMsg('');
        setIsError(false);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;

        setIsUploading(true);
        setStatusMsg('');
        setIsError(false);

        try {
            const res = await uploadPaper(file, credentials);
            setStatusMsg(`✅ "${res.filename}" uploaded successfully!`);
            setFile(null);
            setTimeout(() => onSuccess(), 1200); // brief pause so user sees success
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail || err.message || 'Unknown error';
            setStatusMsg(`❌ Upload failed: ${detail}`);
            setIsError(true);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3 style={styles.title}>📎 Upload Research Paper</h3>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        style={styles.closeBtn}
                        title="Close"
                    >&times;</button>
                </div>

                <form onSubmit={handleUpload} style={styles.form}>
                    <div
                        style={{
                            ...styles.dropZone,
                            borderColor: file ? 'rgba(59, 130, 246, 0.7)' : 'rgba(255,255,255,0.15)',
                            backgroundColor: file ? 'rgba(59, 130, 246, 0.06)' : 'rgba(255,255,255,0.02)',
                        }}
                    >
                        <div style={styles.dropIcon}>📄</div>
                        <label style={styles.dropLabel}>
                            {file ? file.name : 'Click to select a PDF file'}
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                required
                                style={{ display: 'none' }}
                            />
                        </label>
                        {file && (
                            <div style={styles.fileSize}>
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                        )}
                    </div>

                    {statusMsg && (
                        <div style={{
                            ...styles.statusBox,
                            background: isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                            border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                            color: isError ? '#fca5a5' : '#86efac',
                        }}>
                            {statusMsg}
                        </div>
                    )}

                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isUploading}
                            style={styles.cancelBtn}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!file || isUploading}
                            style={{
                                ...styles.uploadBtn,
                                opacity: (!file || isUploading) ? 0.6 : 1,
                                cursor: (!file || isUploading) ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {isUploading ? '⏳ Uploading…' : '⬆ Upload PDF'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)',
    },
    modal: {
        background: 'rgba(15, 23, 42, 0.98)',
        border: '1px solid rgba(255,255,255,0.15)',
        padding: '2rem',
        borderRadius: '20px',
        width: '440px',
        maxWidth: '92%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(16px)',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1.75rem',
    },
    title: { margin: 0, color: '#f8fafc', fontSize: '1.15rem', fontWeight: '700' },
    closeBtn: {
        background: 'none', border: 'none', fontSize: '1.6rem',
        cursor: 'pointer', color: '#94a3b8', padding: '0 0.25rem', lineHeight: 1,
    },
    form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
    dropZone: {
        border: '2px dashed', padding: '2rem 1.5rem',
        textAlign: 'center', borderRadius: '12px',
        cursor: 'pointer', transition: 'all 0.2s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
    },
    dropIcon: { fontSize: '2.5rem' },
    dropLabel: {
        color: '#94a3b8', fontSize: '0.95rem', cursor: 'pointer',
        display: 'block', fontWeight: '500',
    },
    fileSize: { color: '#64748b', fontSize: '0.8rem' },
    statusBox: {
        padding: '0.75rem 1rem', borderRadius: '8px',
        fontSize: '0.9rem', lineHeight: '1.4',
    },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' },
    cancelBtn: {
        padding: '0.6rem 1.25rem', cursor: 'pointer',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#cbd5e1', borderRadius: '8px', fontWeight: '600',
    },
    uploadBtn: {
        padding: '0.6rem 1.5rem',
        background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
        color: 'white', border: 'none', borderRadius: '8px',
        fontWeight: '700', fontSize: '0.9rem', transition: 'opacity 0.2s',
    },
};
