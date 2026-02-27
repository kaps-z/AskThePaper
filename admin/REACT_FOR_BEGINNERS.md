# React for Beginners — AskThePaper Admin Panel

Welcome to React! If you're new to frontend development, React can feel weird because it mixes HTML directly inside JavaScript (called **JSX**).

Here is a plain-English breakdown of everything happening in our Admin Panel (`admin/src/`).

---

## 1. What is React?

React is a library for building User Interfaces (UI). Instead of writing one massive HTML file, you build **Components** — reusable pieces of UI (like a Lego block). 

In our project:
- `<App />` is the main block that holds everything.
- `<Login />` is a block for the login screen.
- `<Dashboard />` is a block for the upload screen.

---

## 2. JSX: HTML inside JavaScript

If you look at `Login.jsx`, you'll see a function returning HTML:

```jsx
export default function Login() {
  return (
    <div>
      <h1>AskThePaper Admin</h1>
    </div>
  );
}
```

This is **JSX**. It looks exactly like HTML, but under the hood, Vite converts it into raw JavaScript. 

> **Important Rule:** In normal HTML, you use `class="btn"`. In JSX, you MUST use `className="btn"` because `class` is a reserved keyword in JavaScript.

---

## 3. React State (`useState`)

If a variable in your app changes (like text typed into an input box), you want the UI to update instantly. Regular variables (`let name = "John"`) **do not** trigger UI updates in React.

To make the UI update, we use **State**.

```jsx
import { useState } from 'react';

// 1. username: the current value (starts as an empty string '')
// 2. setUsername: the function you MUST use to change the value
const [username, setUsername] = useState('');
```

### How we use it in forms

When the user types in the input box, the `onChange` event fires. We grab the text the user typed (`e.target.value`) and pass it to `setUsername()`. **React instantly re-renders the component with the new text.**

```jsx
<input 
  value={username} 
  onChange={(e) => setUsername(e.target.value)} 
/>
```

---

## 4. Props (Passing Data)

Components often need to talk to each other. We do this by passing **Props** (Properties) from a Parent to a Child.

Think of it like passing arguments to a function.

**Parent (`App.jsx`):**
```jsx
// App has a state called `credentials`. 
// It passes the `setCredentials` function down to Login.
<Login setCredentials={setCredentials} />
```

**Child (`Login.jsx`):**
```jsx
// Login "catches" the prop in its function arguments
export default function Login({ setCredentials }) {
   
   const handleLogin = () => {
       // Now Login can change the Parent's state!
       setCredentials({ username: 'admin', password: 'password' });
   }
}
```

---

## 5. React Router (`react-router-dom`)

In older websites, clicking a link meant downloading a whole new HTML page from the server. React is a **Single Page Application (SPA)** — the browser downloads one HTML file, and React just visually swaps out the components to mimic changing pages.

We use `react-router-dom` in `App.jsx` to define the rules:

```jsx
<Routes>
  {/* If the URL is localhost:5173/login, show the <Login /> component */}
  <Route path="/login" element={<Login />} />
  
  {/* If the URL is localhost:5173/dashboard, show the <Dashboard /> component */}
  <Route path="/dashboard" element={<Dashboard />} />
</Routes>
```

---

## 6. The `useEffect` Hook (Coming in the File CRM)

`useState` is for variables. What about **actions** you want to run exactly once when a page loads (like fetching the list of uploaded files from the backend)?

For that, we use the **`useEffect`** hook.

```jsx
import { useEffect, useState } from 'react';

export default function PapersList() {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    // This code runs AUTOMATICALLY as soon as the component appears on screen.
    api.getFiles().then(data => {
      setFiles(data); // Save the backend data into state
    });

  }, []); // <-- This empty array means "only run this ONCE when the component loads"
  
  return <div>Loaded {files.length} files.</div>;
}
```

---

## Summary Cheat Sheet

| React Term | Plain English | Example |
|------------|---------------|---------|
| **Component** | A custom HTML tag that returns UI. | `<Login />` |
| **JSX** | Writing HTML inside JS. | `return <h1>Hello</h1>;` |
| **State (`useState`)** | A tracked variable. If it changes, the UI updates. | `const [count, setCount] = useState(0);` |
| **Props** | Passing data from a Parent component to a Child. | `<Child name="Kapil" />` |
| **`useEffect`** | Running code automatically when the page loads. | `useEffect(() => fetchThings(), []);` |
