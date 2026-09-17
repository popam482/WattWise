import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Login from '../account/Login.jsx';
import Register from '../account/Register.jsx';
import Dashboard from '../dashboard/Dashboard.jsx';

function App() {
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user');
        if (!savedUser) return null;

        try {
            const storedUser = JSON.parse(savedUser);
            return storedUser?.user ?? storedUser;
        } catch {
            localStorage.removeItem('user');
            return null;
        }
    });
    const [view, setView] = useState('login');

    const handleLoginSuccess = (userData) => {
        const loggedInUser = userData?.user ?? userData;
        setUser(loggedInUser);
        localStorage.setItem('user', JSON.stringify(loggedInUser));

        if (userData?.token) {
            localStorage.setItem('token', userData.token);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setView('login');
    };

    if (user) {
        return (
            <Dashboard
                userId={user.id}
                userType={user.userType}
                userName={user.name}
                onLogout={handleLogout}
            />
        );
    }

    return (
        <div className="app-container">
            {view === 'login' ? (
                <Login
                    onLoginSuccess={handleLoginSuccess}
                    switchToRegister={() => setView('register')}
                />
            ) : (
                <Register
                    switchToLogin={() => setView('login')}
                />
            )}
        </div>
    );
}

export default App;

createRoot(document.getElementById('root')).render(<App />);