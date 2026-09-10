import { useState } from "react";
import { createRoot } from "react-dom/client";
import Register from "../account/Register.jsx";
import Login from "../account/Login.jsx";

function App() {
    const [isLogin, setIsLogin] = useState(false);

    return (
        <div>
            {isLogin ? (
                <Login switchToRegister={() => setIsLogin(false)} />
            ) : (
                <Register switchToLogin={() => setIsLogin(true)} />
            )}
        </div>
    );
}

createRoot(document.getElementById("root")).render(<App />);

export default App;