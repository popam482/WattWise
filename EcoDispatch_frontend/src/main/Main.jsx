import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Login from '../account/Login.jsx';
import Register from '../account/Register.jsx';
import Dashboard from '../dashboard/Dashboard.jsx';

function App() {
    const [user, setUser] = useState(null); // contains { id, name, userType }
    const [view, setView] = useState('login'); // login or register

    const handleLoginSuccess = (loginResponse) => {
        setUser(loginResponse.user);
    };

    const handleLogout = () => {
        setUser(null);
        setView('login');
    };

    if (user) {
        return <Dashboard userId={user.id} userType={user.userType} userName={user.name} onLogout={handleLogout} />;
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