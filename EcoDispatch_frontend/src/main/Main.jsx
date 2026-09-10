import { createRoot } from "react-dom/client";
import Register from "../account/Register.jsx";

function App() {
    return <Register />;
}

createRoot(document.getElementById("root")).render(<App />);

export default App;