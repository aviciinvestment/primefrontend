import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Radar, Search, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setIsMobileMenuOpen(false);
      navigate('/');
    }
  };

  const userInitial = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';

  return (
    <nav className="border-b border-white/5 bg-[#070e0a]/70 backdrop-blur-2xl sticky top-0 z-50 w-full">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-8">
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 mr-6 group z-50">
          <div className="bg-[#84cc16] p-2.5 rounded-xl text-[#070e0a] font-bold shadow-[0_0_15px_rgba(132,204,34,0.6)] transition-transform group-hover:scale-110">
            <Radar className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-white leading-none">PrimeOpportunity</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex flex-1 items-center justify-end space-x-6">
          <div className="w-full flex-1 md:w-auto md:flex-none mr-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search opportunities..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-64 sm:focus:w-80 transition-all pl-9"
              />
            </div>
          </div>
          
          <Link to="/applications" className={`text-sm font-semibold transition-colors hover:text-white ${currentPath === '/applications' ? 'text-[#84cc16]' : 'text-gray-400'}`}>
            My Applications
          </Link>
          <Link to="/profile" className={`text-sm font-semibold transition-colors hover:text-white ${currentPath === '/profile' ? 'text-[#84cc16]' : 'text-gray-400'}`}>
            Profile
          </Link>
          {user ? (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#84cc16]/20 border border-[#84cc16]/40 text-[#84cc16] font-bold">
                  {userInitial}
                </span>
                <span className="max-w-[120px] truncate">{user.displayName || user.email?.split('@')[0]}</span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 h-10 py-2 px-4 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="inline-flex items-center justify-center rounded-xl text-sm font-bold transition-colors hover:text-white text-white h-10 py-2 px-4">
                Log in
              </Link>
              <Link to="/register" className="inline-flex items-center justify-center rounded-xl text-sm font-bold transition-all bg-[#84cc16]/20 text-[#84cc16] hover:bg-[#84cc16] hover:text-[#0a0f16] border border-[#84cc16]/50 h-10 py-2 px-6 shadow-[0_0_15px_rgba(132,204,22,0.15)]">
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <button 
          onClick={toggleMobileMenu}
          className="md:hidden inline-flex items-center justify-center rounded-md text-gray-400 hover:text-white focus:outline-none z-50 h-10 w-10"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          <span className="sr-only">Toggle Menu</span>
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-20 left-0 w-full bg-[#070e0a]/95 backdrop-blur-3xl border-b border-white/5 py-6 px-4 flex flex-col gap-6 shadow-2xl z-40">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="search"
              placeholder="Search opportunities..."
              className="flex h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:outline-none focus:border-[#84cc16]/50 pl-11"
            />
          </div>
          
          <div className="flex flex-col gap-4">
            <Link onClick={toggleMobileMenu} to="/applications" className={`text-lg font-semibold ${currentPath === '/applications' ? 'text-[#84cc16]' : 'text-gray-300'}`}>
              My Applications
            </Link>
            <Link onClick={toggleMobileMenu} to="/profile" className={`text-lg font-semibold ${currentPath === '/profile' ? 'text-[#84cc16]' : 'text-gray-300'}`}>
              Profile
            </Link>
          </div>
          
          <div className="flex flex-col gap-3 mt-4 pt-6 border-t border-white/10">
            {user ? (
              <>
                <div className="flex items-center gap-3 px-1">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#84cc16]/20 border border-[#84cc16]/40 text-[#84cc16] font-bold">
                    {userInitial}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{user.displayName || 'User'}</p>
                    <p className="text-gray-400 text-sm truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-xl text-base font-bold text-white bg-white/5 border border-white/10 h-12"
                >
                  <LogOut className="h-5 w-5" /> Log out
                </button>
              </>
            ) : (
              <>
                <Link onClick={toggleMobileMenu} to="/login" className="inline-flex items-center justify-center rounded-xl text-base font-bold text-white bg-white/5 border border-white/10 h-12">
                  Log in
                </Link>
                <Link onClick={toggleMobileMenu} to="/register" className="inline-flex items-center justify-center rounded-xl text-base font-bold bg-[#84cc16] text-[#0a0f16] h-12 shadow-[0_0_15px_rgba(132,204,22,0.3)]">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
