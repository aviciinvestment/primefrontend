import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import ChatWidget from './components/ChatWidget';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-[#070e0a] font-sans antialiased text-white relative">
          {/* Subtle Ambient Green Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-[#070e0a]/50 to-[#070e0a] pointer-events-none z-0"></div>

          {/* Global Grid Line Pattern - Faint Green */}
          <div 
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(132, 204, 34, 0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(132, 204, 34, 0.05) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px'
            }}
          ></div>

          <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col">
            <Navbar />
            <main className="container mx-auto py-6 px-4 md:px-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              </Routes>
            </main>
            <ChatWidget />
          </div>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
