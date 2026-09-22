import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Contrast,
  LogOut,
  Menu,
  Moon,
  Palette,
  Radar,
  Search,
  Sparkles,
  Sun,
  X,
  ChevronDown,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { type ThemeId } from '../../lib/theme';

const PERSONAL_THEMES: Array<{ id: ThemeId; label: string; icon: LucideIcon }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'midnight', label: 'Midnight', icon: Contrast },
];

function ThemeMenuItems({ onPick }: { onPick?: () => void }) {
  const { preference, setPreference } = useTheme();
  return (
    <div className="px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
        <Palette className="h-3 w-3" /> Theme
      </p>
      <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-1.5">
        {PERSONAL_THEMES.map(({ id, label, icon: Icon }) => {
          const active = preference === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPreference(id);
                onPick?.();
              }}
              aria-pressed={active}
              title={label}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-semibold transition-colors ${
                active
                  ? 'border-brand-solid/50 bg-brand/10 text-brand'
                  : 'border-white/10 bg-white/[0.04] text-gray-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          setPreference('platform');
          onPick?.();
        }}
        className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${
          preference === 'platform' ? 'text-brand' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {preference === 'platform' ? 'Following platform theme' : 'Follow platform theme'}
      </button>
    </div>
  );
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const { theme } = useTheme();
  const AppliedThemeIcon = theme === 'light' ? Sun : theme === 'midnight' ? Contrast : Moon;

  // Search drives the dashboard feed via ?q= in the URL, so the Navbar input
  // stays in sync with whatever query is currently active.
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');

  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
  }, [searchParams]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Close the user dropdown on any outside click / route change. The trigger
  // button stops propagation so clicking it toggles instead of instantly closing.
  useEffect(() => {
    if (!isUserMenuOpen && !isThemeMenuOpen) return;
    const close = () => {
      setIsUserMenuOpen(false);
      setIsThemeMenuOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [isUserMenuOpen, isThemeMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    setIsThemeMenuOpen(false);
  }, [location.pathname]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    navigate(term ? `/?q=${encodeURIComponent(term)}` : '/');
    setIsMobileMenuOpen(false);
  };

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
    <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-canvas/85 backdrop-blur-md">
      <div className="section-shell flex h-16 items-center justify-between md:h-20">

        {/* Logo */}
        <Link to="/" className="focus-ring group z-50 mr-6 flex items-center gap-3 rounded-lg">
          <div className="rounded-xl bg-brand-solid p-2.5 text-[#0d1308] font-bold shadow-[0_0_15px_rgba(132,204,34,0.6)] transition-all duration-200 group-hover:scale-110 group-active:scale-95">
            <Radar className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl leading-none font-extrabold tracking-tight text-white">PrimeOpportunity</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden flex-1 items-center justify-end space-x-6 md:flex">
          <div className="mr-2 min-w-0 w-full flex-1 md:w-64 md:flex-none">
            <form onSubmit={handleSearchSubmit} className="relative" role="search">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search opportunities..."
                aria-label="Search opportunities"
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-4 text-sm text-white transition-all duration-200 placeholder:text-gray-500 focus:border-brand-solid/50 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </form>
          </div>

          {[
            { to: '/applications', label: 'Application', show: !!user },
            { to: '/mentors', label: 'Mentors', show: !!user },
            { to: '/admin', label: 'Admin', show: isAdmin },
          ].filter(l => l.show !== false).map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`focus-ring rounded-lg px-1 py-2 text-sm font-semibold transition-colors duration-200 ${
                currentPath === link.to ? 'text-brand' : 'text-gray-400 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsUserMenuOpen(v => !v); }}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
                className={`focus-ring flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-semibold text-gray-300 transition-colors ${
                  isUserMenuOpen ? 'border-white/20 bg-white/[0.06] text-white' : 'border-transparent hover:bg-white/[0.05]'
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-solid/40 bg-brand/20 font-bold text-brand">
                  {userInitial}
                </span>
                <span className="max-w-[130px] truncate">{user.displayName || user.email?.split('@')[0]}</span>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <div role="menu" className="absolute top-full right-0 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-2xl">
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setIsUserMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/[0.05] ${
                      currentPath === '/profile' ? 'text-brand' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    <UserIcon className="h-4 w-4" /> Profile
                  </Link>
                  <div className="h-px bg-white/10" />
                  <ThemeMenuItems />
                  <div className="h-px bg-white/10" />
                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-400/10"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsThemeMenuOpen(v => !v); }}
                  aria-expanded={isThemeMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Change theme"
                  title="Change theme"
                  className={`focus-ring flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                    isThemeMenuOpen || theme !== 'dark'
                      ? 'border-brand-solid/40 bg-brand/15 text-brand'
                      : 'border-white/10 bg-white/[0.04] text-gray-400 hover:text-white'
                  }`}
                >
                  <AppliedThemeIcon className="h-4 w-4" />
                </button>
                {isThemeMenuOpen && (
                  <div role="menu" className="absolute top-full right-0 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-2xl">
                    <ThemeMenuItems />
                  </div>
                )}
              </div>
              <Link
                to="/login"
                className="btn-primary h-10 px-5"
              >
                Log in
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          onClick={toggleMobileMenu}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-nav"
          className="focus-ring z-50 flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-all hover:text-white active:scale-90 md:hidden"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          <span className="sr-only">Toggle Menu</span>
        </button>
      </div>

      {/* Mobile Nav Dropdown — solid surface (no backdrop blur over scrolling
          content, keeps low-end devices smooth) */}
      {isMobileMenuOpen && (
        <div id="mobile-nav" className="absolute top-16 right-0 left-0 z-40 flex flex-col gap-2 border-b border-white/5 bg-canvas/[0.98] px-4 py-5 shadow-2xl md:hidden sm:px-6">
          <form onSubmit={handleSearchSubmit} role="search" className="mb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search opportunities..."
                aria-label="Search opportunities"
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-11 pr-4 text-base text-white placeholder:text-gray-500 focus:border-brand-solid/50 focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </div>
          </form>

          <div className="flex flex-col">
            {[
              { to: '/applications', label: 'Application', show: !!user },
              { to: '/mentors', label: 'Mentors', show: !!user },
              { to: '/admin', label: 'Admin', show: isAdmin },
              { to: '/profile', label: 'Profile', show: !!user },
            ].filter(l => l.show !== false).map(link => (
              <Link
                key={link.to}
                onClick={toggleMobileMenu}
                to={link.to}
                className={`focus-ring rounded-xl px-3 py-3 text-lg font-semibold transition-colors ${
                  currentPath === link.to ? 'text-brand' : 'text-gray-300 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-3 border-t border-white/10">
            <div className="-mx-4 pt-1">
              <ThemeMenuItems />
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-5">
            {user ? (
              <>
                <div className="flex items-center gap-3 px-1">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-solid/40 bg-brand/20 font-bold text-brand">
                    {userInitial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{user.displayName || 'User'}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="btn-secondary h-12 text-base">
                  <LogOut className="h-5 w-5" /> Log out
                </button>
              </>
            ) : (
              <>
                <Link onClick={toggleMobileMenu} to="/login" className={`${currentPath === '/login' ? 'btn-primary' : 'btn-secondary'} h-12 text-base`}>Log in</Link>
                <Link onClick={toggleMobileMenu} to="/register" className={`${currentPath === '/register' ? 'btn-primary' : 'btn-secondary'} h-12 text-base`}>Sign up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
