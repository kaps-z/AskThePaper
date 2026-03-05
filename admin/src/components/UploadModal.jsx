import { useState, useEffect } from 'react';
import { uploadPaper, getFolders, createFolder } from '../api';

export default function UploadModal({ isOpen, onClose, onSuccess, credentials }) {
    const [files, setFiles] = useState([]);
    const [statusMsg, setStatusMsg] = useState('');
    const [isError, setIsError] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

    // Folder State
    const [folders, setFolders] = useState([]);
    const [selectedFolderId, setSelectedFolderId] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    useEffect(() => {
        if (isOpen) {
            getFolders(credentials).then(data => {
                setFolders(data);
                if (data.length > 0) setSelectedFolderId(data[0]._id);
            }).catch(e => console.error("Failed to fetch folders", e));
        }
    }, [isOpen, credentials]);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(selectedFiles);
        setStatusMsg('');
        setIsError(false);
        setUploadProgress({ current: 0, total: 0 });
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (files.length === 0) return;

        setIsUploading(true);
        setStatusMsg('');
        setIsError(false);
        setUploadProgress({ current: 0, total: files.length });

        try {
            let finalFolderId = selectedFolderId;
            if (isCreatingFolder && newFolderName.trim()) {
                const newFolder = await createFolder(newFolderName.trim(), credentials);
                finalFolderId = newFolder._id;
                setFolders([newFolder, ...folders]); // Optimistic update
            }

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < files.length; i++) {
                try {
                    setUploadProgress(p => ({ ...p, current: i + 1 }));
                    await uploadPaper(files[i], finalFolderId, credentials);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to upload ${files[i].name}`, err);
                    errorCount++;
                }
            }

            if (errorCount === 0) {
                setStatusMsg(`✅ Successfully uploaded ${successCount} document(s) to the topic!`);
            } else if (successCount > 0) {
                setStatusMsg(`⚠️ Uploaded ${successCount} document(s), but ${errorCount} failed.`);
                setIsError(true);
            } else {
                setStatusMsg(`❌ Failed to upload all ${errorCount} document(s).`);
                setIsError(true);
            }

            if (successCount > 0) {
                setFiles([]);
                setNewFolderName('');
                setIsCreatingFolder(false);
                setTimeout(() => onSuccess(), 1500); // brief pause so user sees success
            }
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail || err.message || 'Unknown error';
            setStatusMsg(`❌ Topic creation failed: ${detail}`);
            setIsError(true);
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

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
                            borderColor: files.length > 0 ? 'rgba(59, 130, 246, 0.7)' : 'rgba(255,255,255,0.15)',
                            backgroundColor: files.length > 0 ? 'rgba(59, 130, 246, 0.06)' : 'rgba(255,255,255,0.02)',
                        }}
                    >
                        <div style={styles.dropIcon}>📄</div>
                        <label style={styles.dropLabel}>
                            {files.length > 0
                                ? `${files.length} file(s) selected`
                                : 'Click to select multiple PDF files'}
                            <input
                                type="file"
                                accept="application/pdf"
                                multiple
                                onChange={handleFileChange}
                                required
                                style={{ display: 'none' }}
                            />
                        </label>
                        {files.length > 0 && (
                            <div style={styles.fileSize}>
                                Total size: {(files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600' }}>Research Topic</label>
                        {!isCreatingFolder ? (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select
                                    value={selectedFolderId}
                                    onChange={e => setSelectedFolderId(e.target.value)}
                                    style={styles.input}
                                >
                                    <option value="" disabled>-- Select a Topic --</option>
                                    {folders.map(f => (
                                        <option key={f._id} value={f._id}>{f.name}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={() => setIsCreatingFolder(true)} style={styles.addFolderBtn}>
                                    + New
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    placeholder="Topic Name (e.g. AI Safety)"
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    style={styles.input}
                                    autoFocus
                                />
                                <button type="button" onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }} style={styles.cancelFolderBtn}>
                                    Cancel
                                </button>
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
                            disabled={files.length === 0 || isUploading || (!isCreatingFolder && !selectedFolderId)}
                            style={{
                                ...styles.uploadBtn,
                                opacity: (files.length === 0 || isUploading || (!isCreatingFolder && !selectedFolderId)) ? 0.6 : 1,
                                cursor: (files.length === 0 || isUploading || (!isCreatingFolder && !selectedFolderId)) ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {isUploading ? `⏳ Uploading (${uploadProgress.current}/${uploadProgress.total})…` : '⬆ Upload PDFs'}
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
    input: {
        flex: 1, padding: '0.6rem', background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
        color: '#f8fafc', fontSize: '0.9rem', outline: 'none'
    },
    addFolderBtn: {
        padding: '0 0.75rem', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)',
        color: '#93c5fd', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'
    },
    cancelFolderBtn: {
        padding: '0 0.75rem', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
    }
};
