# React Admin Panel — Explanatory Doc

This folder contains a React application built with **Vite** that serves as the Admin Dashboard for `AskThePaper`.

## 📦 Packages Used

| Package | Purpose |
|---------|---------|
| `vite` | An ultra-fast build tool and development server for modern web projects. It replaces tools like Create React App (Webpack). |
| `axios` | A promise-based HTTP client. We use it instead of `fetch()` because it handles JSON automatically, throws errors on 4xx/5xx responses, and makes setting up authentication headers easier (see `src/api.js`). |
| `react-router-dom` | Handles navigation between pages without reloading the browser window (e.g. from `/login` to `/dashboard`). |

---

## 🏗️ Core Concepts (for beginners)

### 1. React State (`useState`)

React components are essentially functions that return HTML (JSX). When the data in a variable changes, we want the HTML to update automatically. We use the `useState` **hook** to achieve this.

```jsx
// From Login.jsx
const [username, setUsername] = useState('');
```
- `username` is the current value.
- `setUsername` is a function to change the value.
- *Every time* `setUsername` is called (e.g., when the user types in the input box), React **re-runs the component** and updates the UI.

### 2. Props (Passing Data)

Components can pass data to their "children" via properties (props). In `App.jsx`, we pass the `setCredentials` function to the `Login` component so it can update the overall app state when the user logs in:

```jsx
// App.jsx passing a prop:
<Login setCredentials={setCredentials} />

// Login.jsx receiving the prop:
export default function Login({ setCredentials }) { ... }
```

### 3. Protected Routes (`App.jsx`)

We don't want anyone to see the Dashboard unless they are logged in. We created a `ProtectedRoute` wrapper:

```jsx
const ProtectedRoute = ({ children }) => {
  if (!credentials) {
    return <Navigate to="/login" replace />; // Force redirect
  }
  return children; // Render the actual page (e.g. Dashboard)
};
```

---

## 🚀 How `src/api.js` works

Axios is configured with our FastAPI URL (`http://localhost:8000`).

For the **Login** endpoint, we pass the username/password in the `auth` object, which Axios converts into an `Authorization: Basic [base64 string]` header.

For the **Upload** endpoint, we must send the file using `multipart/form-data`, which is the standard way web browsers upload files. We use JavaScript's built in `FormData` object to attach the file before sending.
