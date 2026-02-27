import { getFiles, deleteFile, processFile } from '../api';

export default function PapersList({ credentials, refreshTrigger }) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null);

    // 1. Fetch files when the component loads, AND whenever `refreshTrigger` changes
    // (e.g., when a new file finishes uploading in the parent component).
    const loadFiles = async () => {
        try {
            setLoading(true);
            const data = await getFiles(credentials);
            setFiles(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load files.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, [credentials, refreshTrigger]);

    // 2. Handle deleting a file
    const handleDelete = async (fileId) => {
        if (!window.confirm("Are you sure you want to delete this paper?")) return;

        try {
            await deleteFile(fileId, credentials);
            // Refresh the list after deleting
            loadFiles();
        } catch (err) {
            console.error(err);
            alert('Failed to delete file.');
        }
    };

    // 3. Handle triggering the processing pipeline
    const handleProcess = async (fileId) => {
        setProcessingId(fileId);
        try {
            await processFile(fileId, credentials);
            loadFiles(); // Refresh to show new status
        } catch (err) {
            console.error(err);
            alert('Failed to trigger processing.');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading && files.length === 0) return <p>Loading papers...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;

    return (
        <div style={{ marginTop: '3rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h3>Uploaded Papers ({files.length})</h3>

            {files.length === 0 ? (
                <p>No papers uploaded yet.</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Filename</th>
                            <th style={{ padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Date</th>
                            <th style={{ padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Status</th>
                            <th style={{ padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {files.map(f => (
                            <tr key={f._id}>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{f.filename}</td>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                                    {new Date(f.uploaded_at).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                                    <span style={{
                                        background: '#e0f2fe', color: '#0369a1',
                                        padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem'
                                    }}>
                                        {f.status}
                                    </span>
                                </td>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                                    <button
                                        onClick={() => handleDelete(f._id)}
                                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Delete
                                    </button>

                                    {f.status === 'uploaded' && (
                                        <button
                                            onClick={() => handleProcess(f._id)}
                                            disabled={processingId === f._id}
                                            style={{
                                                marginLeft: '0.5rem',
                                                background: '#10b981', color: 'white', border: 'none',
                                                padding: '0.3rem 0.6rem', borderRadius: '4px',
                                                cursor: processingId === f._id ? 'not-allowed' : 'pointer',
                                                opacity: processingId === f._id ? 0.7 : 1
                                            }}
                                        >
                                            {processingId === f._id ? 'Processing...' : 'Process'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
