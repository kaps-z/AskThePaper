import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../api';

export default function Login({ setCredentials }) {
    // React State (Hooks): These variables store the current value of the input boxes.
    // Whenever the user types, `setUsername` updates `username`, and React re-renders the UI.
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    // `useNavigate` lets us programmatically change pages (e.g., go to Dashboard after login)
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault(); // Prevents the browser from refreshing the page on form submit
        setError(null);

        try {
            // Async: wait for the backend to reply
            await loginAdmin(username, password);

            // If we reach here, the backend returned 200 OK.
            // Save credentials in state and localStorage so they persist across refreshes
            const creds = { username, password };
            setCredentials(creds);
            localStorage.setItem('admin_credentials', JSON.stringify(creds));

            navigate('/dashboard');
        } catch (err) {
            setError('Invalid username or password');
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif' }}>
            <h1>AskThePaper Admin</h1>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    style={{ padding: '0.5rem' }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ padding: '0.5rem' }}
                />
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <button type="submit" style={{ padding: '0.5rem', cursor: 'pointer' }}>Login</button>
            </form>
        </div>
    );
}
