import { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  BrainCircuit, 
  Building2, 
  Clock, 
  Globe, 
  ArrowRight,
  Book,
  Library,
  Microscope,
  Palette,
  Filter,
  Bookmark,
  UploadCloud,
  X,
  Loader2,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import MarkdownView from '../components/MarkdownView';
export interface Opportunity {
  _id: string;
  title: string;
  organization: string;
  category: string;
  location: string;
  deadline: string;
  opportunityType: string;
  tags?: string[];
  officialUrl?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  
  // AI CV Advisor State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiMatches, setAiMatches] = useState<Opportunity[]>([]);
  // Saved CV state (persisted in MongoDB per user)
  const [latestCv, setLatestCv] = useState<{ analysis: string; matches: Opportunity[] } | null>(null);
  const [cvFilterActive, setCvFilterActive] = useState(false);
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const programsRef = useRef<HTMLDivElement>(null);

  const scrollToPrograms = () => {
    programsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const openModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOpen(true);
  };

  // Mobile Filter Toggle
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  // Typewriter Effect State
  const fullText = "Find Your Next\nCareer Opportunity";
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let i = 0;
    const intervalId = setInterval(() => {
      setDisplayedText(fullText.substring(0, i + 1));
      i++;
      if (i > fullText.length + 30) {
        i = 0; // Reset after a pause to loop continuously
      }
    }, 70); // Typing speed
    return () => clearInterval(intervalId);
  }, []);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Filter States
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  
  // Sort State
  const [sortBy, setSortBy] = useState('Best Match');
  const [isSortOpen, setIsSortOpen] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setAiAnalysis(null);
    setAiMatches([]);

    const formData = new FormData();
    formData.append('cv', file);
    if (user) {
      formData.append('userId', user.uid);
      formData.append('userEmail', user.email || '');
      formData.append('userName', user.displayName || '');
    }

    try {
      const response = await fetch('http://localhost:5000/api/ai/analyze-cv', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (data.success) {
        setAiAnalysis(data.analysis);
        setAiMatches(data.matches);
        setLatestCv({ analysis: data.analysis, matches: data.matches });
        setCvFilterActive(true);
        // Clear existing opportunities and show AI matches
        setOpportunities(data.matches);
        setHasMore(false); // Disable pagination when showing AI matches
      } else {
        openModal('Upload Failed', data.message || 'Failed to analyze CV. Please try again.');
      }
    } catch (error) {
      console.error('Error uploading CV:', error);
      openModal('Error', 'An error occurred while uploading your CV. Please try again.');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const cleanText = (text: string | undefined | null) => {
    if (!text) return '';
    return text.toString()
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/-/g, ' ')
      .trim();
  };

  const formatDeadline = (dateString: string | undefined | null) => {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const fetchOpportunities = async (pageNum: number, types: string[] = selectedTypes, levels: string[] = selectedLevels, sort: string = sortBy) => {
    try {
      setLoading(true);
      let url = `http://localhost:5000/api/opportunities?page=${pageNum}&limit=50`;
      
      if (types.length > 0) {
        url += `&type=${types.join(',')}`;
      }
      
      if (sort === 'Newest') {
        url += `&sort=newest`;
      } else if (sort === 'Deadline Approaching') {
        url += `&sort=deadline`;
      }
      
      if (levels.length > 0) {
        // Map UI levels to Backend categories
        const categoryMap: any = {
          'Final-Year': 'Final-Year Undergraduate',
          'Graduate-Only': 'Graduate-Only',
          'Recent Graduate': 'Graduate-Only',
          'Undergraduate': 'Final-Year Undergraduate',
          'Postgraduate': 'Graduate-Only'
        };
        const mappedCategory = categoryMap[levels[0]] || '';
        if (mappedCategory) url += `&category=${mappedCategory}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (pageNum === 1) {
          setOpportunities(data.data);
        } else {
          setOpportunities(prev => [...prev, ...data.data]);
        }
        setHasMore(data.page < data.pages);
      }
    } catch (error) {
      console.error('Failed to fetch opportunities', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities(1, selectedTypes, selectedLevels, sortBy);
  }, [selectedTypes, selectedLevels, sortBy]);

  // Restore the user's most recent saved CV + matches from MongoDB on load
  useEffect(() => {
    const loadSavedCV = async () => {
      if (!user) return;
      try {
        const res = await fetch(`http://localhost:5000/api/ai/my-cvs?userId=${encodeURIComponent(user.uid)}`);
        const data = await res.json();
        if (data.success && data.cvs.length > 0) {
          const latest = data.cvs[0];
          setLatestCv({ analysis: latest.analysis, matches: latest.matches });
        }
      } catch (error) {
        console.error('Failed to load saved CV:', error);
      }
    };
    loadSavedCV();
  }, [user]);

  const handleCvFilterToggle = () => {
    if (!user) {
      openModal('Login Required', 'Please log in to upload a CV and get personalized matches.');
      return;
    }
    if (!latestCv) {
      openModal('No CV Found', 'Upload your CV first to get personalized matches.');
      fileInputRef.current?.click();
      return;
    }
    if (cvFilterActive) {
      // Clear the CV match filter → back to the full feed
      setCvFilterActive(false);
      setAiAnalysis(null);
      setAiSummaryOpen(false);
      setPage(1);
      fetchOpportunities(1, selectedTypes, selectedLevels, sortBy);
    } else {
      // Apply the saved CV matches and show the formatted summary in a modal
      setCvFilterActive(true);
      setAiAnalysis(latestCv.analysis);
      setOpportunities(latestCv.matches);
      setHasMore(false); // Disable pagination when showing AI matches
      setAiSummaryOpen(true);
    }
  };

  const handleToggleAiSummary = () => {
    // Turning the AI summary toggle off clears the CV match view
    setCvFilterActive(false);
    setAiAnalysis(null);
    setAiSummaryOpen(false);
    setPage(1);
    fetchOpportunities(1, selectedTypes, selectedLevels, sortBy);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchOpportunities(nextPage, selectedTypes, selectedLevels, sortBy);
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    setPage(1);
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedTypes([]);
    setSelectedLevels([]);
    setPage(1);
  };

  const FiltersContent = () => (
    <>
      <div className="flex items-center justify-between mb-2 pb-4 border-b border-white/10">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" /> Filters
        </h2>
        <button onClick={handleResetFilters} className="text-xs text-primary font-medium hover:underline">Reset</button>
      </div>
      
      <div className="space-y-6">
        <div>
          <h3 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">Opportunity Type</h3>
          <div className="space-y-2">
            {['Scholarship', 'Internship', 'Graduate Trainee', 'Fellowship'].map(type => (
              <label key={type} className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={selectedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  className="w-4 h-4 rounded border-gray-600 text-primary focus:ring-primary accent-primary bg-[#1e1e1e]" 
                />
                <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">{type}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">Education Level</h3>
          <div className="space-y-2">
            {['Undergraduate', 'Final-Year', 'Recent Graduate', 'Postgraduate'].map(level => (
              <label key={level} className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={selectedLevels.includes(level)}
                  onChange={() => toggleLevel(level)}
                  className="w-4 h-4 rounded border-gray-600 text-primary focus:ring-primary accent-primary bg-[#1e1e1e]" 
                />
                <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">{level}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const AiAdvisorCard = () => (
    user ? (
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-primary rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="h-5 w-5 sm:h-6 sm:w-6" />
            <h3 className="font-bold text-base sm:text-lg">AI Career Advisor</h3>
          </div>
          <p className="text-white/80 text-xs sm:text-sm mb-4">
            Upload your CV (PDF) and our AI will analyze your profile to find perfect matches.
          </p>
          
          <input 
            type="file" 
            accept=".pdf" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="bg-[#84cc16] text-[#070e0a] font-bold py-2.5 px-4 rounded-lg text-sm hover:bg-[#84cc16]/90 transition-colors w-full flex items-center justify-center gap-2 disabled:opacity-70 shadow-[0_0_20px_rgba(132,204,22,0.4)]"
          >
            {isAnalyzing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing CV...</>
            ) : (
              <><UploadCloud className="h-4 w-4" /> Upload CV</>
            )}
          </button>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <BrainCircuit className="h-32 w-32" />
        </div>
      </div>
    ) : (
      <div className="bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-primary/20 rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden border border-white/10">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="h-5 w-5 sm:h-6 sm:w-6" />
            <h3 className="font-bold text-base sm:text-lg">AI Career Advisor</h3>
          </div>
          <p className="text-white/80 text-xs sm:text-sm mb-4">
            Upload your CV (PDF) and our AI will analyze your profile to find perfect matches.
          </p>
          <button 
            onClick={() => window.location.href = '/login'}
            className="bg-white/10 text-white font-bold py-2.5 px-4 rounded-lg text-sm hover:bg-white/20 transition-colors w-full flex items-center justify-center gap-2 border border-white/20"
          >
            Log in to Upload CV
          </button>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <BrainCircuit className="h-32 w-32" />
        </div>
      </div>
    )
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-10">
      
      {/* Hero Section */}
      <div className="relative rounded-[2rem] bg-white/[0.02] backdrop-blur-[50px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden flex flex-col md:flex-row items-center isolate min-h-[70vh] sm:min-h-[90vh] md:min-h-screen">
        
        {/* Falling Background Icons */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          <GraduationCap className="absolute left-[10%] w-12 h-12 text-[#84cc16]/40 animate-fall-1" />
          <Book className="absolute left-[30%] w-8 h-8 text-[#84cc16]/30 animate-fall-2" />
          <Library className="absolute left-[50%] w-14 h-14 text-white/20 animate-fall-3" />
          <Microscope className="absolute left-[70%] w-10 h-10 text-[#84cc16]/30 animate-fall-4" />
          <Palette className="absolute left-[85%] w-12 h-12 text-white/20 animate-fall-5" />
        </div>

        {/* Left Content */}
        <div className="relative z-10 p-6 sm:p-8 md:p-12 lg:p-16 flex-1 text-left">
          
          {/* Target Reticle "Hello There" */}
          <div className="relative inline-flex items-center gap-2 px-4 sm:px-6 py-2 bg-[#84cc16]/10 border border-[#84cc16]/30 text-[#84cc16] font-bold text-xs sm:text-sm md:text-base tracking-widest uppercase shadow-[0_0_15px_rgba(132,204,22,0.15)] rounded-sm w-fit">
            <svg className="absolute -top-2 -left-2 w-4 h-4 text-[#84cc16]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M4 10V4h6" /></svg>
            <svg className="absolute -top-2 -right-2 w-4 h-4 text-[#84cc16]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M20 10V4h-6" /></svg>
            <svg className="absolute -bottom-2 -left-2 w-4 h-4 text-[#84cc16]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M4 14v6h6" /></svg>
            <svg className="absolute -bottom-2 -right-2 w-4 h-4 text-[#84cc16]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M20 14v6h-6" /></svg>
            <span className="relative flex h-2 w-2 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#84cc16] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#84cc16]"></span>
            </span>
            Hello There!
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight min-h-[80px] sm:min-h-[100px] md:min-h-[140px]">
            {displayedText.split('\n')[0]} <br />
            <span className="text-[#84cc16]">{displayedText.split('\n')[1] || ""}</span>
            <span className="animate-pulse font-light text-[#84cc16]">|</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg md:text-xl max-w-lg leading-relaxed">
            Discover tailored scholarships, internships, and graduate programs designed for Nigerian students and early-career professionals.
          </p>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <button
              onClick={() => {
                if (user) {
                  scrollToPrograms();
                } else {
                  navigate('/login');
                }
              }}
              className="bg-[#84cc16] text-[#070e0a] font-extrabold py-3 sm:py-4 px-6 sm:px-8 rounded-full hover:bg-[#84cc16]/90 transition-all shadow-[0_0_30px_rgba(132,204,34,0.5)] scale-105 text-sm sm:text-base"
            >
              Get Started
            </button>
            <button
              onClick={scrollToPrograms}
              className="glass-card border-white/20 text-white font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-full hover:bg-white/10 transition-colors backdrop-blur-md text-sm sm:text-base"
            >
              Explore Programs
            </button>
          </div>
        </div>

        {/* Right Content / Image Area */}
        <div className="relative z-10 w-full md:w-[45%] h-[250px] sm:h-[350px] md:h-[500px] flex items-center justify-center p-4 md:p-8 mt-4 md:mt-0">
          <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-[450px] md:h-[450px] flex items-center justify-center">
            <div className="absolute inset-2 md:inset-4 bg-[#84cc16] animate-blob z-0 shadow-[0_0_40px_rgba(132,204,22,0.4)] overflow-hidden flex items-end justify-center">
              <img 
                src="/student_cutout_v2.png" 
                alt="Student Hero" 
                className="w-full h-[110%] object-cover object-top animate-drop-in drop-shadow-2xl translate-y-4 md:translate-y-0 contrast-[1.08] saturate-110"
              />
            </div>
          </div>

          {/* 4 Floating Tags */}
          <div className="absolute top-4 sm:top-8 right-4 sm:right-8 glass-card bg-black/20 text-white font-semibold py-1.5 sm:py-2 px-3 sm:px-4 rounded-full flex items-center gap-2 animate-float-1 border-white/5 text-xs sm:text-sm">
            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#84cc16]" />
            Scholarships
          </div>
          
          <div className="absolute bottom-12 sm:bottom-16 left-2 sm:left-4 glass-card bg-black/20 text-white font-semibold py-1.5 sm:py-2 px-3 sm:px-4 rounded-full flex items-center gap-2 animate-float-2 border-white/5 text-xs sm:text-sm">
            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#84cc16]" />
            Internships
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 -left-4 sm:-left-6 md:-left-12 glass-card bg-black/20 text-white font-semibold py-1.5 sm:py-2 px-3 sm:px-4 rounded-full flex items-center gap-2 animate-float-3 z-20 border-white/5 text-xs sm:text-sm">
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#84cc16]" />
            Local Roles
          </div>

          <div className="absolute bottom-2 sm:bottom-4 right-8 sm:right-12 md:right-20 glass-card bg-black/20 text-white font-semibold py-1.5 sm:py-2 px-3 sm:px-4 rounded-full flex items-center gap-2 animate-float-4 border-white/5 text-xs sm:text-sm">
            <BrainCircuit className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#84cc16]" />
            Mentorship
          </div>
        </div>
      </div>

      {/* Neon Banner */}
      <div className="w-full bg-primary py-3 sm:py-4 overflow-hidden border-y border-primary/50">
        <div className="container mx-auto px-4 flex items-center justify-between text-primary-foreground font-bold text-sm sm:text-lg uppercase tracking-wider">
          <div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" /> Scholarships</div>
          <div className="hidden sm:flex items-center gap-2"><Briefcase className="h-5 w-5 sm:h-6 sm:w-6" /> Internships</div>
          <div className="hidden md:flex items-center gap-2"><MapPin className="h-5 w-5 sm:h-6 sm:w-6" /> Graduate Roles</div>
          <div className="hidden sm:flex items-center gap-2"><BrainCircuit className="h-5 w-5 sm:h-6 sm:w-6" /> AI Matching</div>
        </div>
      </div>

      {/* Mobile: CV Upload at top (visible only on lg below) */}
      <div className="lg:hidden">
        <AiAdvisorCard />
      </div>

      {/* Mobile: Filter & Sort Bar */}
      <div className="lg:hidden flex items-center gap-2 px-1">
        <button
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors border flex-1 justify-center ${
            selectedTypes.length > 0 || selectedLevels.length > 0
              ? 'bg-[#84cc16] text-[#070e0a] border-[#84cc16]'
              : 'bg-[#1e1e1e]/80 text-white border-white/10 hover:bg-white/5'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {(selectedTypes.length > 0 || selectedLevels.length > 0) && (
            <span className="bg-white/20 text-[#070e0a] text-xs font-bold rounded-full px-1.5 py-0.5">
              {selectedTypes.length + selectedLevels.length}
            </span>
          )}
        </button>

        {user && (
          <button
            onClick={handleCvFilterToggle}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors border flex-1 justify-center ${
              cvFilterActive
                ? 'bg-[#84cc16] text-[#070e0a] border-[#84cc16] shadow-[0_0_15px_rgba(132,204,22,0.4)]'
                : 'bg-[#1e1e1e]/80 text-white border-white/10 hover:bg-white/5'
            }`}
          >
            <BrainCircuit className="h-4 w-4" />
            {cvFilterActive ? 'CV Active' : 'CV Match'}
          </button>
        )}

        <div className="relative flex-1">
          <button 
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="bg-[#1e1e1e]/80 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-sm font-medium shadow-sm outline-none hover:bg-white/5 text-white flex items-center justify-center gap-1 w-full"
          >
            {sortBy}
            <ChevronDown className={`w-4 h-4 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isSortOpen && (
            <div className="absolute right-0 mt-2 w-full min-w-[160px] bg-[#1a1f2e]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
              {['Best Match', 'Newest', 'Deadline Approaching'].map(option => (
                <button
                  key={option}
                  onClick={() => {
                    setSortBy(option);
                    setIsSortOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 hover:text-primary ${sortBy === option ? 'text-primary bg-primary/5' : 'text-gray-300'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Collapsible Filters Panel */}
      {mobileFiltersOpen && (
        <div className="lg:hidden glass-card rounded-2xl p-4 sm:p-5 space-y-4">
          <FiltersContent />
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        
        {/* Left Sidebar - Filters & AI Advisor (desktop only) */}
        <div className="hidden lg:block col-span-1 space-y-6">
          <div className="glass-card rounded-2xl p-6 sticky top-24 space-y-6">
            <FiltersContent />
          </div>

          {/* AI Advisor Card (desktop) */}
          <AiAdvisorCard />
        </div>
        
        {/* Right Content - Feed */}
        <div ref={programsRef} className="col-span-1 lg:col-span-3 space-y-4 sm:space-y-6 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 relative">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold mb-1 sm:mb-2">
                <span className="w-8 h-1 bg-primary rounded-full"></span> Opportunities
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white">Delivering Value Through Our Matches</h2>
            </div>
            
            {/* Desktop: CV Match Filter + Sort */}
            <div className="hidden lg:flex flex-wrap items-center justify-end gap-2">
              {user && (
                <button
                  onClick={handleCvFilterToggle}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors border ${
                    cvFilterActive
                      ? 'bg-[#84cc16] text-[#070e0a] border-[#84cc16] shadow-[0_0_15px_rgba(132,204,22,0.4)]'
                      : 'bg-[#1e1e1e]/80 text-white border-white/10 hover:bg-white/5'
                  }`}
                >
                  <BrainCircuit className="h-4 w-4" />
                  {cvFilterActive ? 'CV Match Active' : 'Filter by CV'}
                </button>
              )}

              {/* Custom Sort Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="bg-[#1e1e1e]/80 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-2 text-sm font-medium shadow-sm outline-none hover:bg-white/5 focus:ring-1 focus:ring-primary text-white flex items-center justify-between min-w-[180px]"
                >
                  {sortBy}
                  <svg className={`w-4 h-4 ml-2 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                
                {isSortOpen && (
                  <div className="absolute right-0 mt-2 w-full min-w-[180px] bg-[#1a1f2e]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                    {['Best Match', 'Newest', 'Deadline Approaching'].map(option => (
                      <button
                        key={option}
                        onClick={() => {
                          setSortBy(option);
                          setIsSortOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 hover:text-primary ${sortBy === option ? 'text-primary bg-primary/5' : 'text-gray-300'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {opportunities.map(opp => (
              <div 
                key={opp._id} 
                onClick={() => window.open(opp.officialUrl || `https://www.google.com/search?q=${encodeURIComponent(opp.title + ' ' + (opp.organization || ''))}`, '_blank')}
                className="group flex flex-col glass-card hover:bg-white/10 rounded-2xl p-4 sm:p-6 cursor-pointer"
              >
                
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary mb-4 sm:mb-6">
                  {opp.opportunityType === 'Scholarship' ? <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" /> : <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />}
                </div>
                
                <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 sm:mb-2 leading-tight group-hover:text-primary transition-colors">
                  {cleanText(opp.title)}
                </h3>
                <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">
                  <span className="font-medium text-gray-300">
                    {cleanText(opp.organization)}
                  </span>
                </div>
                
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-grow">
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400">
                    <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 shrink-0" /> <span className="truncate">{cleanText(opp.location)}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400">
                    <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 shrink-0" /> <span className="truncate">{cleanText(opp.category)}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400">
                    <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 shrink-0" /> <span className="text-red-400/80 truncate">{formatDeadline(opp.deadline)}</span>
                  </div>
                </div>

                {opp.tags && opp.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                    {opp.tags.map((tag: string, i: number) => (
                      <span key={i} className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-white/5 text-gray-300 text-[10px] sm:text-xs font-medium border border-white/10">
                        {cleanText(tag)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-3 sm:pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-primary text-xs sm:text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                    Read More <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                  <a 
                    href={opp.officialUrl || `https://www.google.com/search?q=${encodeURIComponent(opp.title + ' ' + (opp.organization || ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 p-1.5 sm:p-2 bg-primary/10 rounded-lg text-primary hover:bg-primary hover:text-[#0a0f16] transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </a>
                </div>

              </div>
            ))}
          </div>
          
          {hasMore && (
            <div className="mt-6 sm:mt-8 text-center">
              <button 
                onClick={handleLoadMore}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 sm:h-12 px-6 sm:px-8 shadow-sm disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More Opportunities'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary Modal (formatted markdown, no raw asterisks) */}
      {aiSummaryOpen && aiAnalysis && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleToggleAiSummary}
          />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1410]/95 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-white">
                <BrainCircuit className="h-5 w-5 text-[#84cc16]" /> AI Summary
              </h3>
              <div className="flex items-center gap-3">
                <button
                  role="switch"
                  aria-checked={cvFilterActive}
                  onClick={handleToggleAiSummary}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    cvFilterActive ? 'bg-[#84cc16]' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      cvFilterActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <button
                  onClick={handleToggleAiSummary}
                  aria-label="Close AI summary"
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4 text-gray-300">
              <MarkdownView text={aiAnalysis} />
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-[11px] text-gray-500">
              Showing careers filtered by your CV match. Turn off the toggle to return to the full feed.
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-[#1a1f2e] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <BrainCircuit className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-white">{modalTitle}</h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-6">{modalMessage}</p>
            <button
              onClick={() => setModalOpen(false)}
              className="w-full bg-primary text-[#070e0a] font-bold py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
