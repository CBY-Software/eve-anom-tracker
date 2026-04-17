import { useState, useEffect, ChangeEvent, useRef } from 'react';
import systemsData from './data/solar_systems.json';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Database from '@tauri-apps/plugin-sql';
import { format, subDays } from 'date-fns';
import { Trash2, Menu, X, Crosshair, BarChart2, Settings as SettingsIcon, Minus, ChevronUp, ChevronDown, Activity, ExternalLink, HardDrive, Calendar, Search, Plus, RefreshCw } from 'lucide-react';
import Settings, { AppSettings } from './Settings';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';
import { ESI_CLIENT_ID } from './constants';

interface AnomLog {
  id: number;
  timestamp: string;
  site_type: string;
  was_ded_escalation: number;
  was_occ_mine_escalation: number;
  was_cap_stag_escalation: number;
  was_shld_starb_escalation: number;
  was_attack_site_escalation: number;
  was_faction_npc_spawn: number;
  was_capital_spawn: number;
  was_faction_capital_spawn: number;
  was_titan_spawn: number;
  location_region?: string;
  location_system?: string;
  location_security?: string;
  prev_timestamp?: string;
}

interface BeltLog {
  id: number;
  timestamp: string;
  was_faction_spawn: number;
  was_hauler_spawn: number;
  was_officer_spawn: number;
  officer_name?: string;
  location_region?: string;
  location_system?: string;
  location_security?: string;
  prev_timestamp?: string;
}

interface DailyStat {
  date: string;
  count: number;
  escalations: number;
  spawns: number;
}

interface BeltStatsData {
  totalBelts: number;
  specialCount: number;
  factionCount: number;
  haulerCount: number;
  officerCount: number;
}

interface DailyIncomeStat {
  date: string;
  amount: number;
  bounty: number;
  ess: number;
  additional: number;
}

interface IncomeStatsData {
  totalIncome: number;
  todayIncome: number;
  sevenDayAvg: number;
  bountyTotal: number;
  bountyCount: number;
  bountyMax: number;
  bountyMin: number;
  essTotal: number;
  essCount: number;
  essMax: number;
  essMin: number;
  additional: number;
  dailyIncome: DailyIncomeStat[];
}

interface StatsData {
  totalSites: number;
  successfulSites: number;
  escalations: {
    ded: number;
    occupiedMine: number;
    capitalStaging: number;
    shieldedStarbase: number;
    attackSite: number;
  };
  specialSpawns: {
    factionSubcap: number;
    capital: number;
    factionCapital: number;
    titan: number;
  };
}

interface HourlyStat {
  hour: number;
  total: number;
  special: number;
}

interface WeeklyStat {
  day: number; // 0=Monday, 6=Sunday
  total: number;
  special: number;
}



const StatCard = ({ label, count, total, color, highlighted = false, className = "", suffix, actions }: { label: string, count: number | string, total: number, color: 'green' | 'blue' | 'purple' | 'gold', highlighted?: boolean, className?: string, suffix?: string, actions?: React.ReactNode }) => {
  const percentage = (typeof count === 'number' && total > 0) ? ((count / total) * 100).toFixed(1) : null;
  const colorClass = color === 'green' ? 'text-[#00ff7f]' : color === 'purple' ? 'text-[#bf94ff]' : color === 'gold' ? 'text-[#f0b419]' : 'text-[#00e5ff]';
  const borderColor = highlighted
    ? (color === 'green' ? 'border-[#00ff7f]/60' : color === 'purple' ? 'border-[#bf94ff]/60' : color === 'gold' ? 'border-[#f0b419]/60' : 'border-[#00e5ff]/60')
    : (color === 'green' ? 'border-[#00ff7f]/20' : color === 'purple' ? 'border-[#bf94ff]/20' : color === 'gold' ? 'border-[#f0b419]/20' : 'border-[#00e5ff]/20');
  const bgHover = color === 'green' ? 'hover:bg-[#00ff7f]/5' : color === 'purple' ? 'hover:bg-[#bf94ff]/5' : color === 'gold' ? 'hover:bg-[#f0b419]/5' : 'hover:bg-[#00e5ff]/5';
  const bgClass = highlighted
    ? (color === 'green' ? 'bg-[#00ff7f]/5' : color === 'purple' ? 'bg-[#bf94ff]/5' : color === 'gold' ? 'bg-[#f0b419]/5' : 'bg-[#00e5ff]/5')
    : 'bg-[#141414]';
  const shadowClass = highlighted
    ? (color === 'green' ? 'shadow-[0_0_15px_rgba(0,255,127,0.1)]' : color === 'purple' ? 'shadow-[0_0_15px_rgba(191,148,255,0.1)]' : color === 'gold' ? 'shadow-[0_0_15px_rgba(240,180,25,0.1)]' : 'shadow-[0_0_15px_rgba(0,229,255,0.1)]')
    : '';

  return (
    <div className={`${bgClass} border ${borderColor} p-4 rounded-lg transition-all duration-200 ${bgHover} ${shadowClass} ${className} group flex flex-col justify-center relative`}>
      <div className={`text-[10px] font-bold ${highlighted ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-widest mb-1 group-hover:text-gray-400 transition-colors`}>
        {label}
      </div>
      <div className="flex items-baseline justify-between">
        <div className={`${highlighted ? 'text-3xl' : 'text-2xl'} font-bold ${colorClass}`}>
          {typeof count === 'number' ? count.toLocaleString() : count}
          {color === 'gold' && typeof count === 'number' && <span className="text-xs ml-1 opacity-60">M</span>}
        </div>
        {percentage !== null && (
          <div className={`text-xs font-mono ${highlighted ? 'text-gray-400' : 'text-gray-500'}`}>
            {percentage}%
          </div>
        )}
        {suffix && (
          <div className={`text-xs font-mono ${highlighted ? 'text-gray-400' : 'text-gray-500'} uppercase text-right`}>
            {suffix}
          </div>
        )}
      </div>
      {actions && (
        <div className="absolute top-2 right-2 flex space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
};

const DEFAULT_SITE_TYPES = [
  'Haven',
  'Sanctum',
  'Forsaken Hub',
  'Forsaken Rally Point',
];

const DEFAULT_SETTINGS: AppSettings = {
  alwaysOnTop: false,
  globalScale: 1.0,
  windowOpacity: 1.0,
  customSites: "Haven, Sanctum, Forsaken Hub, Forsaken Rally Point",
  enableSounds: true,
  orientation: 'portrait',
  backupPath: '',
  autoBackupFrequency: 'off',
  preferredSystems: [],
  logShortcut: 'CommandOrControl+Shift+L',
  timeDisplay: 'eve',
  janiceMarket: 2,
  janicePriceType: 'sell',
  janicePricingVariant: 'immediate',
  janicePercentage: 100,
  combatAnomalyTracking: true,
  beltTracking: true,
};

// Bootstrap key layout settings synchronously from localStorage to avoid
// a flicker between portrait (default) and the user's saved orientation.
function getBootstrapSettings(): AppSettings {
  try {
    const cached = localStorage.getItem('anomtracker_bootstrap');
    if (cached) return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
  } catch { }
  return DEFAULT_SETTINGS;
}

type ViewState = 'combat' | 'belt' | 'combatStats' | 'beltStats' | 'incomeStats' | 'settings';

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_IPC__' in window);

const Titlebar = ({ isCollapsed, onToggleCollapse }: { isCollapsed: boolean, onToggleCollapse: () => void }) => {
  const appWindow = isTauri ? getCurrentWindow() : null;

  const handleMouseDown = (e: MouseEvent) => {
    // Only start dragging on left click and if we're not clicking a button
    if (isTauri && e.button === 0) {
      // Use the explicit startDragging API for better reliability
      appWindow?.startDragging();
    }
  };

  return (
    <div
      className="h-[28px] bg-[#050505] flex items-center border-b border-[#333] select-none shrink-0 overflow-hidden"
    >
      {/* Dedicated Drag Area with Title */}
      <div
        data-tauri-drag-region
        onMouseDown={handleMouseDown}
        className="flex-1 h-full cursor-default flex items-center px-3"
      >
        <span className="text-[10px] font-bold text-[#f0b419] tracking-[0.2em] uppercase pointer-events-none">
          EVE ANOMTRACKER
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex h-full shrink-0">
        <button
          onClick={onToggleCollapse}
          className={`h-full px-3 flex items-center justify-center transition-colors ${isCollapsed
            ? "bg-[#f0b419] text-[#0a0a0a]"
            : "text-gray-500 hover:bg-[#f0b419] hover:text-[#0a0a0a]"
            }`}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button
          onClick={() => isTauri && appWindow?.minimize()}
          className="h-full px-3 flex items-center justify-center hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-colors text-gray-500"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => isTauri && appWindow?.close()}
          className="h-full px-3 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors text-gray-500"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

const Splash = () => {
  const handleMouseDown = (e: MouseEvent) => {
    if (isTauri && e.button === 0) {
      getCurrentWindow()?.startDragging();
    }
  };

  return (
    <div
      className="absolute inset-0 bg-[radial-gradient(circle,#1a1a1a_0%,#050505_100%)] flex flex-col items-center justify-center overflow-hidden z-[9999]"
      onMouseDown={handleMouseDown}
      data-tauri-drag-region
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="w-full h-full bg-[url('/app-icon.jpg')] bg-contain bg-no-repeat bg-center"></div>
      </div>
      <div className="absolute bottom-3 right-3 text-right z-20 pointer-events-none">
        <div className="text-[#f0b419] text-[10px] font-black tracking-[0.2em] uppercase mb-1 drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">Loading...</div>
        <div className="flex justify-end gap-1">
          <div className="w-1 h-1 bg-[#f0b419] rounded-full shadow-[0_0_5px_rgba(240,180,25,0.5)] animate-[pulse_1.5s_infinite_ease-in-out]"></div>
          <div className="w-1 h-1 bg-[#f0b419] rounded-full shadow-[0_0_5px_rgba(240,180,25,0.5)] animate-[pulse_1.5s_infinite_ease-in-out] [animation-delay:0.2s]"></div>
          <div className="w-1 h-1 bg-[#f0b419] rounded-full shadow-[0_0_5px_rgba(240,180,25,0.5)] animate-[pulse_1.5s_infinite_ease-in-out] [animation-delay:0.4s]"></div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#f0b419]/10 z-20 pointer-events-none">
        <div className="animate-[progress_3s_linear_forwards] h-full bg-[#f0b419] shadow-[0_0_10px_#f0b419]"></div>
      </div>
    </div>
  );
};

export default function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [settings, setSettings] = useState<AppSettings>(getBootstrapSettings());
  const [currentView, setCurrentView] = useState<ViewState>('combat');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const siteTypes = settings.customSites
    ? settings.customSites.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_SITE_TYPES;

  const [siteType, setSiteType] = useState(siteTypes[0] || 'Other');
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [history, setHistory] = useState<AnomLog[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [fullHistory, setFullHistory] = useState<AnomLog[]>([]);
  const [recentCount, setRecentCount] = useState<number>(0);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTrackedSitesModalOpen, setIsTrackedSitesModalOpen] = useState(false);
  const [trackedSites, setTrackedSites] = useState<AnomLog[]>([]);
  const [trackedSitesPage, setTrackedSitesPage] = useState(0);
  const [hasMoreTrackedSites, setHasMoreTrackedSites] = useState(true);
  const [isLoadingTrackedSites, setIsLoadingTrackedSites] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [statsFilter, setStatsFilter] = useState<string>('All');
  const [dateRangeType, setDateRangeType] = useState<'All' | 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Custom'>('Today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [logToDelete, setLogToDelete] = useState<number | null>(null);
  const [beltLogToDelete, setBeltLogToDelete] = useState<number | null>(null);
  const [characterToRemove, setCharacterToRemove] = useState<any | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [isAutoBackupModalOpen, setIsAutoBackupModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ latest: string, current: string } | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('0.0.0');
  const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [systemDateFormat, setSystemDateFormat] = useState<string>('yyyy-MM-dd');

  const [hourlyStats, setHourlyStats] = useState<HourlyStat[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([]);
  const [statsSubView, setStatsSubView] = useState<'general' | 'advanced'>('general');
  const [beltStats, setBeltStats] = useState<BeltStatsData | null>(null);
  const [beltHourlyStats, setBeltHourlyStats] = useState<HourlyStat[]>([]);
  const [beltWeeklyStats, setBeltWeeklyStats] = useState<WeeklyStat[]>([]);
  const [beltDailyStats, setBeltDailyStats] = useState<DailyStat[]>([]);
  const [incomeStats, setIncomeStats] = useState<IncomeStatsData | null>(null);
  const [isTrackedBeltsModalOpen, setIsTrackedBeltsModalOpen] = useState(false);
  const [trackedBelts, setTrackedBelts] = useState<BeltLog[]>([]);
  const [trackedBeltsPage, setTrackedBeltsPage] = useState(0);
  const [hasMoreTrackedBelts, setHasMoreTrackedBelts] = useState(true);
  const [isLoadingTrackedBelts, setIsLoadingTrackedBelts] = useState(false);
  const [esiAccounts, setEsiAccounts] = useState<any[]>([]);
  const [walletJournal, setWalletJournal] = useState<any[]>([]);
  const [isSyncingWallet, setIsSyncingWallet] = useState(false);
  const [journalPage, setJournalPage] = useState(0);
  const [hasMoreJournal, setHasMoreJournal] = useState(true);
  const [isLoadingJournal, setIsLoadingJournal] = useState(false);
  const [journalShowScrollTop, setJournalShowScrollTop] = useState(false);
  const [isAddIncomeModalOpen, setIsAddIncomeModalOpen] = useState(false);
  const [addIncomeErrors, setAddIncomeErrors] = useState<{ type?: string, amount?: string }>({});
  const [journalFilter, setJournalFilter] = useState<'all' | 'manual' | 'api'>('all');
  const [journalEntryToDelete, setJournalEntryToDelete] = useState<number | null>(null);
  const [addIncomeForm, setAddIncomeForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    characterId: 0,
    type: '',
    amount: '',
    lootText: ''
  });
  const [isAppraising, setIsAppraising] = useState(false);
  const [appraisalResult, setAppraisalResult] = useState<any>(null);
  const [modalStep, setModalStep] = useState<'input' | 'confirm'>('input');
  const [settingsActiveTab, setSettingsActiveTab] = useState<'application' | 'window' | 'locations' | 'characters' | 'backup' | 'about'>('window');

  useEffect(() => {
    if (isAddIncomeModalOpen) {
      const rawNow = new Date();
      const now = settings.timeDisplay === 'eve' 
        ? new Date(rawNow.getTime() + rawNow.getTimezoneOffset() * 60000)
        : rawNow;
      
      setAddIncomeForm({
        characterId: 0,
        date: format(now, 'yyyy-MM-dd'),
        type: '',
        amount: '',
        lootText: ''
      });
      setAddIncomeErrors({});
      setModalStep('input');
      setAppraisalResult(null);
    }
  }, [isAddIncomeModalOpen, settings.timeDisplay]);

  const showToast = (message: string, duration = 3000) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (duration > 0) {
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage(null);
      }, duration);
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      if (isTauri) {
        await invoke('plugin:shell|open', { path: url });
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      console.error('Failed to open URL:', e);
      showToast('Failed to open browser');
    }
  };

  const tm = settings.timeDisplay === 'local' ? ", 'localtime'" : "";

  const formatTimestamp = (ts: string, fmt: string) => {
    if (!ts) return '';
    // Handle both space and T separators, and ensure it's treated as UTC
    const normalizedTs = ts.includes('T') ? ts : ts.replace(' ', 'T');
    const d = new Date(normalizedTs.endsWith('Z') ? normalizedTs : normalizedTs + 'Z');
    
    if (isNaN(d.getTime())) return ts; // Fallback for invalid dates
    
    if (settings.timeDisplay === 'eve') {
      const offset = d.getTimezoneOffset();
      const utcDate = new Date(d.getTime() + offset * 60000);
      return format(utcDate, fmt);
    }
    return format(d, fmt);
  };

  // Format a yyyy-MM-dd string using the actual OS date format from Windows registry
  const formatLocalDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    // Replace Windows format tokens with actual values
    return systemDateFormat
      .replaceAll('yyyy', year)
      .replaceAll('yy', year.slice(2))
      .replaceAll('MM', month.padStart(2, '0'))
      .replaceAll('M', String(parseInt(month, 10)))
      .replaceAll('dd', day.padStart(2, '0'))
      .replaceAll('d', String(parseInt(day, 10)));
  };

  // Toggles
  const [toggles, setToggles] = useState({
    was_ded_escalation: false,
    was_occ_mine_escalation: false,
    was_cap_stag_escalation: false,
    was_shld_starb_escalation: false,
    was_attack_site_escalation: false,
    was_faction_npc_spawn: false,
    was_capital_spawn: false,
    was_faction_capital_spawn: false,
    was_titan_spawn: false,
  });

  const getSiteDuration = (current: string, previous?: string) => {
    if (!previous) return null;
    try {
      const start = new Date(previous.replace(' ', 'T') + 'Z');
      const end = new Date(current.replace(' ', 'T') + 'Z');
      const diffMs = end.getTime() - start.getTime();

      if (diffMs <= 0) return null;

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    } catch {
      return null;
    }
  };

  const [beltToggles, setBeltToggles] = useState({
    was_faction_spawn: false,
    was_hauler_spawn: false,
    was_officer_spawn: false,
  });
  const [officerName, setOfficerName] = useState('');
  const [filteredOfficers, setFilteredOfficers] = useState<string[]>([]);
  const [beltHistory, setBeltHistory] = useState<BeltLog[]>([]);
  const [beltRecentCount, setBeltRecentCount] = useState(0);
  const [officerError, setOfficerError] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  // Global hotkey integration
  const handleGlobalLog = () => {
    // Determine which action to trigger based on the active tab
    if (currentView === 'combat') {
      submitSiteLog();
    } else if (currentView === 'belt') {
      submitBeltLog();
    }

    // Provide visual feedback
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);
  };

  useGlobalHotkeys(handleGlobalLog, settings.logShortcut);

  const OFFICER_LIST = [
    'Ahremen Arkah', 'Asine Hitama', 'Brokara Ryis', 'Brynn Jerdola',
    'Chelm Soran', 'Cormack Vaajokas', 'Draclira Merlonne', 'Estamel Tharchon',
    'Gotan Krazman', 'Hakim Stormare', 'Kaikka Pehkun', 'Makra Ozman',
    'Mizuro Cyvit', 'Panola Paatama', 'Ramaku Basta', 'Raysere Giant',
    'Selynne Mardyl', 'Setele Erbe', 'Tairei Namazoth', 'Thon Enyuo',
    'Tobias Krazman', 'Tuvan Orth', 'Usaras Koirola', 'Vepas Naari', 'Vizan Cult'
  ];

  useEffect(() => {
    // Attempt to match system locale for date formatting
    try {
      const systemLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
      document.documentElement.lang = systemLocale;
    } catch (e) {
      document.documentElement.lang = navigator.language;
    }

    // Fetch real OS date format from Rust (reads Windows registry)
    if (isTauri) {
      invoke<string>('get_system_date_format').then(fmt => {
        console.log('System Date Format:', fmt);
        if (fmt) setSystemDateFormat(fmt);
      }).catch((err) => {
        console.error('Failed to get system date format:', err);
      });
    }

    // Load persisted site type and system
    const savedSiteType = localStorage.getItem('anomtracker_site_type');
    if (savedSiteType && siteTypes.includes(savedSiteType)) {
      setSiteType(savedSiteType);
    }

    const initialize = async () => {
      const startTime = Date.now();
      const MIN_SPLASH_TIME = 3000;

      try {
        // Load settings and apply initial window state before showing
        if (isTauri) {
          await loadSettings();
          setIsSettingsLoaded(true);

          const { getVersion } = await import('@tauri-apps/api/app');
          const v = await getVersion();
          setAppVersion(v);

          // Give the OS and React a moment to apply the new window size and layout
          await new Promise(resolve => setTimeout(resolve, 150));
          try {
            await getCurrentWindow().show();
          } catch (e) {
            console.error('Failed to show window:', e);
          }
        } else {
          setIsSettingsLoaded(true);
        }

        // Load solar systems data
        if (!systemsData || !Array.isArray(systemsData)) {
          console.error('Failed to load solar systems: Invalid system data');
          showToast('System data failed to load. Please check installation.');
        }

        // Initialize database
        await initDb();

        const database = await Database.load(await invoke<string>('get_db_path'));
        const accounts = await database.select('SELECT * FROM esi_accounts');
        setEsiAccounts(accounts as any[]);

        // Calculate remaining time for splash screen
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_SPLASH_TIME - elapsedTime);

        setTimeout(() => {
          setIsAppReady(true);
        }, remainingTime);
      } catch (error) {
        console.error('Initialization failed:', error);
        setIsAppReady(true);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (officerName.length >= 1) {
      const filtered = OFFICER_LIST
        .filter(name => name.toLowerCase().includes(officerName.toLowerCase()))
        .slice(0, 10);
      setFilteredOfficers(filtered);
    } else {
      setFilteredOfficers([]);
    }
  }, [officerName]);

  const compareVersions = (latest: string, current: string) => {
    const lParts = latest.split('.').map(Number);
    const cParts = current.split('.').map(Number);
    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) return 1;
      if (l < c) return -1;
    }
    return 0;
  };

  const checkForUpdates = async () => {
    setUpdateError(null);
    console.log('Update Check: Starting...');
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      const v = await getVersion();
      setAppVersion(v);

      const currentVersion = v;

      const response = await fetch('https://api.github.com/repos/CBY-Software/eve-anom-tracker/releases/latest');

      if (!response.ok) {
        const status = response.status;
        console.error(`Update Check: Fetch failed with status ${status}`);
        if (status === 404) {
          const repoResp = await fetch('https://api.github.com/repos/CBY-Software/eve-anom-tracker');
          if (repoResp.ok) {
            setUpdateError('No releases published yet');
          } else {
            setUpdateError('Repository not found or private');
          }
        } else {
          setUpdateError(`HTTP Error: ${status}`);
        }
        return;
      }

      const data = await response.json();
      if (!data.tag_name) {
        console.error('Update Check: No tag_name in response');
        setUpdateError('Invalid API Response');
        return;
      }

      const latestVersion = data.tag_name.replace(/^v/, '');
      console.log(`Update Check Success: Latest=${latestVersion}, Local=${currentVersion}`);

      if (latestVersion !== currentVersion && compareVersions(latestVersion, currentVersion) > 0) {
        console.log('Update Check: NEW VERSION DETECTED');
        setUpdateInfo({ latest: latestVersion, current: currentVersion });
        showToast(`Update Available: ${latestVersion} (Current: ${currentVersion})`, 6000);
      } else {
        console.log('Update Check: App is up to date');
        setUpdateInfo(null);
        showToast('Application is up to date', 3000);
      }
    } catch (error) {
      console.error('Update Check Error:', error);
      setUpdateError(error instanceof Error ? error.message : 'Connection Error');
      showToast(`Update Check Failed: ${error}`, 4000);
    }
  };

  // Check for updates on startup
  useEffect(() => {
    if (!isAppReady || !isTauri) return;

    // Check slightly after startup
    const timer = setTimeout(checkForUpdates, 4500);
    return () => clearTimeout(timer);
  }, [isAppReady]);

  const loadSettings = async () => {
    try {
      if (!isTauri) {
        setIsSettingsLoaded(true);
        return;
      }

      const settingsJson = await invoke<string>('load_settings');
      const loadedSettings = JSON.parse(settingsJson);

      const newSettings = { ...DEFAULT_SETTINGS, ...loadedSettings };
      setSettings(newSettings);
      await applySettings(newSettings);

      // Persist layout-critical settings so first render can bootstrap without flicker
      localStorage.setItem('anomtracker_bootstrap', JSON.stringify({
        orientation: newSettings.orientation,
        globalScale: newSettings.globalScale,
        windowOpacity: newSettings.windowOpacity,
        alwaysOnTop: newSettings.alwaysOnTop,
      }));

      // Check for auto-backup after settings are loaded
      if (isTauri) {
        checkAutoBackup(newSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setIsSettingsLoaded(true);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    applySettings(newSettings);

    // Keep the bootstrap cache up to date so next launch is flicker-free
    localStorage.setItem('anomtracker_bootstrap', JSON.stringify({
      orientation: newSettings.orientation,
      globalScale: newSettings.globalScale,
      windowOpacity: newSettings.windowOpacity,
      alwaysOnTop: newSettings.alwaysOnTop,
    }));

    try {
      if (isTauri) {
        await invoke('save_settings', { settings: JSON.stringify(newSettings) });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const getDateRange = (type: string, customStart: string, customEnd: string) => {
    const rawNow = new Date();
    // If EVE time is selected, adjust "now" to be UTC so format(now, ...) returns UTC date
    const now = settings.timeDisplay === 'eve' 
      ? new Date(rawNow.getTime() + rawNow.getTimezoneOffset() * 60000)
      : rawNow;
      
    const today = format(now, 'yyyy-MM-dd');

    switch (type) {
      case 'Today':
        return { start: today, end: today };
      case 'Yesterday': {
        const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');
        return { start: yesterday, end: yesterday };
      }
      case 'Week':
        return { start: format(subDays(now, 7), 'yyyy-MM-dd'), end: today };
      case 'Month':
        return { start: format(subDays(now, 30), 'yyyy-MM-dd'), end: today };
      case 'Custom':
        return { start: customStart || null, end: customEnd || null };
      case 'All':
      default:
        return { start: null, end: null };
    }
  };

  const applySettings = async (s: AppSettings) => {
    try {
      if (isTauri) {
        let width = s.orientation === 'portrait' ? 360 : 700;
        let height = s.orientation === 'portrait' ? 725 : 450;

        if (currentView === 'combatStats' || currentView === 'beltStats' || currentView === 'settings' || currentView === 'incomeStats') {
          width = 800;
          height = 825;
        }

        if (isCollapsed) {
          height = 28;
        }

        await invoke('apply_window_settings', {
          alwaysOnTop: s.alwaysOnTop,
          scale: (currentView === 'combatStats' || currentView === 'beltStats' || currentView === 'settings' || currentView === 'incomeStats') ? 1.0 : s.globalScale,
          width,
          height
        });
      }
    } catch (error) {
      console.error('Failed to apply settings:', error);
    }
  };

  useEffect(() => {
    applySettings(settings);
    if (db && currentView === 'combatStats') {
      fetchStats(db, statsFilter);
    } else if (db && currentView === 'beltStats') {
      fetchBeltStats(db);
    } else if (db && currentView === 'incomeStats') {
      fetchEsiAccounts(db);
      fetchIncomeStats(db);
      fetchJournal(true);
    }
  }, [isCollapsed, currentView, statsFilter, dateRangeType, customStartDate, customEndDate, selectedCharacterId]);

  useEffect(() => {
    if (!isSettingsLoaded) return;
    if (settings.preferredSystems.length > 0) {
      const savedSystem = localStorage.getItem('anomtracker_selected_system');
      if (savedSystem && settings.preferredSystems.includes(savedSystem)) {
        setSelectedSystem(savedSystem);
      }
    } else {
      setSelectedSystem('');
      localStorage.removeItem('anomtracker_selected_system');
    }
  }, [settings.preferredSystems, isSettingsLoaded]);

  // Auto-redirect if current view is disabled via feature toggles
  useEffect(() => {
    if (!settings.combatAnomalyTracking && (currentView === 'combat' || currentView === 'combatStats')) {
      setCurrentView('incomeStats');
    }
    if (!settings.beltTracking && (currentView === 'belt' || currentView === 'beltStats')) {
      setCurrentView('incomeStats');
    }
  }, [settings.combatAnomalyTracking, settings.beltTracking, currentView]);

  const playTone = (type: 'log' | 'delete') => {
    if (!settings.enableSounds) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'log') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.2); // A2
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.error('Audio playback failed', e);
    }
  };

  const checkAutoBackup = async (currentSettings: AppSettings) => {
    if (import.meta.env.DEV) return;
    if (currentSettings.autoBackupFrequency === 'off' || !currentSettings.backupPath) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

    if (currentSettings.lastAutoBackup === todayStr) return; // Already backed up today

    const lastBackupStr = currentSettings.lastAutoBackup || '1970-01-01';
    const lastBackupDate = new Date(lastBackupStr);
    const nowDate = new Date(todayStr);

    const diffMs = nowDate.getTime() - lastBackupDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let shouldBackup = false;
    if (currentSettings.autoBackupFrequency === 'daily' && diffDays >= 1) shouldBackup = true;
    if (currentSettings.autoBackupFrequency === 'weekly' && diffDays >= 7) shouldBackup = true;
    if (currentSettings.autoBackupFrequency === 'monthly' && diffDays >= 30) shouldBackup = true;

    if (shouldBackup) {
      try {
        const dataDir = await invoke<string>('get_data_dir');
        const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
        const zipName = `${timestamp}_EVE_AnomTracker_AutoBackup.zip`;
        const backupDest = await invoke<string>('join_paths', { base: currentSettings.backupPath, sub: zipName });

        const dbFile = await invoke<string>('join_paths', { base: dataDir, sub: 'anomtracker.db' });
        const dbWal = await invoke<string>('join_paths', { base: dataDir, sub: 'anomtracker.db-wal' });
        const dbShm = await invoke<string>('join_paths', { base: dataDir, sub: 'anomtracker.db-shm' });
        const settingsFile = await invoke<string>('join_paths', { base: dataDir, sub: 'settings.json' });

        await invoke('create_backup_zip', {
          srcFiles: [dbFile, dbWal, dbShm, settingsFile],
          destZip: backupDest
        });

        // Update last backup date
        const updatedSettings = { ...currentSettings, lastAutoBackup: todayStr };
        await saveSettings(updatedSettings);

        setIsAutoBackupModalOpen(true);
      } catch (error) {
        console.error('Auto-backup failed:', error);
      }
    }
  };

  const initDb = async () => {
    try {
      let database: any;

      if (isTauri) {
        const dbPath = await invoke<string>('get_db_path');
        database = await Database.load(dbPath);
      } else {
        console.warn('Not running in Tauri environment. Using mock database.');
        setDbError('Web Preview Mode: Data will not persist across reloads.');

        database = {
          logs: [] as AnomLog[],
          idCounter: 1,
          async execute(query: string, bindValues?: any[]) {
            if (query.includes('INSERT INTO anom_logs')) {
              const log: AnomLog = {
                id: this.idCounter++,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                site_type: bindValues![0],
                was_ded_escalation: bindValues![1],
                was_occ_mine_escalation: bindValues![2],
                was_cap_stag_escalation: bindValues![3],
                was_shld_starb_escalation: bindValues![4],
                was_attack_site_escalation: bindValues![5],
                was_faction_npc_spawn: bindValues![6],
                was_capital_spawn: bindValues![7],
                was_faction_capital_spawn: bindValues![8],
                was_titan_spawn: bindValues![9],
                location_region: bindValues![10],
                location_system: bindValues![11],
                location_security: bindValues![12],
              };
              this.logs.push(log);
            } else if (query.includes('INSERT INTO belt_logs')) {
              const log: BeltLog = {
                id: this.idCounter++,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                was_faction_spawn: bindValues![0],
                was_hauler_spawn: bindValues![1],
                was_officer_spawn: bindValues![2],
                officer_name: bindValues![3],
                location_system: bindValues![4],
                location_region: bindValues![5],
                location_security: bindValues![6],
              };
              if (!this.beltLogs) this.beltLogs = [];
              this.beltLogs.push(log);
            } else if (query.includes('DELETE FROM anom_logs')) {
              const id = bindValues![0];
              this.logs = this.logs.filter((l: AnomLog) => l.id !== id);
            } else if (query.includes('DELETE FROM belt_logs')) {
              const id = bindValues![0];
              if (this.beltLogs) {
                this.beltLogs = this.beltLogs.filter((l: BeltLog) => l.id !== id);
              }
            }
            return { lastInsertId: this.idCounter, rowsAffected: 1 };
          },
          async select<T>(query: string, bindValues?: any[]): Promise<T> {
            if (!this.beltLogs) this.beltLogs = [];
            // Helper to get local date from UTC timestamp string
            const getLocalDate = (ts: string) => {
              return formatTimestamp(ts, 'yyyy-MM-dd');
            };

            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
            const filtered = this.logs.filter((l: AnomLog) => l.timestamp >= twelveHoursAgo);
            const filteredBelts = this.beltLogs.filter((l: BeltLog) => l.timestamp >= twelveHoursAgo);

            if (query.includes('SUM(CASE WHEN')) {
              // ... existing anom_logs stats logic ...
              let logsToUse = [...this.logs];
              let currentParamIdx = 0;

              if (query.includes('WHERE site_type = ?')) {
                const filterVal = bindValues![currentParamIdx++];
                logsToUse = logsToUse.filter(l => l.site_type === filterVal);
              }

              if (query.includes("date(timestamp") && query.includes(">=")) {
                const startVal = bindValues![currentParamIdx++];
                logsToUse = logsToUse.filter(l => getLocalDate(l.timestamp) >= startVal);
              }

              if (query.includes("date(timestamp") && query.includes("<=")) {
                const endVal = bindValues![currentParamIdx++];
                logsToUse = logsToUse.filter(l => getLocalDate(l.timestamp) <= endVal);
              }

              const total = logsToUse.length;
              const successful = logsToUse.filter(l =>
                l.was_ded_escalation === 1 || l.was_occ_mine_escalation === 1 || l.was_cap_stag_escalation === 1 ||
                l.was_shld_starb_escalation === 1 || l.was_attack_site_escalation === 1 || l.was_faction_npc_spawn === 1 ||
                l.was_capital_spawn === 1 || l.was_faction_capital_spawn === 1 || l.was_titan_spawn === 1
              ).length;

              return [{
                total,
                successful,
                ded: logsToUse.filter(l => l.was_ded_escalation === 1).length,
                occ: logsToUse.filter(l => l.was_occ_mine_escalation === 1).length,
                cap_stg: logsToUse.filter(l => l.was_cap_stag_escalation === 1).length,
                shld: logsToUse.filter(l => l.was_shld_starb_escalation === 1).length,
                atk: logsToUse.filter(l => l.was_attack_site_escalation === 1).length,
                fac_sub: logsToUse.filter(l => l.was_faction_npc_spawn === 1).length,
                cap: logsToUse.filter(l => l.was_capital_spawn === 1).length,
                fac_cap: logsToUse.filter(l => l.was_faction_capital_spawn === 1).length,
                titan: logsToUse.filter(l => l.was_titan_spawn === 1).length
              }] as unknown as T;
            }

            if (query.includes('FROM belt_logs')) {
              if (query.includes('SUM(CASE WHEN')) {
                let logsToUse = [...this.beltLogs];
                let currentParamIdx = 0;

                if (query.includes("date(timestamp") && query.includes(">=")) {
                  const startVal = bindValues![currentParamIdx++];
                  logsToUse = logsToUse.filter(l => getLocalDate(l.timestamp) >= startVal);
                }

                if (query.includes("date(timestamp") && query.includes("<=")) {
                  const endVal = bindValues![currentParamIdx++];
                  logsToUse = logsToUse.filter(l => getLocalDate(l.timestamp) <= endVal);
                }

                return [{
                  total: logsToUse.length,
                  special: logsToUse.filter(l => l.was_faction_spawn === 1 || l.was_hauler_spawn === 1 || l.was_officer_spawn === 1).length,
                  faction: logsToUse.filter(l => l.was_faction_spawn === 1).length,
                  hauler: logsToUse.filter(l => l.was_hauler_spawn === 1).length,
                  officer: logsToUse.filter(l => l.was_officer_spawn === 1).length
                }] as unknown as T;
              }
              if (query.includes('COUNT(*)')) {
                return [{ count: filteredBelts.length }] as unknown as T;
              }
              return [...filteredBelts].reverse() as unknown as T;
            }

            if (query.includes('LIMIT ? OFFSET ?')) {
              let logsToUse = [...this.logs].reverse();
              let currentParamIdx = 0;

              if (query.includes('WHERE site_type = ?')) {
                const filterVal = bindValues![currentParamIdx++];
                logsToUse = logsToUse.filter(l => l.site_type === filterVal);
              }

              if (query.includes("date(timestamp") && query.includes(">=")) {
                const startVal = bindValues![currentParamIdx++];
                logsToUse = logsToUse.filter(l => getLocalDate(l.timestamp) >= startVal);
              }

              if (query.includes("date(timestamp") && query.includes("<=")) {
                const endVal = bindValues![currentParamIdx++];
                logsToUse = logsToUse.filter(l => getLocalDate(l.timestamp) <= endVal);
              }

              const limit = bindValues![currentParamIdx++];
              const offset = bindValues![currentParamIdx++];
              return logsToUse.slice(offset, offset + limit) as unknown as T;
            }

            if (query.includes('ORDER BY id DESC LIMIT 3')) {
              if (query.includes("datetime('now', '-12 hours')")) {
                return [...filtered].reverse().slice(0, 3) as unknown as T;
              }
              return [...this.logs].reverse().slice(0, 3) as unknown as T;
            }
            if (query.includes("datetime('now', '-12 hours')")) {
              if (query.includes('COUNT(*)')) {
                return [{ count: filtered.length }] as unknown as T;
              }
              return [...filtered].reverse() as unknown as T;
            }
            if (query.includes("GROUP BY date(timestamp")) {
              return [] as unknown as T;
            }
            return [] as unknown as T;
          }
        };
      }

      setDb(database);
      fetchHistory(database);
      fetchBeltHistory(database);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      setDbError(String(error));
    }
  };

  const fetchBeltHistory = async (database: any) => {
    try {
      const result = await database.select(
        "SELECT *, (SELECT timestamp FROM belt_logs b2 WHERE b2.id < belt_logs.id ORDER BY b2.id DESC LIMIT 1) as prev_timestamp FROM belt_logs WHERE timestamp >= datetime('now', '-12 hours') ORDER BY id DESC"
      );
      setBeltHistory(result as BeltLog[]);

      const countResult = await database.select(
        "SELECT COUNT(*) as count FROM belt_logs WHERE timestamp >= datetime('now', '-12 hours')"
      );
      setBeltRecentCount((countResult as any[])[0]?.count || 0);

      if (currentView === 'beltStats') {
        fetchBeltStats(database);
      }
    } catch (error) {
      console.error('Failed to fetch belt history:', error);
    }
  };

  const fetchBeltStats = async (database: any) => {
    try {
      // 1. Daily Stats (Last 30 Days) - for the activity chart at the bottom
      const dailyQuery = `
        SELECT 
          date(timestamp${tm}) as date, 
          COUNT(*) as count,
          SUM(CASE WHEN was_faction_spawn=1 OR was_hauler_spawn=1 OR was_officer_spawn=1 THEN 1 ELSE 0 END) as escalations,
          0 as spawns
        FROM belt_logs 
        WHERE timestamp >= date('now'${tm}, '-30 days')
        GROUP BY date(timestamp${tm}) ORDER BY date ASC
      `;
      const dailyResult = await database.select(dailyQuery);
      setBeltDailyStats(dailyResult as DailyStat[]);

      // 2. Filter conditions for the rest of the stats
      const params: any[] = [];
      const conditions: string[] = [];

      const dateRange = getDateRange(dateRangeType, customStartDate, customEndDate);
      if (dateRange.start) {
        conditions.push(`date(timestamp${tm}) >= ?`);
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        conditions.push(`date(timestamp${tm}) <= ?`);
        params.push(dateRange.end);
      }

      const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";

      // 3. Main Stats
      let query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN was_faction_spawn=1 OR was_hauler_spawn=1 OR was_officer_spawn=1 THEN 1 ELSE 0 END) as special,
          SUM(was_faction_spawn) as faction,
          SUM(was_hauler_spawn) as hauler,
          SUM(was_officer_spawn) as officer
        FROM belt_logs${whereClause}
      `;

      const result = await database.select(query, params);
      const row = (result as any[])[0];

      if (row && row.total > 0) {
        setBeltStats({
          totalBelts: row.total,
          specialCount: row.special || 0,
          factionCount: row.faction || 0,
          haulerCount: row.hauler || 0,
          officerCount: row.officer || 0,
        });
      } else {
        setBeltStats({
          totalBelts: 0,
          specialCount: 0,
          factionCount: 0,
          haulerCount: 0,
          officerCount: 0,
        });
      }

      // 4. Hourly Analysis
      const hourlyQuery = `
        SELECT 
          CAST(strftime('%H', timestamp${tm}) AS INTEGER) as hour,
          COUNT(*) as total,
          SUM(CASE WHEN was_faction_spawn=1 OR was_hauler_spawn=1 OR was_officer_spawn=1 THEN 1 ELSE 0 END) as special
        FROM belt_logs${whereClause}
        GROUP BY hour
        ORDER BY hour ASC
      `;
      const hourlyResult = await database.select(hourlyQuery, params);
      setBeltHourlyStats(hourlyResult as HourlyStat[]);

      // 5. Weekly Analysis
      const weeklyQuery = `
        SELECT 
          CAST(strftime('%w', timestamp${tm}) AS INTEGER) as day,
          COUNT(*) as total,
          SUM(CASE WHEN was_faction_spawn=1 OR was_hauler_spawn=1 OR was_officer_spawn=1 THEN 1 ELSE 0 END) as special
        FROM belt_logs${whereClause}
        GROUP BY day
        ORDER BY day ASC
      `;
      const weeklyResult = await database.select(weeklyQuery, params);
      setBeltWeeklyStats(weeklyResult as WeeklyStat[]);

    } catch (error) {
      console.error('Failed to fetch belt stats:', error);
    }
  };

  const fetchTrackedBelts = async (reset: boolean = false) => {
    if (!db || (isLoadingTrackedBelts && !reset) || (!hasMoreTrackedBelts && !reset)) return;

    setIsLoadingTrackedBelts(true);
    try {
      const page = reset ? 0 : trackedBeltsPage;
      const limit = 20;
      const offset = page * limit;

      let query = "SELECT *, (SELECT timestamp FROM belt_logs b2 WHERE b2.id < belt_logs.id ORDER BY b2.id DESC LIMIT 1) as prev_timestamp FROM belt_logs";
      const params: any[] = [];
      const conditions: string[] = [];

      const dateRange = getDateRange(dateRangeType, customStartDate, customEndDate);
      if (dateRange.start) {
        conditions.push(`date(timestamp${tm}) >= ?`);
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        conditions.push(`date(timestamp${tm}) <= ?`);
        params.push(dateRange.end);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY id DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const result = await db.select(query, params);
      const newLogs = result as BeltLog[];

      if (reset) {
        setTrackedBelts(newLogs);
        setTrackedBeltsPage(1);
      } else {
        setTrackedBelts(prev => [...prev, ...newLogs]);
        setTrackedBeltsPage(page + 1);
      }

      setHasMoreTrackedBelts(newLogs.length === limit);
    } catch (error) {
      console.error('Failed to fetch tracked belts:', error);
    } finally {
      setIsLoadingTrackedBelts(false);
    }
  };

  const fetchIncomeStats = async (database: any) => {
    try {
      const params: any[] = [];
      const conditions: string[] = [];

      const dateRange = getDateRange(dateRangeType, customStartDate, customEndDate);
      if (dateRange.start) {
        conditions.push(`date(timestamp${tm}) >= ?`);
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        conditions.push(`date(timestamp${tm}) <= ?`);
        params.push(dateRange.end);
      }

      if (selectedCharacterId) {
        conditions.push("character_id = ?");
        params.push(selectedCharacterId);
      }

      const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";

      // 1. Summary Stats
      const summaryQuery = `
        SELECT 
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total,
          SUM(CASE WHEN date(timestamp${tm}) = date('now'${tm}) AND amount > 0 THEN amount ELSE 0 END) as today,
          SUM(CASE WHEN LOWER(ref_type) = 'bounty_prizes' AND amount > 0 THEN amount ELSE 0 END) as bounty,
          COUNT(CASE WHEN LOWER(ref_type) = 'bounty_prizes' AND amount > 0 THEN 1 END) as bounty_count,
          MAX(CASE WHEN LOWER(ref_type) = 'bounty_prizes' AND amount > 0 THEN amount ELSE 0 END) as bounty_max,
          MIN(CASE WHEN LOWER(ref_type) = 'bounty_prizes' AND amount > 0 THEN amount END) as bounty_min,
          SUM(CASE WHEN LOWER(ref_type) = 'ess_escrow_transfer' AND amount > 0 THEN amount ELSE 0 END) as ess,
          COUNT(CASE WHEN LOWER(ref_type) = 'ess_escrow_transfer' AND amount > 0 THEN 1 END) as ess_count,
          MAX(CASE WHEN LOWER(ref_type) = 'ess_escrow_transfer' AND amount > 0 THEN amount ELSE 0 END) as ess_max,
          MIN(CASE WHEN LOWER(ref_type) = 'ess_escrow_transfer' AND amount > 0 THEN amount END) as ess_min,
          SUM(CASE WHEN LOWER(ref_type) NOT IN ('bounty_prizes', 'ess_escrow_transfer') AND amount > 0 THEN amount ELSE 0 END) as additional
        FROM wallet_journal${whereClause}
      `;
      const summaryResult = await database.select(summaryQuery, params);
      const row = (summaryResult as any[])[0];

      // 2. 7-Day Avg (Special query)
      const avgQuery = `
        SELECT SUM(amount) / 7 as avg FROM wallet_journal 
        WHERE date(timestamp${tm}) > date('now'${tm}, '-7 days') AND amount > 0
      `;
      const avgResult = await database.select(avgQuery);
      const avgRow = (avgResult as any[])[0];

      // 3. Daily Stats (Last 30 Days) for Chart
      const dailyQuery = `
        SELECT 
          date(timestamp${tm}) as date,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as amount,
          SUM(CASE WHEN LOWER(ref_type) = 'bounty_prizes' AND amount > 0 THEN amount ELSE 0 END) as bounty,
          SUM(CASE WHEN LOWER(ref_type) = 'ess_escrow_transfer' AND amount > 0 THEN amount ELSE 0 END) as ess,
          SUM(CASE WHEN LOWER(ref_type) NOT IN ('bounty_prizes', 'ess_escrow_transfer') AND amount > 0 THEN amount ELSE 0 END) as additional
        FROM wallet_journal
        WHERE timestamp >= date('now'${tm}, '-30 days')
        GROUP BY date ORDER BY date ASC
      `;
      const dailyResult = await database.select(dailyQuery);

      setIncomeStats({
        totalIncome: row?.total || 0,
        todayIncome: row?.today || 0,
        sevenDayAvg: avgRow?.avg || 0,
        bountyTotal: row?.bounty || 0,
        bountyCount: row?.bounty_count || 0,
        bountyMax: row?.bounty_max || 0,
        bountyMin: row?.bounty_min || 0,
        essTotal: row?.ess || 0,
        essCount: row?.ess_count || 0,
        essMax: row?.ess_max || 0,
        essMin: row?.ess_min || 0,
        additional: row?.additional || 0,
        dailyIncome: dailyResult as DailyIncomeStat[]
      });

    } catch (error) {
      console.error('Failed to fetch income stats:', error);
    }
  };

  const fetchJournal = async (reset = false) => {
    if (!db || (isLoadingJournal && !reset) || (!hasMoreJournal && !reset)) return;
 
    setIsLoadingJournal(true);
    try {
      const page = reset ? 0 : journalPage;
      const limit = 50;
      const offset = page * limit;
 
      let query = "SELECT * FROM wallet_journal";
      const params: any[] = [];
      const conditions: string[] = [];
 
      if (selectedCharacterId) {
        conditions.push("character_id = ?");
        params.push(selectedCharacterId);
      }

      if (journalFilter === 'manual') {
        conditions.push("ref_type = 'manual_entry'");
      } else if (journalFilter === 'api') {
        conditions.push("ref_type != 'manual_entry'");
      }

      const dateRange = getDateRange(dateRangeType, customStartDate, customEndDate);
      if (dateRange.start) {
        conditions.push(`date(timestamp${tm}) >= ?`);
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        conditions.push(`date(timestamp${tm}) <= ?`);
        params.push(dateRange.end);
      }
 
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
 
      query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);
 
      const result = await db.select(query, params);
      const newEntries = result as any[];
 
      if (reset) {
        setWalletJournal(newEntries);
        setJournalPage(1);
        setHasMoreJournal(newEntries.length === limit);
      } else {
        setWalletJournal(prev => [...prev, ...newEntries]);
        setJournalPage(page + 1);
        setHasMoreJournal(newEntries.length === limit);
      }
    } catch (error) {
      console.error('Failed to fetch journal:', error);
    } finally {
      setIsLoadingJournal(false);
    }
  };



  useEffect(() => {
    if (db && currentView === 'incomeStats') {
      fetchJournal(true);
    }
  }, [db, currentView, selectedCharacterId, dateRangeType, customStartDate, customEndDate, journalFilter]);


  const fetchHistory = async (database: any) => {
    try {
      const result = await database.select(
        "SELECT *, (SELECT timestamp FROM anom_logs a2 WHERE a2.id < anom_logs.id ORDER BY a2.id DESC LIMIT 1) as prev_timestamp FROM anom_logs WHERE timestamp >= datetime('now', '-12 hours') ORDER BY id DESC LIMIT 3"
      );
      setHistory(result as AnomLog[]);

      const countResult = await database.select(
        "SELECT COUNT(*) as count FROM anom_logs WHERE timestamp >= datetime('now', '-12 hours')"
      );
      setRecentCount((countResult as any[])[0]?.count || 0);

      const fullResult = await database.select(
        "SELECT *, (SELECT timestamp FROM anom_logs a2 WHERE a2.id < anom_logs.id ORDER BY a2.id DESC LIMIT 1) as prev_timestamp FROM anom_logs WHERE timestamp >= datetime('now', '-12 hours') ORDER BY id DESC"
      );
      setFullHistory(fullResult as AnomLog[]);

      if (currentView === 'combatStats') {
        fetchStats(database, statsFilter);
      } else if (currentView === 'beltStats') {
        fetchBeltStats(database);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const fetchStats = async (database: any, filter: string = 'All') => {
    try {
      let dailyQuery = `
        SELECT 
          date(timestamp${tm}) as date, 
          COUNT(*) as count,
          SUM(CASE WHEN was_ded_escalation=1 OR was_occ_mine_escalation=1 OR was_cap_stag_escalation=1 OR was_shld_starb_escalation=1 OR was_attack_site_escalation=1 THEN 1 ELSE 0 END) as escalations,
          SUM(CASE WHEN was_faction_npc_spawn=1 OR was_capital_spawn=1 OR was_faction_capital_spawn=1 OR was_titan_spawn=1 THEN 1 ELSE 0 END) as spawns
        FROM anom_logs 
        WHERE timestamp >= date('now'${tm}, '-30 days')
      `;
      const dailyParams: any[] = [];

      if (filter !== 'All') {
        dailyQuery += " AND site_type = ?";
        dailyParams.push(filter);
      }
      dailyQuery += ` GROUP BY date(timestamp${tm}) ORDER BY date ASC`;

      const dailyResult = await database.select(dailyQuery, dailyParams);
      setDailyStats(dailyResult as DailyStat[]);

      let query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN was_ded_escalation=1 OR was_occ_mine_escalation=1 OR was_cap_stag_escalation=1 OR was_shld_starb_escalation=1 OR was_attack_site_escalation=1 OR was_faction_npc_spawn=1 OR was_capital_spawn=1 OR was_faction_capital_spawn=1 OR was_titan_spawn=1 THEN 1 ELSE 0 END) as successful,
          SUM(was_ded_escalation) as ded,
          SUM(was_occ_mine_escalation) as occ,
          SUM(was_cap_stag_escalation) as cap_stg,
          SUM(was_shld_starb_escalation) as shld,
          SUM(was_attack_site_escalation) as atk,
          SUM(was_faction_npc_spawn) as fac_sub,
          SUM(was_capital_spawn) as cap,
          SUM(was_faction_capital_spawn) as fac_cap,
          SUM(was_titan_spawn) as titan
        FROM anom_logs
      `;

      const params: any[] = [];
      const conditions: string[] = [];

      if (filter !== 'All') {
        conditions.push("site_type = ?");
        params.push(filter);
      }

      const dateRange = getDateRange(dateRangeType, customStartDate, customEndDate);
      if (dateRange.start) {
        conditions.push(`date(timestamp${tm}) >= ?`);
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        conditions.push(`date(timestamp${tm}) <= ?`);
        params.push(dateRange.end);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      const result = await database.select(query, params);

      const row = (result as any[])[0];
      if (!row || row.total === 0) {
        setStats({
          totalSites: 0,
          successfulSites: 0,
          escalations: { ded: 0, occupiedMine: 0, capitalStaging: 0, shieldedStarbase: 0, attackSite: 0 },
          specialSpawns: { factionSubcap: 0, capital: 0, factionCapital: 0, titan: 0 }
        });
        return;
      }

      setStats({
        totalSites: row.total,
        successfulSites: row.successful || 0,
        escalations: {
          ded: row.ded || 0,
          occupiedMine: row.occ || 0,
          capitalStaging: row.cap_stg || 0,
          shieldedStarbase: row.shld || 0,
          attackSite: row.atk || 0,
        },
        specialSpawns: {
          factionSubcap: row.fac_sub || 0,
          capital: row.cap || 0,
          factionCapital: row.fac_cap || 0,
          titan: row.titan || 0,
        }
      });

      // Also fetch Advanced Stats behavior using the shared filters
      const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";

      // Hourly stats query
      const hourlyQuery = `
        SELECT 
          CAST(strftime('%H', timestamp${tm}) AS INTEGER) as hour,
          COUNT(*) as total,
          SUM(CASE WHEN was_ded_escalation=1 OR was_occ_mine_escalation=1 OR was_cap_stag_escalation=1 OR was_shld_starb_escalation=1 OR was_attack_site_escalation=1 OR was_faction_npc_spawn=1 OR was_capital_spawn=1 OR was_faction_capital_spawn=1 OR was_titan_spawn=1 THEN 1 ELSE 0 END) as special
        FROM anom_logs${whereClause}
        GROUP BY hour
        ORDER BY hour ASC
      `;
      const hourlyResult = await database.select(hourlyQuery, [...params]);
      setHourlyStats(hourlyResult as HourlyStat[]);

      // Weekly stats query
      const weeklyQuery = `
        SELECT 
          CAST(strftime('%w', timestamp${tm}) AS INTEGER) as day,
          COUNT(*) as total,
          SUM(CASE WHEN was_ded_escalation=1 OR was_occ_mine_escalation=1 OR was_cap_stag_escalation=1 OR was_shld_starb_escalation=1 OR was_attack_site_escalation=1 OR was_faction_npc_spawn=1 OR was_capital_spawn=1 OR was_faction_capital_spawn=1 OR was_titan_spawn=1 THEN 1 ELSE 0 END) as special
        FROM anom_logs${whereClause}
        GROUP BY day
        ORDER BY day ASC
      `;
      const weeklyResult = await database.select(weeklyQuery, [...params]);
      setWeeklyStats(weeklyResult as WeeklyStat[]);

    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchTrackedSites = async (reset: boolean = false) => {
    if (!db || isLoadingTrackedSites) return;
    if (!reset && !hasMoreTrackedSites) return;

    setIsLoadingTrackedSites(true);
    const page = reset ? 0 : trackedSitesPage;
    const limit = 100;
    const offset = page * limit;

    try {
      let query = "SELECT *, (SELECT timestamp FROM anom_logs a2 WHERE a2.id < anom_logs.id ORDER BY a2.id DESC LIMIT 1) as prev_timestamp FROM anom_logs";
      const params: any[] = [];
      const conditions: string[] = [];

      if (statsFilter !== 'All') {
        conditions.push("site_type = ?");
        params.push(statsFilter);
      }

      const dateRange = getDateRange(dateRangeType, customStartDate, customEndDate);
      if (dateRange.start) {
        conditions.push(`date(timestamp${tm}) >= ?`);
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        conditions.push(`date(timestamp${tm}) <= ?`);
        params.push(dateRange.end);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY id DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const result = await db.select(query, params);
      const newLogs = result as AnomLog[];

      if (reset) {
        setTrackedSites(newLogs);
        setTrackedSitesPage(1);
      } else {
        setTrackedSites(prev => [...prev, ...newLogs]);
        setTrackedSitesPage(page + 1);
      }

      setHasMoreTrackedSites(newLogs.length === limit);
    } catch (error) {
      console.error('Failed to fetch tracked sites:', error);
    } finally {
      setIsLoadingTrackedSites(false);
    }
  };

  const handleSiteTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSiteType(val);
    localStorage.setItem('anomtracker_site_type', val);
  };

  const toggleState = (key: keyof typeof toggles) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const submitBeltLog = async () => {
    if (!db) return;

    if (beltToggles.was_officer_spawn && !officerName.trim()) {
      setOfficerError(true);
      showToast('Please enter an Officer Name');
      playTone('delete');
      return;
    }

    try {
      const systemData = systemsData.find(s => s.solarSystemName.toLowerCase() === selectedSystem.toLowerCase());

      await db.execute(
        `INSERT INTO belt_logs (
          was_faction_spawn, was_hauler_spawn, was_officer_spawn,
          officer_name, location_system, location_region, location_security
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          beltToggles.was_faction_spawn ? 1 : 0,
          beltToggles.was_hauler_spawn ? 1 : 0,
          beltToggles.was_officer_spawn ? 1 : 0,
          beltToggles.was_officer_spawn ? officerName : null,
          selectedSystem || null,
          systemData?.regionName || null,
          systemData?.security !== undefined ? systemData.security.toString() : null
        ]
      );

      // Reset toggles
      setBeltToggles({
        was_faction_spawn: false,
        was_hauler_spawn: false,
        was_officer_spawn: false,
      });
      setOfficerName('');

      fetchBeltHistory(db);

      playTone('log');
      showToast('Belt successfully logged');
    } catch (error) {
      console.error('Failed to log belt:', error);
      showToast('Failed to log belt');
    }
  };

  const fetchEsiAccounts = async (database: Database) => {
    try {
      const result = await database.select('SELECT * FROM esi_accounts');
      setEsiAccounts(result as any[]);
    } catch (error) {
      console.error('Failed to fetch ESI accounts:', error);
    }
  };

  const handleLinkAccount = async () => {
    try {
      const clientId = settings.esiClientId || ESI_CLIENT_ID;
      const res = await invoke('link_eve_character', { clientId }) as any;
      console.log('Linking response:', res);
      if (db) {
        await db.execute(
          'INSERT OR REPLACE INTO esi_accounts (character_id, character_name, access_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4, $5)',
          [res.character.character_id, res.character.character_name, res.tokens.access_token, res.tokens.refresh_token, res.tokens.expires_at]
        );
        fetchEsiAccounts(db);
        syncAllWallets(); 
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to link account');
    }
  };

  const handleRemoveAccount = async (characterId: number) => {
    const acc = esiAccounts.find(a => a.character_id === characterId);
    if (acc) {
      setCharacterToRemove(acc);
    }
  };

  const confirmRemoveCharacter = async () => {
    if (!db || !characterToRemove) return;
    try {
      await db.execute('DELETE FROM esi_accounts WHERE character_id = $1', [characterToRemove.character_id]);
      fetchEsiAccounts(db);
      setCharacterToRemove(null);
      showToast('Account disconnected');
    } catch (e) {
      console.error(e);
      showToast('Failed to remove account');
    }
  };

  const handleAddIncome = async (overrideAmount?: number) => {
    if (!db) return;
    
    const newErrors: { type?: string, amount?: string } = {};
    const cleanAmount = parseFloat(addIncomeForm.amount.replace(/\./g, ''));

    if (!addIncomeForm.type) {
      newErrors.type = 'Category is required';
    }

    if (addIncomeForm.type === 'Sold Escalations') {
      if (!addIncomeForm.amount || isNaN(cleanAmount) || cleanAmount <= 0) {
        newErrors.amount = 'Valid amount is required';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setAddIncomeErrors(newErrors);
      return;
    }

    try {
      const timestamp = `${addIncomeForm.date} 23:59:59`;
      // Use cleanAmount if type is Sold Escalations, otherwise use the passed overrideAmount (from appraisal) or 0
      const finalAmount = overrideAmount !== undefined 
        ? overrideAmount 
        : (addIncomeForm.type === 'Sold Escalations' ? cleanAmount : 0);
      await db.execute(
        `INSERT INTO wallet_journal (character_id, timestamp, amount, ref_type, description) 
         VALUES (?, ?, ?, ?, ?)`,
        [addIncomeForm.characterId === 0 ? null : addIncomeForm.characterId, timestamp, finalAmount, 'manual_entry', addIncomeForm.type]
      );
      
      setIsAddIncomeModalOpen(false);
      setModalStep('input');
      setAppraisalResult(null);
      showToast('Income added successfully');
      fetchIncomeStats(db);
      fetchJournal(true);
    } catch (error) {
      console.error('Failed to add income:', error);
      showToast('Failed to add income');
    }
  };

  const JANICE_API_KEY = "2kDrayGFYyBqHeZnRfkeF8QGEsejW7Rn";

  const handleAppraiseLoot = async () => {
    if (!addIncomeForm.lootText.trim()) {
      setAddIncomeErrors({ ...addIncomeErrors, amount: 'Loot text is required' });
      return;
    }
    
    setIsAppraising(true);
    try {
      // Use the Rust command to bypass CORS issues in the native environment
      const data = await invoke<any>('janice_appraise', {
        lootText: addIncomeForm.lootText,
        marketId: settings.janiceMarket,
        apiKey: JANICE_API_KEY
      });
      
      // Correctly check v2 appraisal response structure 
      if (data && (data.immediatePrices || data.top5AveragePrices || data.effectivePrices)) {
        setAppraisalResult(data);
        setModalStep('confirm');
      } else {
        showToast('Janice could not value this loot (check format)');
      }
    } catch (error) {
      console.error('Janice API Error:', error);
      showToast(`${error}`);
    } finally {
      setIsAppraising(false);
    }
  };

  const JANICE_MARKETS = [
    { id: 2, name: 'Jita' },
    { id: 5, name: 'Amarr' },
    { id: 13, name: 'Dodixie' },
    { id: 19, name: 'Hek' },
    { id: 24, name: 'Rens' }
  ];

  const handleDeleteJournalEntry = async () => {
    if (!db || journalEntryToDelete === null) return;
    try {
      await db.execute('DELETE FROM wallet_journal WHERE ref_id = $1', [journalEntryToDelete]);
      setJournalEntryToDelete(null);
      showToast('Entry deleted');
      fetchJournal(true);
      fetchIncomeStats(db);
    } catch (error) {
      console.error('Failed to delete journal entry:', error);
      showToast('Failed to delete entry');
    }
  };

  const formatISKInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const syncAllWallets = async () => {
    if (isSyncingWallet) return;
    
    const clientIdToUse = ESI_CLIENT_ID;
    setIsSyncingWallet(true);
    showToast('Syncing Wallets...');

    try {
      for (const account of esiAccounts) {
        // First refresh token
        try {
          const tokens = await invoke<any>('refresh_esi_token', { 
            clientId: clientIdToUse, 
            refreshToken: account.refresh_token 
          });

          // Update DB with new tokens
          await db.execute(
            'UPDATE esi_accounts SET access_token = $1, refresh_token = $2, expires_at = $3 WHERE character_id = $4',
            [tokens.access_token, tokens.refresh_token, tokens.expires_at, account.character_id]
          );

          // Sync journal
          const entries = await invoke<any[]>('sync_wallet_journal', {
            characterId: account.character_id,
            accessToken: tokens.access_token
          });

          console.log(`Fetched ${entries.length} entries for ${account.character_name}`);

          // Filter and Save unique entries to DB
          const allowedTypes = ['bounty_prizes', 'ess_escrow_transfer'];
          for (const entry of entries) {
            if (allowedTypes.includes(entry.ref_type.toLowerCase())) {
              await db.execute(
                'INSERT OR IGNORE INTO wallet_journal (ref_id, character_id, timestamp, amount, ref_type, description) VALUES ($1, $2, $3, $4, $5, $6)',
                [entry.id, account.character_id, entry.date.replace('T', ' ').replace('Z', ''), entry.amount, entry.ref_type, entry.description]
              );
            }
          }
        } catch (err) {
          console.error(`Failed to sync account ${account.character_name}:`, err);
        }
      }
      
      // Load journal for display
      fetchJournal(true);
      fetchIncomeStats(db);
      showToast('Wallet sync complete');
    } catch (error) {
      console.error('Sync failed:', error);
      showToast('Sync failed');
    } finally {
      setIsSyncingWallet(false);
    }
  };

  const submitSiteLog = async () => {
    if (!db) return;

    try {
      const systemData = systemsData.find(s => s.solarSystemName.toLowerCase() === selectedSystem.toLowerCase());

      await db.execute(
        `INSERT INTO anom_logs (
          site_type, was_ded_escalation, was_occ_mine_escalation, was_cap_stag_escalation,
          was_shld_starb_escalation, was_attack_site_escalation, was_faction_npc_spawn,
          was_capital_spawn, was_faction_capital_spawn, was_titan_spawn,
          location_region, location_system, location_security
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          siteType,
          toggles.was_ded_escalation ? 1 : 0,
          toggles.was_occ_mine_escalation ? 1 : 0,
          toggles.was_cap_stag_escalation ? 1 : 0,
          toggles.was_shld_starb_escalation ? 1 : 0,
          toggles.was_attack_site_escalation ? 1 : 0,
          toggles.was_faction_npc_spawn ? 1 : 0,
          toggles.was_capital_spawn ? 1 : 0,
          toggles.was_faction_capital_spawn ? 1 : 0,
          toggles.was_titan_spawn ? 1 : 0,
          systemData?.regionName || null,
          selectedSystem || null,
          systemData?.security !== undefined ? systemData.security.toString() : null
        ]
      );

      // Reset toggles
      setToggles({
        was_ded_escalation: false,
        was_occ_mine_escalation: false,
        was_cap_stag_escalation: false,
        was_shld_starb_escalation: false,
        was_attack_site_escalation: false,
        was_faction_npc_spawn: false,
        was_capital_spawn: false,
        was_faction_capital_spawn: false,
        was_titan_spawn: false,
      });

      fetchHistory(db);

      playTone('log');
      showToast('Site successfully logged');
    } catch (error) {
      console.error('Failed to log site:', error);
      showToast('Failed to log site');
    }
  };

  const confirmDelete = async () => {
    if (!db) return;

    if (logToDelete !== null) {
      try {
        await db.execute('DELETE FROM anom_logs WHERE id = $1', [logToDelete]);
        setLogToDelete(null);
        fetchHistory(db);
        setTrackedSites(prev => prev.filter(log => log.id !== logToDelete));

        playTone('delete');
        showToast('Log successfully deleted');
      } catch (error) {
        console.error('Failed to delete log:', error);
        showToast('Failed to delete log');
      }
    } else if (beltLogToDelete !== null) {
      try {
        await db.execute('DELETE FROM belt_logs WHERE id = $1', [beltLogToDelete]);
        setBeltLogToDelete(null);
        fetchBeltHistory(db);

        playTone('delete');
        showToast('Belt log successfully deleted');
      } catch (error) {
        console.error('Failed to delete belt log:', error);
        showToast('Failed to delete belt log');
      }
    }
  };

  const requestDelete = (id: number) => {
    setLogToDelete(id);
  };

  const getActiveIcons = (log: AnomLog) => {
    const icons: { label: string; color: 'gold' | 'blue' | 'green' }[] = [];
    if (log.was_ded_escalation === 1) icons.push({ label: 'DED-SITE', color: 'green' });
    if (log.was_occ_mine_escalation === 1) icons.push({ label: 'OCC-MINE', color: 'green' });
    if (log.was_cap_stag_escalation === 1) icons.push({ label: 'CAP-STG', color: 'green' });
    if (log.was_shld_starb_escalation === 1) icons.push({ label: 'SHLD-STRB', color: 'green' });
    if (log.was_attack_site_escalation === 1) icons.push({ label: 'ATTK-SITE', color: 'green' });
    if (log.was_faction_npc_spawn === 1) icons.push({ label: 'FAC-SUB', color: 'blue' });
    if (log.was_capital_spawn === 1) icons.push({ label: 'CAP', color: 'blue' });
    if (log.was_faction_capital_spawn === 1) icons.push({ label: 'FAC-CAP', color: 'blue' });
    if (log.was_titan_spawn === 1) icons.push({ label: 'TITAN', color: 'blue' });
    return icons;
  };

  const renderIncomeStatsView = () => (
    <div className="flex-1 flex flex-col pt-[5px] px-6 pb-4 animate-in fade-in duration-500 overflow-hidden">
      {/* Header Row: Sub-view Toggle & Filters */}
      <div className="flex items-center justify-between mb-4 mt-1">
        <div className="flex items-center bg-[#141414]/50 border border-[#f0b419]/10 p-0.5 rounded-lg shadow-lg h-[28px]">
          <button
            onClick={() => setStatsSubView('general')}
            className={`h-full px-3 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${statsSubView === 'general'
              ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
          >
            <BarChart2 size={9} className={statsSubView === 'general' ? 'opacity-100' : 'opacity-40'} />
            <span>General</span>
          </button>
          <button
            onClick={() => setStatsSubView('advanced')}
            className={`h-full px-3 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${statsSubView === 'advanced'
              ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
          >
            <Menu size={9} className={statsSubView === 'advanced' ? 'opacity-100' : 'opacity-40'} />
            <span>Details</span>
          </button>
        </div>

        <div className="flex items-center space-x-2.5">
          {statsSubView === 'general' && (
            <div className="flex items-center space-x-1">
              <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Character:</span>
              <select
                value={selectedCharacterId || ''}
                onChange={(e) => setSelectedCharacterId(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/80 text-[10px] h-[26px] px-2 rounded focus:outline-none focus:border-[#f0b419]/50 min-w-[110px] font-bold py-0 appearance-none"
              >
                <option value="">All Characters</option>
                {esiAccounts.map(acc => (
                  <option key={acc.character_id} value={acc.character_id}>{acc.character_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center space-x-1">
            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Date:</span>
            <select
              value={dateRangeType}
              onChange={(e) => setDateRangeType(e.target.value as any)}
              className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/80 text-[10px] h-[26px] px-2 rounded focus:outline-none focus:border-[#f0b419]/50 min-w-[100px] font-bold py-0 appearance-none"
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="Week">Last Week</option>
              <option value="Month">Last Month</option>
              <option value="Custom">Custom Range</option>
            </select>
          </div>

          {dateRangeType === 'Custom' && (
            <div className="flex items-center space-x-0.5 animate-in fade-in slide-in-from-right-1 duration-300">
              <div className="relative group">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/60 text-[9px] h-[26px] px-1.5 rounded w-[78px] flex justify-between items-center group-hover:border-[#f0b419]/40 transition-colors">
                  <span className="truncate">{customStartDate ? formatLocalDate(customStartDate) : 'From...'}</span>
                  <Calendar size={9} className="opacity-40" />
                </div>
              </div>
              <span className="text-gray-600 text-[8px] font-bold uppercase">to</span>
              <div className="relative group">
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/60 text-[9px] h-[26px] px-1.5 rounded w-[78px] flex justify-between items-center group-hover:border-[#f0b419]/40 transition-colors">
                  <span className="truncate">{customEndDate ? formatLocalDate(customEndDate) : 'To...'}</span>
                  <Calendar size={9} className="opacity-40" />
                </div>
              </div>
            </div>
          )}
          <div className="border-l border-white/5 h-4 mx-0.5"></div>

          <button
            onClick={syncAllWallets}
            disabled={isSyncingWallet || esiAccounts.length === 0}
            className="h-[26px] px-3 bg-[#f0b419]/5 border border-[#f0b419]/30 text-[#f0b419] rounded text-[9px] font-bold uppercase tracking-widest hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-all flex items-center space-x-2 disabled:opacity-40"
          >
            {isSyncingWallet ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            <span>{isSyncingWallet ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

    <div className="flex-1 flex flex-col min-h-0">

      {esiAccounts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 border border-[#f0b419]/20 rounded-xl bg-[#141414]/50 backdrop-blur-sm p-12 mt-4">
          <div className="w-20 h-20 bg-[#f0b419]/10 rounded-full flex items-center justify-center border border-[#f0b419]/30">
            <Activity size={40} className="text-[#f0b419]" />
          </div>
          <div className="text-center max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">No Characters Linked</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Connect your EVE Online account to automatically track your ISK income from bounty payouts and ESS transfers.
            </p>
          </div>
          <button
            onClick={handleLinkAccount}
            className="px-8 py-3 bg-[#f0b419] text-[#0a0a0a] font-black text-xs uppercase tracking-[0.2em] rounded hover:bg-white transition-all shadow-[0_0_20px_rgba(240,180,25,0.2)]"
          >
            Connect Account
          </button>
        </div>
      ) : statsSubView === 'general' ? (
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 mt-2">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[#141414] border border-[#f0b419]/30 p-5 rounded-xl relative overflow-hidden group flex flex-col justify-between min-h-[135px]">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <BarChart2 size={48} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#f0b419] uppercase tracking-[0.2em] mb-2">Total Income</div>
                <div className="text-5xl font-black text-white tracking-tighter flex items-baseline">
                  {incomeStats ? (incomeStats.totalIncome / 1000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0.0'}
                  <span className="text-xl ml-2 text-[#f0b419]/60">M</span>
                </div>
              </div>
            </div>
            <div className="bg-[#141414] border border-[#f0b419]/30 p-5 rounded-xl relative overflow-hidden group min-h-[135px]">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity size={48} />
              </div>
              <div className="text-xs font-bold text-[#f0b419] uppercase tracking-[0.2em] mb-2">Est. Income / Hour</div>
              <div className="text-5xl font-black text-white tracking-tighter flex items-baseline">
                TBD
              </div>
            </div>
          </div>

          {/* Sources Section */}
          <section>
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-baseline space-x-2">
                <h3 className="text-sm font-bold text-[#f0b419] uppercase tracking-[0.3em]">Income Sources</h3>
                <span className="text-[10px] font-mono text-[#f0b419]/60 uppercase tracking-widest">
                  | Totals
                </span>
              </div>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-[#f0b419]/30 to-transparent"></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <StatCard 
                label="Bounty Payouts" 
                count={incomeStats ? parseFloat((incomeStats.bountyTotal / 1000000).toFixed(2)) : 0} 
                total={incomeStats && incomeStats.totalIncome > 0 ? incomeStats.totalIncome / 1000000 : 0} 
                color="gold" 
              />
              <StatCard 
                label="ESS Payouts" 
                count={incomeStats ? parseFloat((incomeStats.essTotal / 1000000).toFixed(2)) : 0} 
                total={incomeStats && incomeStats.totalIncome > 0 ? incomeStats.totalIncome / 1000000 : 0} 
                color="gold" 
              />
              <StatCard 
                label="Additional Income" 
                count={incomeStats ? parseFloat((incomeStats.additional / 1000000).toFixed(2)) : 0} 
                total={incomeStats && incomeStats.totalIncome > 0 ? incomeStats.totalIncome / 1000000 : 0} 
                color="gold" 
                actions={
                  <button
                    onClick={() => setIsAddIncomeModalOpen(true)}
                    className="p-1 hover:bg-[#f0b419]/20 rounded text-[#f0b419] transition-all duration-200"
                    title="Add manual entry"
                  >
                    <Plus size={14} />
                  </button>
                }
              />
            </div>
          </section>

          {/* Efficiency Section */}
          <section>
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-baseline space-x-2">
                <h3 className="text-sm font-bold text-[#f0b419] uppercase tracking-[0.3em]">Income Analysis</h3>
                <span className="text-[10px] font-mono text-[#f0b419]/60 uppercase tracking-widest">
                  | Breakdown
                </span>
              </div>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-[#f0b419]/30 to-transparent"></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Ticks Breakdown */}
              <div className="bg-[#141414] border border-[#f0b419]/20 p-4 rounded-lg hover:bg-[#f0b419]/5 transition-all duration-200 shadow-[0_0_15px_rgba(240,180,25,0.05)] flex flex-col">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Bounty Payout Breakdown</div>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-[#f0b419]">
                    {incomeStats?.bountyCount || 0}
                  </div>
                  <div className="flex-1 ml-6 grid grid-cols-3 gap-2 border-l border-white/5 pl-4 py-1">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-tighter">Average</span>
                      <span className="text-xs font-bold text-gray-300">
                        {incomeStats && incomeStats.bountyCount > 0 ? (incomeStats.bountyTotal / incomeStats.bountyCount / 1000000).toFixed(2) : '0.00'}<span className="text-[9px] ml-0.5 opacity-50">M</span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-tighter">High</span>
                      <span className="text-xs font-bold text-gray-300">
                        {((incomeStats?.bountyMax || 0) / 1000000).toFixed(2)}<span className="text-[9px] ml-0.5 opacity-50">M</span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-tighter">Low</span>
                      <span className="text-xs font-bold text-gray-400">
                        {((incomeStats?.bountyMin || 0) / 1000000).toFixed(2)}<span className="text-[9px] ml-0.5 opacity-50">M</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payouts Breakdown */}
              <div className="bg-[#141414] border border-[#f0b419]/20 p-4 rounded-lg hover:bg-[#f0b419]/5 transition-all duration-200 shadow-[0_0_15px_rgba(240,180,25,0.05)] flex flex-col">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">ESS Payout Breakdown</div>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-[#f0b419]">
                    {incomeStats?.essCount || 0}
                  </div>
                  <div className="flex-1 ml-6 grid grid-cols-3 gap-2 border-l border-white/5 pl-4 py-1">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-tighter">Average</span>
                      <span className="text-xs font-bold text-gray-300">
                        {incomeStats && incomeStats.essCount > 0 ? (incomeStats.essTotal / incomeStats.essCount / 1000000).toFixed(2) : '0.00'}<span className="text-[9px] ml-0.5 opacity-50">M</span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-tighter">High</span>
                      <span className="text-xs font-bold text-gray-300">
                        {((incomeStats?.essMax || 0) / 1000000).toFixed(2)}<span className="text-[9px] ml-0.5 opacity-50">M</span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-tighter">Low</span>
                      <span className="text-xs font-bold text-gray-400">
                        {((incomeStats?.essMin || 0) / 1000000).toFixed(2)}<span className="text-[9px] ml-0.5 opacity-50">M</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Activity Chart */}
          <section>
            <div className="flex items-center w-full mb-3">
              <h3 className="text-[9px] font-bold text-[#f0b419] uppercase tracking-[0.3em] pr-3 whitespace-nowrap opacity-80">Income Activity (Last 30 Days)</h3>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-[#f0b419]/50 to-transparent"></div>
            </div>
            <div className="bg-transparent px-1">
              <div className="h-[80px] relative flex items-end space-x-1 px-1">
                {(() => {
                  const daily = incomeStats?.dailyIncome || [];
                  const maxAmount = Math.max(...daily.map(d => d.amount), 1);
                  
                  // Fill gaps in last 30 days
                  const chartData = Array.from({ length: 30 }, (_, i) => {
                    const now = new Date();
                    const baseDate = settings.timeDisplay === 'eve' 
                      ? new Date(now.getTime() + now.getTimezoneOffset() * 60000)
                      : now;
                    const date = format(subDays(baseDate, 29 - i), 'yyyy-MM-dd');
                    const found = daily.find(d => d.date === date);
                    return { 
                      date, 
                      amount: found?.amount || 0,
                      bounty: found?.bounty || 0,
                      ess: found?.ess || 0,
                      additional: found?.additional || 0
                    };
                  });

                  return chartData.map((d, index) => {
                    const heightPerc = (d.amount / maxAmount) * 100;
                    const alignLeft = index < 4;
                    const alignRight = index > 25;

                    return (
                      <div 
                        key={index} 
                        className="flex-1 flex flex-col justify-end items-center group relative h-full cursor-pointer"
                        onClick={() => {
                          setDateRangeType('Custom');
                          setCustomStartDate(d.date);
                          setCustomEndDate(d.date);
                        }}
                      >
                        <div className={`absolute -top-16 ${alignLeft ? 'left-0' : alignRight ? 'right-0' : 'left-1/2 -translate-x-1/2'} bg-[#1a1a1a] border border-[#f0b419]/50 text-[#f0b419] text-[10px] px-3 py-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col ${alignLeft ? 'items-start' : alignRight ? 'items-end' : 'items-center'} min-w-[140px]`}>
                          <span className="font-bold border-b border-[#f0b419]/30 pb-1 mb-1 w-full text-center">{format(new Date(d.date), 'EEEE, MMM dd')}</span>
                          <div className="flex flex-col w-full space-y-0.5">
                            <div className="flex justify-between items-center space-x-4">
                              <span className="text-gray-400 text-[9px]">Total Income:</span>
                              <span className="font-bold">{(d.amount / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M</span>
                            </div>
                            <div className="flex justify-between items-center space-x-4 text-[#00ff7f]">
                              <span className="opacity-70 text-[9px]">Bounty:</span>
                              <span className="font-bold">{(d.bounty / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M</span>
                            </div>
                            <div className="flex justify-between items-center space-x-4 text-[#00e5ff]">
                              <span className="opacity-70 text-[9px]">ESS:</span>
                              <span className="font-bold">{(d.ess / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M</span>
                            </div>
                            {d.additional > 0 && (
                              <div className="flex justify-between items-center space-x-4 text-[#bf94ff]">
                                <span className="opacity-70 text-[9px]">Additional:</span>
                                <span className="font-bold">{(d.additional / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div 
                          className={`w-full transition-all duration-300 rounded-t-[2px] ${d.amount > 0 ? 'bg-[#f0b419]/60 group-hover:bg-[#f0b419] shadow-[0_0_8px_rgba(240,180,25,0.4)]' : 'bg-[#f0b419]/10'}`}
                          style={{ height: d.amount > 0 ? `${Math.max(heightPerc, 8)}%` : '2px' }}
                        ></div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 flex flex-col mt-2 min-h-0">
          {/* Characters and Journal View */}
          <div className="flex-1 flex space-x-6 min-h-0">
            {/* Left side: Characters */}
            <div className="w-[145px] shrink-0 flex flex-col bg-[#141414]/30 border border-gray-800/40 rounded-xl p-3 overflow-hidden">
              <h3 className="text-[11px] font-bold text-[#f0b419] uppercase tracking-[0.2em] mb-3 opacity-80 border-b border-[#f0b419]/20 pb-1.5 flex items-center justify-between">
                <span>Characters</span>
                <span className="text-[10px] bg-[#f0b419]/10 px-1.5 rounded">{esiAccounts.length}</span>
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {esiAccounts.map(account => {
                  const isSelected = selectedCharacterId === account.character_id;
                  return (
                    <div 
                      key={account.character_id} 
                      onClick={() => setSelectedCharacterId(isSelected ? null : account.character_id)}
                      className={`bg-[#1a1a1a] border ${isSelected ? 'border-[#f0b419]/60 shadow-[0_0_10px_rgba(240,180,25,0.1)]' : 'border-gray-800'} p-3 rounded-lg flex flex-col items-center group cursor-pointer hover:border-gray-700 transition-all relative`}
                    >
                      <div className={`w-14 h-14 rounded-lg ${isSelected ? 'bg-[#f0b419]/20 border-[#f0b419]/40' : 'bg-[#f0b419]/5 border-[#f0b419]/20'} border overflow-hidden shrink-0 transition-colors mb-2`}>
                        <img 
                          src={`https://images.evetech.net/characters/${account.character_id}/portrait?size=128`} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 text-center">
                        <div className={`text-[12px] font-bold ${isSelected ? 'text-[#f0b419]' : 'text-gray-200'} leading-tight transition-colors`}>{account.character_name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  setSettingsActiveTab('characters');
                  setCurrentView('settings');
                }}
                className="mt-3 py-1.5 border border-[#f0b419]/30 bg-[#f0b419]/5 text-[#f0b419] text-[9px] uppercase font-bold tracking-widest rounded hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-all leading-tight"
              >
                Manage<br />Characters
              </button>
            </div>

            {/* Right side: Journal */}
            <div className="flex-1 flex flex-col bg-[#141414]/30 border border-gray-800/40 rounded-xl p-3 overflow-hidden min-w-0 relative">
              <div className="flex items-center justify-between mb-4 border-b border-[#f0b419]/20 pb-1.5">
                <h3 className="text-[11px] font-bold text-[#f0b419] uppercase tracking-[0.2em] opacity-80">Recent Journal Transactions</h3>
                <div className="flex items-center bg-[#0d0d0d] border border-gray-800 rounded p-0.5 h-[22px]">
                  <button 
                    onClick={() => setJournalFilter('all')}
                    className={`px-2 h-full rounded text-[8px] font-bold uppercase transition-all ${journalFilter === 'all' ? 'bg-[#f0b419]/20 text-[#f0b419]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setJournalFilter('api')}
                    className={`px-2 h-full rounded text-[8px] font-bold uppercase transition-all ${journalFilter === 'api' ? 'bg-[#f0b419]/20 text-[#f0b419]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    API
                  </button>
                  <button 
                    onClick={() => setJournalFilter('manual')}
                    className={`px-2 h-full rounded text-[8px] font-bold uppercase transition-all ${journalFilter === 'manual' ? 'bg-[#f0b419]/20 text-[#f0b419]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Manual
                  </button>
                </div>
              </div>
              <div 
                id="journal-scroll-container"
                className="flex-1 overflow-y-auto space-y-2 pr-1"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const reachingBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
                  if (reachingBottom && !isLoadingJournal && hasMoreJournal) {
                    fetchJournal();
                  }
                  setJournalShowScrollTop(target.scrollTop > 300);
                }}
              >
                {(() => {
                  const filteredJournal = walletJournal;

                  if (filteredJournal.length === 0) {
                    return <div className="h-full flex items-center justify-center text-gray-600 text-[12px] italic">No transaction history found for this selection.</div>;
                  }

                  return filteredJournal.map((entry) => {
                    const pilot = entry.character_id ? esiAccounts.find(acc => acc.character_id === entry.character_id) : null;
                    const entryTitle = entry.description || entry.ref_type;
                    const displayTitle = pilot ? `${entryTitle} - ${pilot.character_name}` : entryTitle;

                    return (
                      <div key={entry.ref_id} className="bg-[#1a1a1a] border border-gray-800/50 p-2.5 rounded-lg flex items-center justify-between text-xs hover:border-gray-700 transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300 group">
                        <div className="flex-1 flex items-center space-x-4 min-w-0">
                          <div className="flex flex-col items-center font-mono whitespace-nowrap min-w-[55px]">
                            <div className="text-[11px] font-bold text-gray-400">{formatTimestamp(entry.timestamp, 'HH:mm:ss')}</div>
                            <div className="text-[11px] font-bold text-gray-400 uppercase">{formatTimestamp(entry.timestamp, 'MMM dd')}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-200 font-medium truncate text-[13px]">{displayTitle}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{entry.ref_type.replace(/_/g, ' ')}</div>
                          </div>
                        </div>
                        <div className="flex items-center relative pl-4">
                          <div className={`font-bold text-[13px] text-right min-w-[90px] ${entry.amount > 0 ? 'text-[#00ff7f]' : 'text-red-500/70'}`}>
                            {entry.amount > 0 ? '+' : ''}{Math.round(entry.amount).toLocaleString()}
                          </div>
                          {entry.ref_type === 'manual_entry' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setJournalEntryToDelete(entry.ref_id);
                              }}
                              className="p-1 text-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 absolute right-[-4px] bg-[#1a1a1a]"
                              title="Delete manual entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
                {isLoadingJournal && (
                  <div className="py-4 flex justify-center">
                    <RefreshCw size={16} className="text-[#00ff7f] animate-spin opacity-50" />
                  </div>
                )}
              </div>
 
              {/* Floating Scroll Top Button */}
              {journalShowScrollTop && (
                <button
                  onClick={() => {
                    const el = document.getElementById('journal-scroll-container');
                    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="absolute bottom-4 right-4 p-2 bg-[#f0b419]/10 border border-[#f0b419]/40 text-[#f0b419] rounded-full hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-all duration-300 shadow-[0_0_15px_rgba(240,180,25,0.2)] animate-in fade-in zoom-in slide-in-from-bottom-2"
                  title="Scroll to Top"
                >
                  <ChevronUp size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );

  const isLandscape = settings.orientation === 'landscape';
  const isCombatStats = currentView === 'combatStats';
  const isBeltStats = currentView === 'beltStats';
  const isIncomeStats = currentView === 'incomeStats';
  const isSettings = currentView === 'settings';
  const isExpandedView = isCombatStats || isBeltStats || isSettings || isIncomeStats;
  const appWidth = isExpandedView ? 800 : (isLandscape ? 700 : 360);
  const appHeight = isCollapsed ? 28 : (isExpandedView ? 825 : (isLandscape ? 450 : 725));

  return (
    <div
      className="bg-[#0a0a0a] text-gray-300 font-sans flex flex-col overflow-hidden select-none origin-top-left outline-none relative"
      style={{
        width: `${appWidth}px`,
        height: `${appHeight}px`,
        transform: `scale(${isExpandedView ? 1 : settings.globalScale})`,
        opacity: isExpandedView ? 1.0 : settings.windowOpacity,
        border: '1px solid #0a0a0a',
        boxSizing: 'border-box',
        boxShadow: 'none'
      }}
    >
      {isAppReady ? (
        <>
          <Titlebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
          <header className="px-4 py-2 border-b border-[#f0b419]/10 flex justify-between items-center relative z-20 bg-[#0a0a0a]">
            <div className="flex space-x-6">
              {settings.combatAnomalyTracking && (
                <>
                  <button
                    onClick={() => setCurrentView('combat')}
                    className={`text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${currentView === 'combat' ? 'text-[#f0b419]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Combat Log
                  </button>
                  <button
                    onClick={() => setCurrentView('combatStats')}
                    className={`text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${currentView === 'combatStats' ? 'text-[#f0b419]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Combat Stats
                  </button>
                </>
              )}
              {settings.beltTracking && (
                <>
                  <button
                    onClick={() => setCurrentView('belt')}
                    className={`text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${currentView === 'belt' ? 'text-[#f0b419]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Belt Log
                  </button>
                  <button
                    onClick={() => setCurrentView('beltStats')}
                    className={`text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${currentView === 'beltStats' ? 'text-[#f0b419]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Belt Stats
                  </button>
                </>
              )}
              <button
                onClick={() => setCurrentView('incomeStats')}
                className={`text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${currentView === 'incomeStats' ? 'text-[#f0b419]' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Income Stats
              </button>
            </div>
            <button
              onClick={() => {
                setSettingsActiveTab('window');
                setCurrentView('settings');
              }}
              className={`transition-colors p-1 ${currentView === 'settings' ? 'text-[#f0b419]' : 'text-gray-500 hover:text-[#f0b419]'}`}
              title="Settings"
            >
              <SettingsIcon size={18} />
            </button>
          </header>

          <div className={`flex-1 flex flex-col ${isExpandedView ? 'p-0' : 'p-4'} overflow-hidden relative`}>
            {currentView === 'combat' && (
              <div className={`flex-1 flex ${isLandscape ? 'flex-row space-x-6' : 'flex-col'} overflow-hidden`}>
                <div className={isLandscape ? 'w-1/2 flex flex-col' : ''}>
                  {!isLandscape && (
                    <div className="mb-4">
                      {settings.preferredSystems.length > 0 ? (
                        <div className="flex space-x-3">
                          <div className="w-[40%]">
                            <label className="block text-xs font-semibold text-[#f0b419] uppercase tracking-wider mb-2">
                              System
                            </label>
                            <select
                              value={selectedSystem}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedSystem(val);
                                localStorage.setItem('anomtracker_selected_system', val);
                              }}
                              className="w-full bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] appearance-none"
                            >
                              <option value="">Select...</option>
                              {settings.preferredSystems.map((sys) => (
                                <option key={sys} value={sys}>
                                  {sys}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-[60%]">
                            <label className="block text-xs font-semibold text-[#f0b419] uppercase tracking-wider mb-2">
                              Site Info
                            </label>
                            <select
                              value={siteType}
                              onChange={handleSiteTypeChange}
                              className="w-full bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] appearance-none"
                            >
                              {siteTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-semibold text-[#f0b419] uppercase tracking-wider mb-2">
                            Site Info
                          </label>
                          <select
                            value={siteType}
                            onChange={handleSiteTypeChange}
                            className="w-full bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] appearance-none"
                          >
                            {siteTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold text-[#00ff7f]/70 uppercase tracking-widest mb-1 border-b border-[#00ff7f]/20 pb-1">Escalations</div>
                      <ToggleButton
                        label="DED Site"
                        active={toggles.was_ded_escalation}
                        onClick={() => toggleState('was_ded_escalation')}
                        color="green"
                      />
                      <ToggleButton
                        label="Occupied Mine"
                        active={toggles.was_occ_mine_escalation}
                        onClick={() => toggleState('was_occ_mine_escalation')}
                        color="green"
                      />
                      <ToggleButton
                        label="Capital Staging"
                        active={toggles.was_cap_stag_escalation}
                        onClick={() => toggleState('was_cap_stag_escalation')}
                        color="green"
                      />
                      <ToggleButton
                        label="Shielded Starbase"
                        active={toggles.was_shld_starb_escalation}
                        onClick={() => toggleState('was_shld_starb_escalation')}
                        color="green"
                      />
                      <ToggleButton
                        label="Attack Site"
                        active={toggles.was_attack_site_escalation}
                        onClick={() => toggleState('was_attack_site_escalation')}
                        color="green"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold text-[#00e5ff]/70 uppercase tracking-widest mb-1 border-b border-[#00e5ff]/20 pb-1">Special Spawns</div>
                      <ToggleButton
                        label="Faction Subcapital"
                        active={toggles.was_faction_npc_spawn}
                        onClick={() => toggleState('was_faction_npc_spawn')}
                        color="blue"
                      />
                      <ToggleButton
                        label="Capital"
                        active={toggles.was_capital_spawn}
                        onClick={() => toggleState('was_capital_spawn')}
                        color="blue"
                      />
                      <ToggleButton
                        label="Faction Capital"
                        active={toggles.was_faction_capital_spawn}
                        onClick={() => toggleState('was_faction_capital_spawn')}
                        color="blue"
                      />
                      <ToggleButton
                        label="Titan"
                        active={toggles.was_titan_spawn}
                        onClick={() => toggleState('was_titan_spawn')}
                        color="blue"
                      />
                    </div>
                  </div>

                  {!isLandscape && (
                    <button
                      onClick={submitSiteLog}
                      disabled={!db}
                      className={`w-full py-3 bg-[#141414] border-2 text-[#f0b419] font-bold text-lg uppercase tracking-widest rounded transition-all duration-200 shadow-[0_0_15px_rgba(240,180,25,0.3)] hover:shadow-[0_0_25px_rgba(240,180,25,0.6)] disabled:opacity-50 disabled:cursor-not-allowed mb-4 ${isFlashing ? 'border-[#00ff7f] shadow-[0_0_30px_rgba(0,255,127,0.8)] scale-[1.02]' : 'border-[#f0b419] hover:bg-[#f0b419] hover:text-[#0a0a0a]'
                        }`}
                    >
                      Log Site
                    </button>
                  )}
                </div>

                <div className={`flex-1 flex flex-col overflow-hidden ${isLandscape ? 'border-l border-gray-800 pl-4' : ''}`}>
                  {isLandscape && (
                    <div className="space-y-4 mb-4">
                      {settings.preferredSystems.length > 0 ? (
                        <div className="flex space-x-3">
                          <div className="w-[40%]">
                            <label className="block text-xs font-semibold text-[#f0b419] uppercase tracking-wider mb-2">
                              System
                            </label>
                            <select
                              value={selectedSystem}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedSystem(val);
                                localStorage.setItem('anomtracker_selected_system', val);
                              }}
                              className="w-full bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] appearance-none"
                            >
                              <option value="">Select...</option>
                              {settings.preferredSystems.map((sys) => (
                                <option key={sys} value={sys}>
                                  {sys}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-[60%]">
                            <label className="block text-xs font-semibold text-[#f0b419] uppercase tracking-wider mb-2">
                              Site Info
                            </label>
                            <select
                              value={siteType}
                              onChange={handleSiteTypeChange}
                              className="w-full bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] appearance-none"
                            >
                              {siteTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-semibold text-[#f0b419] uppercase tracking-wider mb-2">
                            Site Info
                          </label>
                          <select
                            value={siteType}
                            onChange={handleSiteTypeChange}
                            className="w-full bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] appearance-none"
                          >
                            {siteTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        onClick={submitSiteLog}
                        disabled={!db}
                        className={`w-full py-3 bg-[#141414] border-2 text-[#f0b419] font-bold text-lg uppercase tracking-widest rounded transition-all duration-200 shadow-[0_0_15px_rgba(240,180,25,0.3)] hover:shadow-[0_0_25px_rgba(240,180,25,0.6)] disabled:opacity-50 disabled:cursor-not-allowed mb-4 ${isFlashing ? 'border-[#00ff7f] shadow-[0_0_30px_rgba(0,255,127,0.8)] scale-[1.02]' : 'border-[#f0b419] hover:bg-[#f0b419] hover:text-[#0a0a0a]'
                          }`}
                      >
                        Log Site
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3 border-b border-[#f0b419]/30 pb-1">
                    <h2 className="text-xs font-semibold text-[#f0b419] uppercase tracking-wider flex items-center">
                      Recent History
                      <span className="text-gray-500 ml-2 font-normal">| {recentCount} SITES</span>
                    </h2>
                    <button
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="text-xs text-gray-400 hover:text-[#f0b419] transition-colors cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {history.length === 0 ? (
                      <p className="text-xs text-gray-500 italic text-center py-4">
                        No sites logged yet.
                      </p>
                    ) : (
                      history.map((log) => {
                        const timeStr = formatTimestamp(log.timestamp, 'HH:mm:ss');
                        const icons = getActiveIcons(log);

                        return (
                          <div
                            key={log.id}
                            className="flex items-center justify-between bg-[#141414] border border-gray-800 p-2 rounded text-xs group"
                          >
                            <div className="flex-1 truncate pr-2">
                              <span className="text-gray-500 mr-2">[{timeStr}]</span>
                              <span className="text-gray-200 font-medium">
                                {log.location_system ? `${log.location_system} - ` : ''}{log.site_type}
                              </span>
                              {icons.length > 0 && (
                                <span className="ml-2">
                                  <span className="text-gray-500 mr-1">-</span>
                                  {icons.map((icon, idx) => (
                                    <span key={idx}>
                                      <span className={`text-[10px] tracking-wider ${icon.color === 'gold' ? 'text-[#f0b419]' : icon.color === 'green' ? 'text-[#00ff7f]' : 'text-[#00e5ff]'}`}>
                                        {icon.label}
                                      </span>
                                      {idx < icons.length - 1 && <span className="text-gray-600 mx-0.5">,</span>}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => requestDelete(log.id)}
                              className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                              title="Delete log"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentView === 'belt' && (
              <div className={`flex-1 flex ${isLandscape ? 'flex-row space-x-6' : 'flex-col'} overflow-hidden`}>
                <div className={isLandscape ? 'w-1/2 flex flex-col' : ''}>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-[#f0b419] uppercase tracking-wider mb-2">
                      System
                    </label>
                    <select
                      value={selectedSystem}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedSystem(val);
                        localStorage.setItem('anomtracker_selected_system', val);
                      }}
                      className="w-full bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] appearance-none"
                    >
                      <option value="">Select...</option>
                      {settings.preferredSystems.map((sys) => (
                        <option key={sys} value={sys}>
                          {sys}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="text-[10px] font-bold text-[#f0b419] uppercase tracking-widest mb-1 border-b border-[#f0b419]/30 pb-1">Special Spawns</div>
                    <ToggleButton
                      label="Faction Subcapital"
                      active={beltToggles.was_faction_spawn}
                      onClick={() => setBeltToggles(prev => ({ ...prev, was_faction_spawn: !prev.was_faction_spawn }))}
                      color="emerald"
                    />
                    <ToggleButton
                      label="Hauler NPC"
                      active={beltToggles.was_hauler_spawn}
                      onClick={() => setBeltToggles(prev => ({ ...prev, was_hauler_spawn: !prev.was_hauler_spawn }))}
                      color="cyan"
                    />
                    <div className="flex space-x-2">
                      <div className={beltToggles.was_officer_spawn ? "w-1/2" : "w-full"}>
                        <ToggleButton
                          label="Officer"
                          active={beltToggles.was_officer_spawn}
                          onClick={() => {
                            const newState = !beltToggles.was_officer_spawn;
                            setBeltToggles(prev => ({ ...prev, was_officer_spawn: newState }));
                            if (!newState) setOfficerError(false);
                          }}
                          color="purple"
                        />
                      </div>
                      {beltToggles.was_officer_spawn && (
                        <div className="w-1/2 relative animate-in fade-in slide-in-from-left-2 duration-200">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                            <Search size={12} className="text-[#bf94ff]/50" />
                          </div>
                          <input
                            type="text"
                            value={officerName}
                            onChange={(e) => {
                              setOfficerName(e.target.value);
                              if (officerError) setOfficerError(false);
                            }}
                            placeholder="Search..."
                            className={`w-full h-full bg-[#141414] border ${officerError ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-[#bf94ff]/50'} text-white pl-8 pr-2 rounded text-[11px] focus:outline-none ${officerError ? 'focus:border-red-500' : 'focus:border-[#bf94ff]'} focus:ring-1 ${officerError ? 'focus:ring-red-500' : 'focus:ring-[#bf94ff]'} transition-all duration-200`}
                          />

                          {filteredOfficers.length > 0 && officerName !== filteredOfficers[0] && (
                            <div className="absolute z-30 w-full bottom-full mb-1 bg-[#1a1a1a] border border-[#bf94ff]/30 rounded shadow-xl max-h-48 overflow-y-auto">
                              {filteredOfficers.map(name => (
                                <button
                                  key={name}
                                  onClick={() => {
                                    setOfficerName(name);
                                    setFilteredOfficers([]);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#bf94ff]/10 hover:text-[#bf94ff] flex justify-between items-center group"
                                >
                                  <span>{name}</span>
                                  <Plus size={12} className="opacity-0 group-hover:opacity-100" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={submitBeltLog}
                    disabled={!db}
                    className={`w-full py-3 bg-[#141414] border-2 text-[#f0b419] font-bold text-lg uppercase tracking-widest rounded transition-all duration-200 shadow-[0_0_15px_rgba(240,180,25,0.3)] hover:shadow-[0_0_25px_rgba(240,180,25,0.6)] disabled:opacity-50 disabled:cursor-not-allowed mb-4 ${isFlashing ? 'border-[#00ff7f] shadow-[0_0_30px_rgba(0,255,127,0.8)] scale-[1.02]' : 'border-[#f0b419] hover:bg-[#f0b419] hover:text-[#0a0a0a]'
                      }`}
                  >
                    Log Belt
                  </button>
                </div>

                <div className={`flex-1 flex flex-col overflow-hidden ${isLandscape ? 'border-l border-gray-800 pl-4' : ''}`}>
                  <div className="flex items-center justify-between mb-3 border-b border-[#f0b419]/30 pb-1">
                    <h2 className="text-xs font-semibold text-[#f0b419] uppercase tracking-wider flex items-center">
                      Recent History
                      <span className="text-gray-500 ml-2 font-normal">| {beltRecentCount} BELTS</span>
                    </h2>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {beltHistory.length === 0 ? (
                      <p className="text-xs text-gray-500 italic text-center py-4">
                        No belts logged yet.
                      </p>
                    ) : (
                      beltHistory.map((log) => {
                        const timeStr = formatTimestamp(log.timestamp, 'HH:mm:ss');
                        const outcomeIcons: { label: string; color: 'gold' | 'blue' | 'green' | 'emerald' | 'cyan' | 'purple' }[] = [];
                        if (log.was_faction_spawn === 1) outcomeIcons.push({ label: 'FAC-SUB', color: 'emerald' });
                        if (log.was_hauler_spawn === 1) outcomeIcons.push({ label: 'Hauler', color: 'cyan' });
                        if (log.was_officer_spawn === 1) outcomeIcons.push({ label: `Officer: ${log.officer_name || 'Unknown'}`, color: 'purple' });

                        return (
                          <div
                            key={log.id}
                            className="flex items-center justify-between bg-[#141414] border border-gray-800 p-2 rounded text-xs group"
                          >
                            <div className="flex-1 truncate pr-2">
                              <span className="text-gray-500 mr-2">[{timeStr}]</span>
                              {(() => {
                                const duration = getSiteDuration(log.timestamp, log.prev_timestamp);
                                return duration ? <span className="text-[#00ff7f]/70 font-mono text-[10px] mr-2">({duration})</span> : null;
                              })()}
                              <span className="text-gray-200 font-medium">
                                {log.location_system || 'Unknown System'}
                              </span>
                              {outcomeIcons.length > 0 && (
                                <span className="ml-2">
                                  <span className="text-gray-500 mr-1">-</span>
                                  {outcomeIcons.map((icon, idx) => (
                                    <span key={idx}>
                                      <span className={`text-[10px] tracking-wider ${icon.color === 'emerald' ? 'text-[#50c878]' :
                                        icon.color === 'cyan' ? 'text-[#00ffff]' :
                                          icon.color === 'purple' ? 'text-[#bf94ff]' :
                                            'text-[#f0b419]'
                                        }`}>
                                        {icon.label}
                                      </span>
                                      {idx < outcomeIcons.length - 1 && <span className="text-gray-600 mx-0.5">,</span>}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => setBeltLogToDelete(log.id)}
                              className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                              title="Delete log"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
            {currentView === 'incomeStats' && renderIncomeStatsView()}
            {currentView === 'combatStats' && stats && (
              <div className="flex-1 overflow-y-auto pt-[5px] px-6 pb-2 space-y-6 animate-in fade-in duration-500">
                {/* Header Row: Sub-view Toggle & Filters */}
                <div className="flex items-center justify-between mb-4 mt-1">
                  <div className="flex items-center bg-[#141414]/50 border border-[#f0b419]/10 p-0.5 rounded-lg shadow-lg h-[28px]">
                    <button
                      onClick={() => setStatsSubView('general')}
                      className={`h-full px-3 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${statsSubView === 'general'
                        ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                        }`}
                    >
                      <BarChart2 size={9} className={statsSubView === 'general' ? 'opacity-100' : 'opacity-40'} />
                      <span>General</span>
                    </button>
                    <button
                      onClick={() => setStatsSubView('advanced')}
                      className={`h-full px-3 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${statsSubView === 'advanced'
                        ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                        }`}
                    >
                      <Activity size={9} className={statsSubView === 'advanced' ? 'opacity-100' : 'opacity-40'} />
                      <span>Advanced</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Site:</span>
                      <select
                        value={statsFilter}
                        onChange={(e) => setStatsFilter(e.target.value)}
                        className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/80 text-[10px] h-[26px] px-2 rounded focus:outline-none focus:border-[#f0b419]/50 min-w-[125px] font-bold py-0"
                      >
                        <option value="All">All Sites</option>
                        {siteTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Date:</span>
                      <select
                        value={dateRangeType}
                        onChange={(e) => setDateRangeType(e.target.value as any)}
                        className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/80 text-[10px] h-[26px] px-2 rounded focus:outline-none focus:border-[#f0b419]/50 min-w-[105px] font-bold py-0"
                      >
                        <option value="All">All Time</option>
                        <option value="Today">Today</option>
                        <option value="Week">Last Week</option>
                        <option value="Month">Last Month</option>
                        <option value="Custom">Custom Range</option>
                      </select>
                    </div>

                    {dateRangeType === 'Custom' && (
                      <div className="flex items-center space-x-1 animate-in fade-in slide-in-from-right-1 duration-300">
                        <div className="relative group">
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/60 text-[9px] h-[26px] px-1.5 rounded w-[82px] flex justify-between items-center group-hover:border-[#f0b419]/40 transition-colors">
                            <span className="truncate">{customStartDate ? formatLocalDate(customStartDate) : 'From...'}</span>
                            <Calendar size={9} className="opacity-40" />
                          </div>
                        </div>
                        <span className="text-gray-600 text-[8px] font-bold uppercase">to</span>
                        <div className="relative group">
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/60 text-[9px] h-[26px] px-1.5 rounded w-[82px] flex justify-between items-center group-hover:border-[#f0b419]/40 transition-colors">
                            <span className="truncate">{customEndDate ? formatLocalDate(customEndDate) : 'To...'}</span>
                            <Calendar size={9} className="opacity-40" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Header Stats - Always Visible */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-[#141414] border border-[#f0b419]/30 p-5 rounded-xl relative overflow-hidden group flex flex-col justify-between min-h-[135px]">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <BarChart2 size={48} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#f0b419] uppercase tracking-[0.2em] mb-2">Total Sites Tracked</div>
                      <div className="text-5xl font-black text-white tracking-tighter">
                        {stats.totalSites}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setIsTrackedSitesModalOpen(true);
                          fetchTrackedSites(true);
                        }}
                        className="text-[10px] font-bold text-[#f0b419] hover:text-white transition-colors uppercase tracking-widest flex items-center space-x-1 p-2 -mr-2 -mb-2 cursor-pointer"
                      >
                        <span>View</span>
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#141414] border border-[#f0b419]/30 p-5 rounded-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Activity size={48} />
                    </div>
                    <div className="text-xs font-bold text-[#f0b419] uppercase tracking-[0.2em] mb-2">Special Outcome %</div>
                    <div className="text-5xl font-black text-white tracking-tighter">
                      {stats.totalSites > 0 ? ((stats.successfulSites / stats.totalSites) * 100).toFixed(1) : '0.0'}%
                    </div>
                  </div>
                </div>

                {/* Sub-view Content */}
                {statsSubView === 'general' ? (
                  <>
                    {/* Escalations Section */}
                    <section>
                      {(() => {
                        const totalEsc = stats.escalations.ded + stats.escalations.occupiedMine + stats.escalations.capitalStaging + stats.escalations.shieldedStarbase + stats.escalations.attackSite;
                        const escPerc = stats.totalSites > 0 ? ((totalEsc / stats.totalSites) * 100).toFixed(1) : '0.0';
                        return (
                          <div className="flex items-center space-x-4 mb-4">
                            <div className="flex items-baseline space-x-2">
                              <h3 className="text-sm font-bold text-[#00ff7f] uppercase tracking-[0.3em]">Escalations</h3>
                              <span className="text-[10px] font-mono text-[#00ff7f]/60 uppercase tracking-widest">
                                | {totalEsc} Total ({escPerc}%)
                              </span>
                            </div>
                            <div className="flex-1 h-[1px] bg-gradient-to-r from-[#00ff7f]/30 to-transparent"></div>
                          </div>
                        );
                      })()}
                      <div className="grid grid-cols-3 gap-4">
                        <StatCard label="DED Site" count={stats.escalations.ded} total={stats.totalSites} color="green" />
                        <StatCard label="Occupied Mine" count={stats.escalations.occupiedMine} total={stats.totalSites} color="green" />
                        <StatCard label="Attack Site" count={stats.escalations.attackSite} total={stats.totalSites} color="green" highlighted={true} className="row-span-2" />
                        <StatCard label="Capital Staging" count={stats.escalations.capitalStaging} total={stats.totalSites} color="green" />
                        <StatCard label="Shielded Starbase" count={stats.escalations.shieldedStarbase} total={stats.totalSites} color="green" />
                      </div>
                    </section>

                    {/* Special Spawns Section */}
                    <section>
                      {(() => {
                        const totalSpawns = stats.specialSpawns.factionSubcap + stats.specialSpawns.capital + stats.specialSpawns.factionCapital + stats.specialSpawns.titan;
                        const spawnPerc = stats.totalSites > 0 ? ((totalSpawns / stats.totalSites) * 100).toFixed(1) : '0.0';
                        return (
                          <div className="flex items-center space-x-4 mb-4">
                            <div className="flex items-baseline space-x-2">
                              <h3 className="text-sm font-bold text-[#00e5ff] uppercase tracking-[0.3em]">Special Spawns</h3>
                              <span className="text-[10px] font-mono text-[#00e5ff]/60 uppercase tracking-widest">
                                | {totalSpawns} Total ({spawnPerc}%)
                              </span>
                            </div>
                            <div className="flex-1 h-[1px] bg-gradient-to-r from-[#00e5ff]/30 to-transparent"></div>
                          </div>
                        );
                      })()}
                      <div className="grid grid-cols-4 gap-4">
                        <StatCard label="Faction Subcapital" count={stats.specialSpawns.factionSubcap} total={stats.totalSites} color="blue" />
                        <StatCard label="Capital" count={stats.specialSpawns.capital} total={stats.totalSites} color="blue" />
                        <StatCard label="Faction Capital" count={stats.specialSpawns.factionCapital} total={stats.totalSites} color="blue" />
                        <StatCard label="Titan" count={stats.specialSpawns.titan} total={stats.totalSites} color="blue" />
                      </div>
                    </section>
                  </>
                ) : (
                  <>
                    {/* Advanced View: Hourly Analysis */}
                    <section>
                      <div className="flex items-center w-full mb-3">
                        <h3 className="text-[9px] font-bold text-[#00e5ff] uppercase tracking-[0.3em] pr-3 whitespace-nowrap opacity-80">Hourly Activity & Rate</h3>
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-[#00e5ff]/50 to-transparent"></div>
                      </div>
                      <div className="bg-[#141414] border border-gray-800/50 rounded-lg pt-4 px-4 pb-[5px]">
                        <div className="h-[123px] relative">
                          {(() => {
                            const hours = Array.from({ length: 24 }, (_, i) => i);
                            const statsByHour = hours.map(hour => {
                              const stat = hourlyStats.find(s => s.hour === hour);
                              const total = stat?.total || 0;
                              const special = stat?.special || 0;
                              const percentage = total > 0 ? (special / total) * 100 : 0;
                              return { hour, total, special, percentage };
                            });

                            const maxCount = Math.max(...statsByHour.map(s => s.total), 1);
                            const maxPerc = Math.max(...statsByHour.map(s => s.percentage), 1);

                            const lineD = statsByHour.every(s => s.total === 0)
                              ? ""
                              : statsByHour.reduce((acc, s, i) => {
                                const x = (i + 0.5) * (700 / 24);
                                // Absolute top edge mapping with more variation
                                const y = 15 + (1 - (s.percentage / Math.max(maxPerc, 1))) * 30;
                                return acc + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
                              }, "");

                            return (
                              <>
                                {/* Bars Layer (Site Count) */}
                                <div className="absolute inset-0 flex items-end space-x-[2px] z-20 px-1 pb-[5px]">
                                  {statsByHour.map((s, index) => {
                                    const heightPerc = (s.total / maxCount) * 60;
                                    const isLeftEdge = index <= 1;
                                    const isRightEdge = index >= 22;

                                    return (
                                      <div
                                        key={index}
                                        className="flex-1 flex flex-col justify-end items-center group relative h-full cursor-default"
                                      >
                                        <div className={`absolute -top-[49px] ${isLeftEdge ? 'left-0' : isRightEdge ? 'right-0' : 'left-1/2 -translate-x-1/2'} bg-[#1a1a1a] border border-[#00e5ff]/50 text-[#00e5ff] text-[10px] px-3 py-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col items-center min-w-[100px]`}>
                                          <span className="font-bold border-b border-[#00e5ff]/30 pb-1 mb-1 w-full text-center">{String(s.hour).padStart(2, '0')}:00 - {String(s.hour).padStart(2, '0')}:59</span>
                                          <div className="flex flex-col w-full space-y-0.5">
                                            <div className="flex justify-between items-center space-x-4">
                                              <span className="text-gray-400 text-[9px]">Sites Run:</span>
                                              <span className="font-bold">{s.total}</span>
                                            </div>
                                            <div className="flex justify-between items-center space-x-4">
                                              <span className="text-gray-400 text-[9px]">Special:</span>
                                              <span className="font-bold">{s.special}</span>
                                            </div>
                                            <div className="flex justify-between items-center space-x-4 text-[#00ff7f]">
                                              <span className="opacity-70 text-[9px]">Success Rate:</span>
                                              <span className="font-bold">{s.percentage.toFixed(1)}%</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div
                                          className={`w-full transition-all duration-300 rounded-t-[1px] relative ${s.total > 0 ? 'bg-[#00e5ff]/10 border border-[#00e5ff]/20 group-hover:bg-[#00e5ff]/25' : 'bg-[#00e5ff]/5'}`}
                                          style={{ height: s.total > 0 ? `${Math.max(heightPerc, 8)}%` : '2px' }}
                                        >
                                          {s.total > 0 && (
                                            <div className="absolute top-1 left-0 right-0 text-[7px] font-bold text-[#00e5ff]/60 text-center pointer-events-none">
                                              {s.total}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-gray-600 mt-1 font-mono group-hover:text-gray-400 transition-colors">{String(s.hour).padStart(2, '0')}</div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Line Layer (Success Rate) */}
                                <svg
                                  className="absolute inset-0 w-full h-full pointer-events-none z-10 px-1 overflow-visible"
                                  viewBox="0 0 700 123"
                                  preserveAspectRatio="none"
                                >
                                  {lineD && (
                                    <g>
                                      <path
                                        d={lineD}
                                        fill="none"
                                        stroke="#00ff7f"
                                        strokeWidth="1.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="drop-shadow-[0_0_4px_rgba(0,255,127,0.2)]"
                                      />
                                      {statsByHour.map((s, i) => {
                                        if (s.total === 0) return null;
                                        const x = (i + 0.5) * (700 / 24);
                                        // Scale trend to max variation for clarity
                                        const y = 15 + (1 - (s.percentage / Math.max(maxPerc, 1))) * 30;
                                        return (
                                          <g key={i}>
                                            <circle
                                              cx={x}
                                              cy={y}
                                              r="1.5"
                                              fill="#141414"
                                              stroke="#00ff7f"
                                              strokeWidth="0.8"
                                            />
                                            {s.total > 0 && (
                                              <text
                                                x={x}
                                                y={y - 8}
                                                textAnchor="middle"
                                                fill="#00ff7f"
                                                className="text-[10px] font-black font-mono drop-shadow-[0_0_2px_rgba(0,0,0,1)]"
                                                style={{ fontSize: '11px' }}
                                              >
                                                {s.percentage.toFixed(0)}%
                                              </text>
                                            )}
                                          </g>
                                        );
                                      })}
                                    </g>
                                  )}
                                </svg>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </section>

                    {/* Advanced View: Daily Analysis */}
                    <section>
                      <div className="flex items-center w-full mb-3">
                        <h3 className="text-[9px] font-bold text-[#00e5ff] uppercase tracking-[0.3em] pr-3 whitespace-nowrap opacity-80">Daily Activity & Rate</h3>
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-[#00e5ff]/50 to-transparent"></div>
                      </div>
                      <div className="bg-[#141414] border border-gray-800/50 rounded-lg pt-4 px-4 pb-[5px]">
                        <div className="h-[123px] relative">
                          {(() => {
                            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                            const sqlDayMap = [1, 2, 3, 4, 5, 6, 0];
                            const statsByDay = sqlDayMap.map(sqlDay => {
                              const stat = weeklyStats.find(s => s.day === sqlDay);
                              const total = stat?.total || 0;
                              const special = stat?.special || 0;
                              const percentage = total > 0 ? (special / total) * 100 : 0;
                              return { total, special, percentage };
                            });

                            const maxCount = Math.max(...statsByDay.map(s => s.total), 1);
                            const maxPerc = Math.max(...statsByDay.map(s => s.percentage), 1);

                            // Calculate points for the SVG line
                            // We use -20px top offset for the percentage labels if needed, or just keep it in the chart area.
                            // The chart height is 112. Let's use 80% for the max line height to leave room for labels.
                            const linePoints = statsByDay.map((s, i) => {
                              const xPerc = (i + 0.5) * (100 / 7);
                              const yPerc = 100 - (s.total > 0 ? (s.percentage / Math.max(maxPerc, 1)) * 70 : 0) - 15; // 15% bottom padding
                              return `${xPerc}% ${yPerc}%`;
                            });

                            const lineD = statsByDay.every(s => s.total === 0)
                              ? ""
                              : statsByDay.reduce((acc, s, i) => {
                                const x = (i + 0.5) * 100;
                                // Absolute top edge mapping with more variation
                                const y = 15 + (1 - (s.percentage / Math.max(maxPerc, 1))) * 30;
                                return acc + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
                              }, "");

                            return (
                              <>
                                {/* Bars Layer (Site Count) - Raised to z-20 so tooltips are in front */}
                                <div className="absolute inset-0 flex items-end space-x-3 z-20 px-1 pb-[5px]">
                                  {statsByDay.map((s, index) => {
                                    // Scale bars to 60% max height
                                    const heightPerc = (s.total / maxCount) * 60;
                                    return (
                                      <div
                                        key={index}
                                        className="flex-1 flex flex-col justify-end items-center group relative h-full cursor-default"
                                      >
                                        <div className="absolute -top-[49px] left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#00e5ff]/50 text-[#00e5ff] text-[10px] px-3 py-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col items-center min-w-[100px]">
                                          {(() => {
                                            const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                                            return <span className="font-bold border-b border-[#00e5ff]/30 pb-1 mb-1 w-full text-center">{fullDayNames[index]}</span>;
                                          })()}
                                          <div className="flex flex-col w-full space-y-0.5">
                                            <div className="flex justify-between items-center space-x-4">
                                              <span className="text-gray-400 text-[9px]">Sites Run:</span>
                                              <span className="font-bold">{s.total}</span>
                                            </div>
                                            <div className="flex justify-between items-center space-x-4">
                                              <span className="text-gray-400 text-[9px]">Special:</span>
                                              <span className="font-bold">{s.special}</span>
                                            </div>
                                            <div className="flex justify-between items-center space-x-4 text-[#00ff7f]">
                                              <span className="opacity-70 text-[9px]">Success Rate:</span>
                                              <span className="font-bold">{s.percentage.toFixed(1)}%</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div
                                          className={`w-full transition-all duration-300 rounded-t-[3px] relative ${s.total > 0 ? 'bg-[#00e5ff]/10 border border-[#00e5ff]/20 group-hover:bg-[#00e5ff]/25 shadow-[0_4px_12px_rgba(0,229,255,0.05)]' : 'bg-[#00e5ff]/5'}`}
                                          style={{ height: s.total > 0 ? `${Math.max(heightPerc, 8)}%` : '2px' }}
                                        >
                                          {s.total > 0 && (
                                            <div className="absolute top-1 left-0 right-0 text-[8.5px] font-bold text-[#00e5ff]/60 text-center pointer-events-none">
                                              {s.total}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-gray-600 mt-1 font-bold uppercase tracking-wider group-hover:text-gray-300 transition-colors">{dayNames[index]}</div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Line Layer (Success Rate) */}
                                <svg
                                  className="absolute inset-0 w-full h-full pointer-events-none z-10 px-1 overflow-visible"
                                  viewBox="0 0 700 123"
                                  preserveAspectRatio="none"
                                >
                                  {lineD && (
                                    <>
                                      <path
                                        d={lineD}
                                        fill="none"
                                        stroke="#00ff7f"
                                        strokeWidth="1.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="drop-shadow-[0_0_4px_rgba(0,255,127,0.2)]"
                                      />
                                      {statsByDay.map((s, i) => {
                                        if (s.total === 0) return null;
                                        const x = (i + 0.5) * 100;
                                        // Absolute top mapping with more variation
                                        const y = 15 + (1 - (s.percentage / Math.max(maxPerc, 1))) * 30;
                                        return (
                                          <g key={i}>
                                            <circle
                                              cx={x}
                                              cy={y}
                                              r="1.8"
                                              fill="#141414"
                                              stroke="#00ff7f"
                                              strokeWidth="1"
                                            />
                                            {s.total > 0 && (
                                              <text
                                                x={x}
                                                y={y - 8}
                                                textAnchor="middle"
                                                fill="#00ff7f"
                                                className="text-[14px] font-black font-mono drop-shadow-[0_0_2px_rgba(0,0,0,1)]"
                                                style={{ fontSize: '15px' }}
                                              >
                                                {s.percentage.toFixed(0)}%
                                              </text>
                                            )}
                                          </g>
                                        );
                                      })}
                                    </>
                                  )}
                                </svg>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </section>
                  </>
                )}

                {/* 30 Day Activity Chart - Always Visible */}
                <section>
                  <div className="flex items-center w-full mb-3">
                    <h3 className="text-[9px] font-bold text-[#f0b419] uppercase tracking-[0.3em] pr-3 whitespace-nowrap opacity-80">Last 30 Days Activity</h3>
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-[#f0b419]/50 to-transparent"></div>
                  </div>
                  <div className="bg-transparent px-1">
                    <div className="h-[80px] flex items-end space-x-1">
                      {(() => {
                        const days = Array.from({ length: 30 }).map((_, i) => {
                          const d = new Date();
                          d.setDate(d.getDate() - (29 - i));
                          return format(d, 'yyyy-MM-dd');
                        });
                        const maxCountVal = Math.max(...dailyStats.map(d => d.count), 1);

                        return days.map((dayStr, index) => {
                          const stat = dailyStats.find(s => s.date === dayStr);
                          const count = stat ? stat.count : 0;
                          const heightPerc = (count / maxCountVal) * 100;

                          const alignLeft = index < 4;
                          const alignRight = index > 25;

                          return (
                            <div
                              key={dayStr}
                              className="flex-1 flex flex-col justify-end items-center group relative h-full cursor-pointer"
                              onClick={() => {
                                setDateRangeType('Custom');
                                setCustomStartDate(dayStr);
                                setCustomEndDate(dayStr);
                              }}
                            >
                              <div className={`absolute -top-16 ${alignLeft ? 'left-0' : alignRight ? 'right-0' : 'left-1/2 -translate-x-1/2'} bg-[#1a1a1a] border border-[#f0b419]/50 text-[#f0b419] text-[10px] px-3 py-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col ${alignLeft ? 'items-start' : alignRight ? 'items-end' : 'items-center'} min-w-[120px]`}>
                                <span className="font-bold border-b border-[#f0b419]/30 pb-1 mb-1 w-full text-center">{format(new Date(dayStr), 'EEEE, MMM dd')}</span>
                                <div className="flex flex-col w-full space-y-0.5">
                                  <div className="flex justify-between items-center space-x-4">
                                    <span className="text-gray-400 text-[9px]">Total Sites:</span>
                                    <span className="font-bold">{count}</span>
                                  </div>
                                  <div className="flex justify-between items-center space-x-4 text-[#00ff7f]">
                                    <span className="opacity-70 text-[9px]">Escalations:</span>
                                    <span className="font-bold">{stat?.escalations || 0}</span>
                                  </div>
                                  <div className="flex justify-between items-center space-x-4 text-[#00e5ff]">
                                    <span className="opacity-70 text-[9px]">Special Spawns:</span>
                                    <span className="font-bold">{stat?.spawns || 0}</span>
                                  </div>
                                </div>
                              </div>
                              {count > 0 && (
                                <div className="text-[9px] font-bold text-[#f0b419]/70 group-hover:text-[#f0b419] mb-1 transition-colors z-10">
                                  {count}
                                </div>
                              )}
                              <div
                                className={`w-full transition-all duration-300 rounded-t-[2px] ${count > 0 ? 'bg-[#f0b419]/60 group-hover:bg-[#f0b419] shadow-[0_0_8px_rgba(240,180,25,0.4)]' : 'bg-[#f0b419]/10'}`}
                                style={{ height: count > 0 ? `${Math.max(heightPerc, 8)}%` : '2px' }}
                              ></div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {currentView === 'beltStats' && beltStats && (
              <div className="flex-1 overflow-y-auto pt-[5px] px-6 pb-2 space-y-6 animate-in fade-in duration-500">
                {/* Header Row: Sub-view Toggle & Filter */}
                <div className="flex items-center justify-between mb-4 mt-1">
                  <div className="flex items-center bg-[#141414]/50 border border-[#f0b419]/10 p-0.5 rounded-lg shadow-lg h-[28px]">
                    <button
                      onClick={() => setStatsSubView('general')}
                      className={`h-full px-3 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${statsSubView === 'general'
                        ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                        }`}
                    >
                      <BarChart2 size={9} className={statsSubView === 'general' ? 'opacity-100' : 'opacity-40'} />
                      <span>General</span>
                    </button>
                    <button
                      onClick={() => setStatsSubView('advanced')}
                      className={`h-full px-3 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${statsSubView === 'advanced'
                        ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                        }`}
                    >
                      <Activity size={9} className={statsSubView === 'advanced' ? 'opacity-100' : 'opacity-40'} />
                      <span>Advanced</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Date:</span>
                      <select
                        value={dateRangeType}
                        onChange={(e) => setDateRangeType(e.target.value as any)}
                        className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/80 text-[10px] h-[26px] px-2 rounded focus:outline-none focus:border-[#f0b419]/50 min-w-[105px] font-bold py-0"
                      >
                        <option value="All">All Time</option>
                        <option value="Today">Today</option>
                        <option value="Week">Last Week</option>
                        <option value="Month">Last Month</option>
                        <option value="Custom">Custom Range</option>
                      </select>
                    </div>

                    {dateRangeType === 'Custom' && (
                      <div className="flex items-center space-x-1 animate-in fade-in slide-in-from-right-1 duration-300">
                        <div className="relative group">
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/60 text-[9px] h-[26px] px-1.5 rounded w-[82px] flex justify-between items-center group-hover:border-[#f0b419]/40 transition-colors">
                            <span className="truncate">{customStartDate ? formatLocalDate(customStartDate) : 'From...'}</span>
                            <Calendar size={9} className="opacity-40" />
                          </div>
                        </div>
                        <span className="text-gray-600 text-[8px] font-bold uppercase">to</span>
                        <div className="relative group">
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className="bg-[#141414] border border-[#f0b419]/20 text-[#f0b419]/60 text-[9px] h-[26px] px-1.5 rounded w-[82px] flex justify-between items-center group-hover:border-[#f0b419]/40 transition-colors">
                            <span className="truncate">{customEndDate ? formatLocalDate(customEndDate) : 'To...'}</span>
                            <Calendar size={9} className="opacity-40" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Header Stats - Always Visible */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-[#141414] border border-[#f0b419]/30 p-5 rounded-xl relative overflow-hidden group flex flex-col justify-between min-h-[135px]">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <BarChart2 size={48} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#f0b419] uppercase tracking-[0.2em] mb-2">Total Belts Tracked</div>
                      <div className="text-5xl font-black text-white tracking-tighter">
                        {beltStats.totalBelts}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setIsTrackedBeltsModalOpen(true);
                          fetchTrackedBelts(true);
                        }}
                        className="text-[10px] font-bold text-[#f0b419] hover:text-white transition-colors uppercase tracking-widest flex items-center space-x-1 p-2 -mr-2 -mb-2 cursor-pointer"
                      >
                        <span>View</span>
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#141414] border border-[#f0b419]/30 p-5 rounded-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Activity size={48} />
                    </div>
                    <div className="text-xs font-bold text-[#f0b419] uppercase tracking-[0.2em] mb-2">Special Outcome %</div>
                    <div className="text-5xl font-black text-white tracking-tighter">
                      {beltStats.totalBelts > 0 ? ((beltStats.specialCount / beltStats.totalBelts) * 100).toFixed(1) : '0.0'}%
                    </div>
                  </div>
                </div>

                {/* Sub-view Content */}
                {statsSubView === 'general' ? (
                  <section>
                    {(() => {
                      const outcomePerc = beltStats.totalBelts > 0 ? ((beltStats.specialCount / beltStats.totalBelts) * 100).toFixed(1) : '0.0';
                      return (
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="flex items-baseline space-x-2">
                            <h3 className="text-sm font-bold text-[#f0b419] uppercase tracking-[0.3em]">Belt Statistics</h3>
                            <span className="text-[10px] font-mono text-[#f0b419]/60 uppercase tracking-widest">
                              | {beltStats.specialCount} Total Special Outcomes ({outcomePerc}%)
                            </span>
                          </div>
                          <div className="flex-1 h-[1px] bg-gradient-to-r from-[#f0b419]/30 to-transparent"></div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-3 gap-4">
                      <StatCard label="Faction Subcapital" count={beltStats.factionCount} total={beltStats.totalBelts} color="green" className="min-h-[140px]" />
                      <StatCard label="Hauler NPC" count={beltStats.haulerCount} total={beltStats.totalBelts} color="blue" className="min-h-[140px]" />
                      <StatCard label="Officer Spawn" count={beltStats.officerCount} total={beltStats.totalBelts} color="purple" highlighted={true} className="min-h-[140px]" />
                    </div>
                  </section>
                ) : (
                  <>
                    {/* Advanced View: Hourly Analysis */}
                    <section>
                      <div className="flex items-center w-full mb-3">
                        <h3 className="text-[9px] font-bold text-[#00e5ff] uppercase tracking-[0.3em] pr-3 whitespace-nowrap opacity-80">Hourly Activity & Rate</h3>
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-[#00e5ff]/50 to-transparent"></div>
                      </div>
                      <div className="bg-[#141414] border border-gray-800/50 rounded-lg pt-4 px-4 pb-[5px]">
                        <div className="h-[123px] relative">
                          {(() => {
                            const hours = Array.from({ length: 24 }, (_, i) => i);
                            const maxCount = Math.max(...beltHourlyStats.map(s => s.total), 1);
                            const maxPerc = Math.max(...beltHourlyStats.map(s => s.total > 0 ? (s.special / s.total) * 100 : 0), 1);

                            const points = beltHourlyStats.map(s => {
                              const x = (s.hour / 23) * 700;
                              const perc = (s.special / s.total) * 100;
                              const y = 15 + (1 - (perc / Math.max(maxPerc, 1))) * 30; // Scale to top area
                              return `${x},${y}`;
                            });
                            const lineD = points.length > 1 ? `M ${points.join(' L ')}` : '';

                            return (
                              <>
                                {/* Bar Layer (Total Count) */}
                                <div className="absolute inset-0 flex items-end space-x-[2px] px-1 z-20">
                                  {hours.map(hour => {
                                    const s = beltHourlyStats.find(st => st.hour === hour) || { hour, total: 0, special: 0 };
                                    const heightPerc = (s.total / maxCount) * 100;
                                    const perc = s.total > 0 ? (s.special / s.total) * 100 : 0;

                                    return (
                                      <div
                                        key={hour}
                                        className="flex-1 flex flex-col justify-end items-center group relative h-full cursor-default"
                                      >
                                        <div className="absolute -top-[49px] left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#00e5ff]/50 text-[#00e5ff] text-[10px] px-3 py-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col items-center min-w-[100px]">
                                          <span className="font-bold border-b border-[#00e5ff]/30 pb-1 mb-1 w-full text-center">{hour.toString().padStart(2, '0')}:00</span>
                                          <div className="flex flex-col w-full space-y-0.5">
                                            <div className="flex justify-between items-center space-x-4">
                                              <span className="text-gray-400 text-[9px]">Belts Run:</span>
                                              <span className="font-bold">{s.total}</span>
                                            </div>
                                            <div className="flex justify-between items-center space-x-4">
                                              <span className="text-gray-400 text-[9px]">Special:</span>
                                              <span className="font-bold">{s.special}</span>
                                            </div>
                                            <div className="flex justify-between items-center space-x-4 text-[#00ff7f]">
                                              <span className="opacity-70 text-[9px]">Success Rate:</span>
                                              <span className="font-bold">{perc.toFixed(1)}%</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div
                                          className={`w-full transition-all duration-300 rounded-t-[1.5px] relative ${s.total > 0 ? 'bg-[#00e5ff]/10 border border-[#00e5ff]/20 group-hover:bg-[#00e5ff]/25 shadow-[0_4px_12px_rgba(0,229,255,0.05)]' : 'bg-[#00e5ff]/5'}`}
                                          style={{ height: s.total > 0 ? `${Math.max(heightPerc, 8)}%` : '2px' }}
                                        >
                                          {s.total > 0 && (
                                            <div className="absolute top-1 left-0 right-0 text-[7px] font-bold text-[#00e5ff]/40 text-center pointer-events-none">
                                              {s.total}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-[8px] text-gray-700 mt-1 font-bold group-hover:text-gray-400 transition-colors uppercase">{hour}h</div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Line Layer (Success Rate) */}
                                <svg
                                  className="absolute inset-0 w-full h-full pointer-events-none z-10 px-1 overflow-visible"
                                  viewBox="0 0 700 123"
                                  preserveAspectRatio="none"
                                >
                                  {lineD && (
                                    <>
                                      <path
                                        d={lineD}
                                        fill="none"
                                        stroke="#00ff7f"
                                        strokeWidth="1.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="drop-shadow-[0_0_4px_rgba(0,255,127,0.2)]"
                                      />
                                      {beltHourlyStats.map((s, i) => {
                                        if (s.total === 0) return null;
                                        const x = (s.hour + 0.5) * (700 / 24);
                                        const perc = (s.special / s.total) * 100;
                                        const y = 15 + (1 - (perc / Math.max(maxPerc, 1))) * 30;
                                        return (
                                          <g key={i}>
                                            <circle
                                              cx={x}
                                              cy={y}
                                              r="1.8"
                                              fill="#141414"
                                              stroke="#00ff7f"
                                              strokeWidth="1"
                                            />
                                          </g>
                                        );
                                      })}
                                    </>
                                  )}
                                </svg>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </section>

                    {/* Advanced View: Weekly Analysis */}
                    <section>
                      <div className="flex items-center w-full mb-3">
                        <h3 className="text-[9px] font-bold text-[#00e5ff] uppercase tracking-[0.3em] pr-3 whitespace-nowrap opacity-80">Weekly Distribution</h3>
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-[#00e5ff]/50 to-transparent"></div>
                      </div>
                      <div className="bg-[#141414] border border-gray-800/50 rounded-lg pt-4 px-4 pb-[5px]">
                        <div className="h-[123px] relative">
                          {(() => {
                            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                            // Query returns 0=Sunday...6=Saturday. We want Monday=0...Sunday=6
                            const statsByDay = [1, 2, 3, 4, 5, 6, 0].map((d) => {
                              const s = beltWeeklyStats.find(st => st.day === d) || { day: d, total: 0, special: 0 };
                              return {
                                ...s,
                                percentage: s.total > 0 ? (s.special / s.total) * 100 : 0
                              };
                            });

                            const maxCount = Math.max(...statsByDay.map(s => s.total), 1);
                            const maxPerc = Math.max(...statsByDay.map(s => s.percentage), 1);

                            const points = statsByDay.map((s, i) => {
                              const x = (i + 0.5) * 100; // 0-700 range for 7 days
                              const y = 15 + (1 - (s.percentage / Math.max(maxPerc, 1))) * 30;
                              return `${x},${y}`;
                            });
                            const lineD = points.length > 1 ? `M ${points.join(' L ')}` : '';

                            return (
                              <>
                                {/* Bar Layer (Total Count) */}
                                <div className="absolute inset-0 flex items-end space-x-2 px-1 z-20">
                                  {statsByDay.map((s, index) => {
                                    const heightPerc = (s.total / maxCount) * 60;
                                    return (
                                      <div
                                        key={index}
                                        className="flex-1 flex flex-col justify-end items-center group relative h-full cursor-default"
                                      >
                                        <div className="absolute -top-[49px] left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#00e5ff]/50 text-[#00e5ff] text-[10px] px-3 py-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col items-center min-w-[100px]">
                                          {(() => {
                                            const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                                            return <span className="font-bold border-b border-[#00e5ff]/30 pb-1 mb-1 w-full text-center">{fullDayNames[index]}</span>;
                                          })()}
                                          <div className="flex flex-col w-full space-y-0.5">
                                            <div className="flex justify-between items-center space-x-4">
                                              <span className="text-gray-400 text-[9px]">Belts Run:</span>
                                              <span className="font-bold">{s.total}</span>
                                            </div>
                                            <div className="flex justify-between items-center space-x-4">
                                              <span className="text-gray-400 text-[9px]">Special:</span>
                                              <span className="font-bold">{s.special}</span>
                                            </div>
                                            <div className="flex justify-between items-center space-x-4 text-[#00ff7f]">
                                              <span className="opacity-70 text-[9px]">Success Rate:</span>
                                              <span className="font-bold">{s.percentage.toFixed(1)}%</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div
                                          className={`w-full transition-all duration-300 rounded-t-[3px] relative ${s.total > 0 ? 'bg-[#00e5ff]/10 border border-[#00e5ff]/20 group-hover:bg-[#00e5ff]/25 shadow-[0_4px_12px_rgba(0,229,255,0.05)]' : 'bg-[#00e5ff]/5'}`}
                                          style={{ height: s.total > 0 ? `${Math.max(heightPerc, 8)}%` : '2px' }}
                                        >
                                          {s.total > 0 && (
                                            <div className="absolute top-1 left-0 right-0 text-[8.5px] font-bold text-[#00e5ff]/60 text-center pointer-events-none">
                                              {s.total}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-gray-600 mt-1 font-bold uppercase tracking-wider group-hover:text-gray-300 transition-colors">{dayNames[index]}</div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Line Layer (Success Rate) */}
                                <svg
                                  className="absolute inset-0 w-full h-full pointer-events-none z-10 px-1 overflow-visible"
                                  viewBox="0 0 700 123"
                                  preserveAspectRatio="none"
                                >
                                  {lineD && (
                                    <>
                                      <path
                                        d={lineD}
                                        fill="none"
                                        stroke="#00ff7f"
                                        strokeWidth="1.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="drop-shadow-[0_0_4px_rgba(0,255,127,0.2)]"
                                      />
                                      {statsByDay.map((s, i) => {
                                        if (s.total === 0) return null;
                                        const x = (i + 0.5) * 100;
                                        const y = 15 + (1 - (s.percentage / Math.max(maxPerc, 1))) * 30;
                                        return (
                                          <g key={i}>
                                            <circle
                                              cx={x}
                                              cy={y}
                                              r="1.8"
                                              fill="#141414"
                                              stroke="#00ff7f"
                                              strokeWidth="1"
                                            />
                                            {s.total > 0 && (
                                              <text
                                                x={x}
                                                y={y - 8}
                                                textAnchor="middle"
                                                fill="#00ff7f"
                                                className="text-[14px] font-black font-mono drop-shadow-[0_0_2px_rgba(0,0,0,1)]"
                                                style={{ fontSize: '15px' }}
                                              >
                                                {s.percentage.toFixed(0)}%
                                              </text>
                                            )}
                                          </g>
                                        );
                                      })}
                                    </>
                                  )}
                                </svg>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </section>
                  </>
                )}

                {/* 30 Day Activity Chart - Always Visible */}
                <section>
                  <div className="flex items-center w-full mb-3">
                    <h3 className="text-[9px] font-bold text-[#f0b419] uppercase tracking-[0.3em] pr-3 whitespace-nowrap opacity-80">Last 30 Days Activity</h3>
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-[#f0b419]/50 to-transparent"></div>
                  </div>
                  <div className="bg-transparent px-1">
                    <div className="h-[80px] flex items-end space-x-1">
                      {(() => {
                        const days = Array.from({ length: 30 }).map((_, i) => {
                          const d = new Date();
                          d.setDate(d.getDate() - (29 - i));
                          return format(d, 'yyyy-MM-dd');
                        });
                        const maxCountVal = Math.max(...beltDailyStats.map(d => d.count), 1);

                        return days.map((dayStr, index) => {
                          const stat = beltDailyStats.find(s => s.date === dayStr);
                          const count = stat ? stat.count : 0;
                          const heightPerc = (count / maxCountVal) * 100;

                          const alignLeft = index < 4;
                          const alignRight = index > 25;

                          return (
                            <div
                              key={dayStr}
                              className="flex-1 flex flex-col justify-end items-center group relative h-full cursor-pointer"
                              onClick={() => {
                                setDateRangeType('Custom');
                                setCustomStartDate(dayStr);
                                setCustomEndDate(dayStr);
                              }}
                            >
                              <div className={`absolute -top-16 ${alignLeft ? 'left-0' : alignRight ? 'right-0' : 'left-1/2 -translate-x-1/2'} bg-[#1a1a1a] border border-[#f0b419]/50 text-[#f0b419] text-[10px] px-3 py-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col ${alignLeft ? 'items-start' : alignRight ? 'items-end' : 'items-center'} min-w-[120px]`}>
                                <span className="font-bold border-b border-[#f0b419]/30 pb-1 mb-1 w-full text-center">{format(new Date(dayStr), 'EEEE, MMM dd')}</span>
                                <div className="flex flex-col w-full space-y-0.5">
                                  <div className="flex justify-between items-center space-x-4">
                                    <span className="text-gray-400 text-[9px]">Belts Tracked:</span>
                                    <span className="font-bold">{count}</span>
                                  </div>
                                  <div className="flex justify-between items-center space-x-4 text-[#00ff7f]">
                                    <span className="opacity-70 text-[9px]">Special:</span>
                                    <span className="font-bold">{stat?.escalations || 0}</span>
                                  </div>
                                </div>
                              </div>
                              {count > 0 && (
                                <div className="text-[9px] font-bold text-[#f0b419]/70 group-hover:text-[#f0b419] mb-1 transition-colors z-10">
                                  {count}
                                </div>
                              )}
                              <div
                                className={`w-full transition-all duration-300 rounded-t-[2px] ${count > 0 ? 'bg-[#f0b419]/60 group-hover:bg-[#f0b419] shadow-[0_0_8px_rgba(240,180,25,0.4)]' : 'bg-[#f0b419]/10'}`}
                                style={{ height: count > 0 ? `${Math.max(heightPerc, 8)}%` : '2px' }}
                              ></div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </section>
              </div>
            )}



            {currentView === 'settings' && (
              <Settings
                settings={settings}
                onSettingsChange={setSettings}
                showToast={showToast}
                appVersion={appVersion}
                updateInfo={updateInfo}
                updateError={updateError}
                onOpenUrl={handleOpenUrl}
                onCheckUpdates={checkForUpdates}
                esiAccounts={esiAccounts}
                onLinkAccount={handleLinkAccount}
                onRemoveAccount={handleRemoveAccount}
                onSyncWallets={syncAllWallets}
                isSyncingWallet={isSyncingWallet}
                activeTab={settingsActiveTab}
                onActiveTabChange={setSettingsActiveTab}
              />
            )}

            {dbError && (
              <div className="bg-red-900/50 text-red-200 p-2 text-xs rounded mt-4 border border-red-500/50">
                DB Error: {dbError}
              </div>
            )}
          </div>

          {/* Confirmation Modal */}
          {(logToDelete !== null || beltLogToDelete !== null || characterToRemove !== null) && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-[#141414] border border-[#f0b419]/50 rounded-lg p-5 w-full max-w-[300px] shadow-2xl">
                <h3 className="text-[#f0b419] font-bold text-lg mb-2">
                  {characterToRemove ? 'Disconnect Account?' : 'Delete Log?'}
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  {characterToRemove 
                    ? `Are you sure you want to disconnect ${characterToRemove.character_name}? Wallet journal data will remain but no new syncs will occur.`
                    : 'Are you sure you want to delete this entry? This action cannot be undone.'}
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setLogToDelete(null);
                      setBeltLogToDelete(null);
                      setCharacterToRemove(null);
                    }}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={characterToRemove ? confirmRemoveCharacter : confirmDelete}
                    className="px-4 py-2 text-sm bg-red-900/50 text-red-200 border border-red-500/50 rounded hover:bg-red-900 hover:text-white transition-colors"
                  >
                    {characterToRemove ? 'Disconnect' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Update Available Modal (Full Screen) */}
          {updateInfo && !isUpdateDismissed && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300 backdrop-blur-sm">
              <div className="bg-[#141414] border border-[#f0b419] rounded-lg p-6 w-full max-w-[320px] shadow-[0_0_30px_rgba(240,180,25,0.3)] flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-[#f0b419]/10 rounded-full flex items-center justify-center mb-4 border border-[#f0b419]/30">
                  <Activity size={32} className="text-[#f0b419]" />
                </div>
                <h3 className="text-[#f0b419] font-black text-xl mb-1 uppercase tracking-tighter">Update Available</h3>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Version {updateInfo.latest}</div>

                <p className="text-gray-400 text-xs mb-6 leading-relaxed">
                  A new version of EVE AnomTracker is available on GitHub.
                  (Current version: {updateInfo.current})
                </p>

                <div className="space-y-3 w-full">
                  <button
                    onClick={() => handleOpenUrl('https://github.com/CBY-Software/eve-anom-tracker/releases/latest')}
                    className="w-full py-2 bg-[#f0b419] text-[#0a0a0a] font-bold text-xs uppercase tracking-widest rounded hover:bg-white transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    <ExternalLink size={14} />
                    <span>Download Now</span>
                  </button>
                  <button
                    onClick={() => setIsUpdateDismissed(true)}
                    className="w-full py-2 bg-[#141414] border border-gray-700 text-gray-500 font-bold text-xs uppercase tracking-widest rounded hover:border-gray-500 hover:text-gray-300 transition-colors duration-200"
                  >
                    Remind Me Later
                  </button>
                  <button
                    onClick={() => isTauri && getCurrentWindow().close()}
                    className="w-full py-2 bg-red-900/20 border border-red-500/50 text-red-500 font-bold text-xs uppercase tracking-widest rounded hover:bg-red-900/40 hover:text-white transition-colors duration-200"
                  >
                    Close Application
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[328px] text-center whitespace-nowrap bg-[#141414] border border-[#f0b419]/50 text-[#f0b419] px-4 py-2 rounded shadow-[0_0_10px_rgba(240,180,25,0.2)] text-sm z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {toastMessage}
            </div>
          )}

          {/* Tracked Sites Modal */}
          {isTrackedSitesModalOpen && (
            <div className="fixed inset-0 bg-[#0a0a0a]/95 backdrop-blur-sm flex flex-col z-40">
              <div className="p-4 border-b border-[#f0b419]/30 flex justify-between items-center bg-[#0a0a0a]">
                <div className="flex items-baseline space-x-3">
                  <h2 className="text-lg font-bold text-[#f0b419] uppercase tracking-wider">
                    Tracked Sites
                  </h2>
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                    | Filter: {statsFilter}
                  </span>
                </div>
                <button
                  onClick={() => setIsTrackedSitesModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
              <div
                className="flex-1 overflow-y-auto p-4 space-y-2"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
                    fetchTrackedSites();
                  }
                }}
              >
                {trackedSites.length === 0 && !isLoadingTrackedSites ? (
                  <p className="text-sm text-gray-500 italic text-center py-8">
                    No sites tracked yet.
                  </p>
                ) : (
                  <>
                    {trackedSites.map((log) => {
                      const timeStr = formatTimestamp(log.timestamp, 'MMM dd HH:mm:ss');
                      const duration = getSiteDuration(log.timestamp, log.prev_timestamp);

                      const icons = getActiveIcons(log);

                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between bg-[#141414] border border-gray-800 p-2 rounded text-xs group"
                        >
                          <div className="flex-1 truncate pr-2">
                            <span className="text-gray-500 mr-2">[{timeStr}]</span>
                            {duration && (
                              <span className="text-[#00ff7f]/70 font-mono text-[10px] mr-2">({duration})</span>
                            )}
                            <span className="text-gray-200 font-medium">
                              {log.location_system ? `${log.location_system} - ` : ''}{log.site_type}
                            </span>
                            {icons.length > 0 && (
                              <span className="ml-2">
                                <span className="text-gray-500 mr-1">-</span>
                                {icons.map((icon, idx) => (
                                  <span key={idx}>
                                    <span className={`text-[10px] tracking-wider ${icon.color === 'gold' ? 'text-[#f0b419]' : icon.color === 'green' ? 'text-[#00ff7f]' : icon.color === 'blue' ? 'text-[#00e5ff]' : 'text-[#00e5ff]'}`}>
                                      {icon.label}
                                    </span>
                                    {idx < icons.length - 1 && <span className="text-gray-600 mx-0.5">,</span>}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setLogToDelete(log.id)}
                            className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                            title="Delete log"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {isLoadingTrackedSites && (
                      <div className="text-center py-4">
                        <div className="inline-block w-4 h-4 border-2 border-[#f0b419] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tracked Belts Modal */}
          {isTrackedBeltsModalOpen && (
            <div className="fixed inset-0 bg-[#0a0a0a]/95 backdrop-blur-sm flex flex-col z-50">
              <div className="p-4 border-b border-[#f0b419]/30 flex justify-between items-center bg-[#0a0a0a]">
                <div className="flex items-baseline space-x-3">
                  <h2 className="text-lg font-bold text-[#f0b419] uppercase tracking-wider">
                    Tracked Belts
                  </h2>
                </div>
                <button
                  onClick={() => setIsTrackedBeltsModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
              <div
                className="flex-1 overflow-y-auto p-4 space-y-2"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
                    fetchTrackedBelts();
                  }
                }}
              >
                {trackedBelts.length === 0 && !isLoadingTrackedBelts ? (
                  <p className="text-sm text-gray-500 italic text-center py-8">
                    No belts tracked yet.
                  </p>
                ) : (
                  <>
                    {trackedBelts.map((log) => {
                      const timeStr = formatTimestamp(log.timestamp, 'MMM dd HH:mm:ss');
                      const outcomeIcons: { label: string; color: 'gold' | 'blue' | 'green' | 'emerald' | 'cyan' | 'purple' }[] = [];
                      if (log.was_faction_spawn === 1) outcomeIcons.push({ label: 'FAC-SUB', color: 'emerald' });
                      if (log.was_hauler_spawn === 1) outcomeIcons.push({ label: 'Hauler', color: 'cyan' });
                      if (log.was_officer_spawn === 1) outcomeIcons.push({ label: `Officer: ${log.officer_name || 'Unknown'}`, color: 'purple' });

                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between bg-[#141414] border border-gray-800 p-2 rounded text-xs group"
                        >
                          <div className="flex-1 truncate pr-2">
                            <span className="text-gray-500 mr-2">[{timeStr}]</span>
                            {(() => {
                              const duration = getSiteDuration(log.timestamp, log.prev_timestamp);
                              return duration ? <span className="text-[#00ff7f]/70 font-mono text-[10px] mr-2">({duration})</span> : null;
                            })()}
                            <span className="text-gray-200 font-medium">
                              {log.location_system || 'Unknown System'}
                            </span>
                            {outcomeIcons.length > 0 && (
                              <span className="ml-2">
                                <span className="text-gray-500 mr-1">-</span>
                                {outcomeIcons.map((icon, idx) => (
                                  <span key={idx}>
                                    <span className={`text-[10px] font-bold tracking-wider ${icon.color === 'emerald' ? 'text-[#00ff7f]' :
                                        icon.color === 'cyan' ? 'text-[#00e5ff]' :
                                          icon.color === 'purple' ? 'text-[#bf94ff]' :
                                            'text-[#f0b419]'
                                      }`}>
                                      {icon.label}
                                    </span>
                                    {idx < outcomeIcons.length - 1 && <span className="text-gray-600 mx-0.5">,</span>}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setBeltLogToDelete(log.id)}
                            className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                            title="Delete log"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {isLoadingTrackedBelts && (
                      <div className="p-4 flex justify-center">
                        <div className="w-6 h-6 border-2 border-[#f0b419] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Delete Log Confirmation (Combat) */}
          {logToDelete !== null && (
            <div className="fixed inset-0 bg-[#0a0a0a]/90 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-200">
              <div className="bg-[#141414] border border-red-900 shadow-2xl rounded-lg p-6 max-w-[320px] w-full mx-4">
                <h3 className="text-lg font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center">
                  <Trash2 size={20} className="mr-2" />
                  Delete Log Entry?
                </h3>
                <p className="text-gray-400 text-xs mb-6 leading-relaxed">
                  This will permanently remove the record from the database. Are you sure?
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      if (db && logToDelete) {
                        db.execute('DELETE FROM anom_logs WHERE id = $1', [logToDelete])
                          .then(() => {
                            setHistory(prev => prev.filter(l => l.id !== logToDelete));
                            setTrackedSites(prev => prev.filter(l => l.id !== logToDelete));
                            setFullHistory(prev => prev.filter(l => l.id !== logToDelete));
                            setLogToDelete(null);
                            playTone('delete');
                          });
                      }
                    }}
                    className="flex-1 py-2 bg-red-900 text-red-100 font-bold text-xs uppercase tracking-widest rounded hover:bg-red-700 transition-colors"
                  >
                    Delete record
                  </button>
                  <button
                    onClick={() => setLogToDelete(null)}
                    className="flex-1 py-2 bg-gray-800 text-gray-300 font-bold text-xs uppercase tracking-widest rounded hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Log Confirmation (Belt) */}
          {beltLogToDelete !== null && (
            <div className="fixed inset-0 bg-[#0a0a0a]/90 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-200">
              <div className="bg-[#141414] border border-red-900 shadow-2xl rounded-lg p-6 max-w-[320px] w-full mx-4">
                <h3 className="text-lg font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center">
                  <Trash2 size={20} className="mr-2" />
                  Delete Belt Log?
                </h3>
                <p className="text-gray-400 text-xs mb-6 leading-relaxed">
                  This will permanently remove this belt record. Are you sure?
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      if (db && beltLogToDelete) {
                        db.execute('DELETE FROM belt_logs WHERE id = $1', [beltLogToDelete])
                          .then(() => {
                            setBeltHistory(prev => prev.filter(l => l.id !== beltLogToDelete));
                            setTrackedBelts(prev => prev.filter(l => l.id !== beltLogToDelete));
                            setBeltLogToDelete(null);
                            playTone('delete');
                            // Refresh stats
                            fetchBeltStats(db);
                          });
                      }
                    }}
                    className="flex-1 py-2 bg-red-900 text-red-100 font-bold text-xs uppercase tracking-widest rounded hover:bg-red-700 transition-colors"
                  >
                    Delete record
                  </button>
                  <button
                    onClick={() => setBeltLogToDelete(null)}
                    className="flex-1 py-2 bg-gray-800 text-gray-300 font-bold text-xs uppercase tracking-widest rounded hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Auto-Backup Notification Modal */}
          {isAutoBackupModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300 backdrop-blur-sm">
              <div className="bg-[#141414] border border-[#f0b419] rounded-lg p-6 w-full max-w-[320px] shadow-[0_0_30px_rgba(240,180,25,0.2)] flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-[#f0b419]/10 rounded-full flex items-center justify-center mb-4 border border-[#f0b419]/30">
                  <HardDrive size={32} className="text-[#f0b419]" />
                </div>
                <h3 className="text-[#f0b419] font-black text-xl mb-1 uppercase tracking-tighter">Auto-Backup</h3>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Successful</div>
                <p className="text-gray-400 text-xs mb-6 leading-relaxed">
                  A daily backup of your database and settings has been created in your destination folder.
                </p>
                <button
                  onClick={() => setIsAutoBackupModalOpen(false)}
                  className="w-full py-2 bg-[#f0b419] text-[#0a0a0a] font-bold text-xs uppercase tracking-widest rounded hover:bg-white transition-colors duration-200"
                >
                  Acknowledged
                </button>
              </div>
            </div>
          )}

          {/* History Modal (Last 12h) */}
          {isHistoryModalOpen && (
            <div className="fixed inset-0 bg-[#0a0a0a]/95 backdrop-blur-sm flex flex-col z-40">
              <div className="p-4 border-b border-[#f0b419]/30 flex justify-between items-center bg-[#0a0a0a]">
                <div className="flex items-baseline space-x-3">
                  <h2 className="text-lg font-bold text-[#f0b419] uppercase tracking-wider">
                    Recent History
                  </h2>
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                    | Last 12 Hours
                  </span>
                </div>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {fullHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-8">
                    No sites logged in the last 12 hours.
                  </p>
                ) : (
                  fullHistory.map((log) => {
                    const timeStr = formatTimestamp(log.timestamp, 'HH:mm:ss');

                    const duration = getSiteDuration(log.timestamp, log.prev_timestamp);

                    const icons = getActiveIcons(log);

                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between bg-[#141414] border border-gray-800 p-2 rounded text-xs group"
                      >
                        <div className="flex-1 truncate pr-2">
                          <span className="text-gray-500 mr-2">[{timeStr}]</span>
                          {duration && (
                            <span className="text-[#00ff7f]/70 font-mono text-[10px] mr-2">({duration})</span>
                          )}
                          <span className="text-gray-200 font-medium">
                            {log.location_system ? `${log.location_system} - ` : ''}{log.site_type}
                          </span>
                          {icons.length > 0 && (
                            <span className="ml-2">
                              <span className="text-gray-500 mr-1">-</span>
                              {icons.map((icon, idx) => (
                                <span key={idx}>
                                  <span className={`text-[10px] tracking-wider ${icon.color === 'gold' ? 'text-[#f0b419]' : icon.color === 'green' ? 'text-[#00ff7f]' : 'text-[#00e5ff]'}`}>
                                    {icon.label}
                                  </span>
                                  {idx < icons.length - 1 && <span className="text-gray-600 mx-0.5">,</span>}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => requestDelete(log.id)}
                          className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                          title="Delete log"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
          {/* Add Manual Income Modal */}
          {isAddIncomeModalOpen && (
            <div className="fixed inset-0 bg-[#0a0a0a]/90 backdrop-blur-sm flex items-center justify-center z-[70] animate-in fade-in duration-200">
              <div className="bg-[#141414] border border-[#f0b419]/30 shadow-2xl rounded-lg w-full max-w-[425px] mx-4 overflow-hidden">
                <div className="p-4 border-b border-[#f0b419]/20 flex justify-between items-center bg-[#0d0d0d]">
                  <h3 className="text-sm font-bold text-[#f0b419] uppercase tracking-[0.2em] flex items-center">
                    <Plus size={16} className="mr-2" />
                    Add Manual Income
                  </h3>
                  <button onClick={() => setIsAddIncomeModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Record Date</label>
                    <div className="relative group cursor-pointer">
                      <div className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-sm text-white group-focus-within:border-[#f0b419]/50 transition-colors flex items-center justify-between min-h-[38px]">
                        <span className="font-medium">
                          {(() => {
                            try {
                              const [y, m, d] = addIncomeForm.date.split('-').map(Number);
                              const dateObj = new Date(y, m - 1, d);
                              // Use the format string retrieved from Windows Registry
                              return format(dateObj, systemDateFormat);
                            } catch (e) {
                              return addIncomeForm.date;
                            }
                          })()}
                        </span>
                        <Calendar size={14} className="text-gray-600" />
                      </div>
                      <input
                        type="date"
                        value={addIncomeForm.date}
                        onChange={(e) => setAddIncomeForm({ ...addIncomeForm, date: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Assign to Character (Optional)</label>
                    <select
                      value={addIncomeForm.characterId}
                      onChange={(e) => setAddIncomeForm({ ...addIncomeForm, characterId: parseInt(e.target.value) })}
                      className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-sm text-white focus:border-[#f0b419]/50 outline-none transition-colors"
                    >
                      <option value={0}>None / Unassigned</option>
                      {esiAccounts.map(acc => (
                        <option key={acc.character_id} value={acc.character_id}>{acc.character_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Income Category</label>
                    <select
                      value={addIncomeForm.type}
                      onChange={(e) => {
                        setAddIncomeForm({ ...addIncomeForm, type: e.target.value });
                        if (e.target.value) setAddIncomeErrors(prev => ({ ...prev, type: undefined }));
                      }}
                      className={`w-full bg-[#0d0d0d] border ${addIncomeErrors.type ? 'border-red-500/50' : 'border-gray-800'} rounded px-3 py-2 text-sm text-white focus:border-[#f0b419]/50 outline-none transition-colors`}
                    >
                      <option value="">Select Income Category...</option>
                      <option value="Sold Escalations">Sold Escalations</option>
                      <option value="Loot Value">Loot Value</option>
                    </select>
                    {addIncomeErrors.type && <span className="text-[10px] text-red-500 mt-1 block font-medium">{addIncomeErrors.type}</span>}
                  </div>

                  {addIncomeForm.type === 'Sold Escalations' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Total ISK Amount</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="0"
                          value={formatISKInput(addIncomeForm.amount)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setAddIncomeForm({ ...addIncomeForm, amount: val });
                            if (val) setAddIncomeErrors(prev => ({ ...prev, amount: undefined }));
                          }}
                          className={`w-full bg-[#0d0d0d] border ${addIncomeErrors.amount ? 'border-red-500/50' : 'border-gray-800'} rounded px-3 py-2 text-sm text-white focus:border-[#f0b419]/50 outline-none transition-colors pr-12 font-mono`}
                        />
                        <span className="absolute right-3 top-2.5 text-[9px] text-[#f0b419] font-bold tracking-tight opacity-70">ISK</span>
                      </div>
                      {addIncomeErrors.amount && <span className="text-[10px] text-red-500 mt-1 block font-medium">{addIncomeErrors.amount}</span>}
                    </div>
                  )}

                  {addIncomeForm.type === 'Loot Value' && modalStep === 'input' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Market</label>
                          <select
                            value={settings.janiceMarket}
                            onChange={(e) => saveSettings({ ...settings, janiceMarket: Number(e.target.value) })}
                            className="w-full bg-[#0a0a0a] border border-gray-800 text-white p-2 rounded text-xs focus:border-[#f0b419]/50 outline-none appearance-none"
                          >
                            {JANICE_MARKETS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Price Source</label>
                          <select
                            value={settings.janicePricingVariant}
                            onChange={(e) => saveSettings({ ...settings, janicePricingVariant: e.target.value as any })}
                            className="w-full bg-[#0a0a0a] border border-gray-800 text-white p-2 rounded text-xs focus:border-[#f0b419]/50 outline-none appearance-none"
                          >
                            <option value="immediate">Immediate</option>
                            <option value="top5percent">Top 5% Avg</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Price Type</label>
                          <select
                            value={settings.janicePriceType}
                            onChange={(e) => saveSettings({ ...settings, janicePriceType: e.target.value as any })}
                            className="w-full bg-[#0a0a0a] border border-gray-800 text-white p-2 rounded text-xs focus:border-[#f0b419]/50 outline-none appearance-none capitalize"
                          >
                            <option value="sell">Sell Price</option>
                            <option value="buy">Buy Price</option>
                            <option value="split">Split Price</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Price %</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={settings.janicePercentage || 100}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 100 : Math.max(1, Math.min(100, Number(e.target.value)));
                                saveSettings({ ...settings, janicePercentage: val });
                              }}
                              onBlur={(e) => {
                                if (e.target.value === '') {
                                  saveSettings({ ...settings, janicePercentage: 100 });
                                }
                              }}
                              className="w-full bg-[#0a0a0a] border border-gray-800 text-white p-2 rounded text-xs focus:border-[#f0b419]/50 outline-none pr-8"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-gray-500 font-bold">%</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Paste Loot from EVE</label>
                        <textarea
                          placeholder="Paste item list here (e.g. Tritanium 100)..."
                          value={addIncomeForm.lootText}
                          onChange={(e) => setAddIncomeForm({ ...addIncomeForm, lootText: e.target.value })}
                          className="w-full h-32 bg-[#0a0a0a] border border-gray-800 text-gray-200 p-3 rounded text-xs focus:outline-none focus:border-[#f0b419]/50 transition-all resize-none font-mono"
                        />
                        <div className="text-[9px] text-gray-600 font-bold italic text-right opacity-60">Powered by janice.e-351.com</div>
                        {addIncomeErrors.amount && <span className="text-[10px] text-red-500 mt-1 block font-medium">{addIncomeErrors.amount}</span>}
                      </div>
                    </div>
                  )}

                  {addIncomeForm.type === 'Loot Value' && modalStep === 'confirm' && appraisalResult && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="bg-[#f0b419]/5 border border-[#f0b419]/20 rounded-lg p-4 text-center">
                        <label className="text-[9px] font-bold text-[#f0b419] uppercase tracking-[0.2em] mb-1 block">FINAL PRICE VALUE ({settings.janicePercentage}%)</label>
                        <div className="text-2xl font-bold text-white font-mono">
                          {(() => {
                            const root = settings.janicePricingVariant === 'immediate' ? appraisalResult.immediatePrices : appraisalResult.top5AveragePrices;
                            const field = settings.janicePriceType === 'sell' ? 'totalSellPrice' : settings.janicePriceType === 'buy' ? 'totalBuyPrice' : 'totalSplitPrice';
                            const base = root ? root[field] : 0;
                            const finalValue = Math.ceil(base * (settings.janicePercentage / 100));
                            return finalValue.toLocaleString();
                          })()}
                          <span className="text-xs ml-1.5 text-[#f0b419]/60">ISK</span>
                        </div>
                        {settings.janicePercentage < 100 && (
                          <div className="text-[9px] text-gray-500 mt-1 uppercase tracking-wider font-bold">
                            Raw Total: {(() => {
                              const root = settings.janicePricingVariant === 'immediate' ? appraisalResult.immediatePrices : appraisalResult.top5AveragePrices;
                              const field = settings.janicePriceType === 'sell' ? 'totalSellPrice' : settings.janicePriceType === 'buy' ? 'totalBuyPrice' : 'totalSplitPrice';
                              return root ? root[field].toLocaleString() : '0';
                            })()} ISK
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#141414] border border-gray-800 p-2 rounded text-center">
                          <div className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Market</div>
                          <div className="text-xs text-white font-bold">{JANICE_MARKETS.find(m => m.id === settings.janiceMarket)?.name}</div>
                        </div>
                        <div className="bg-[#141414] border border-gray-800 p-2 rounded text-center">
                          <div className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Pricing Source</div>
                          <div className="text-xs text-white font-bold">{settings.janicePricingVariant === 'immediate' ? 'Immediate' : 'Top 5% Avg'}</div>
                        </div>
                      </div>
                      
                      <div className="text-[9px] text-center text-gray-500 italic">
                        Appraised {appraisalResult.items.length} items via Janice API
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-[#0d0d0d] border-t border-gray-800/50 flex flex-col space-y-2">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        if (modalStep === 'confirm') {
                          setModalStep('input');
                        } else {
                          setIsAddIncomeModalOpen(false);
                        }
                      }}
                      className="flex-1 py-2.5 bg-gray-800 text-gray-300 font-bold text-xs uppercase tracking-widest rounded hover:bg-gray-700 transition-colors"
                    >
                      {modalStep === 'confirm' ? 'Back' : 'Cancel'}
                    </button>
                    
                    {addIncomeForm.type === 'Loot Value' && modalStep === 'input' ? (
                      <button
                        onClick={handleAppraiseLoot}
                        disabled={isAppraising || !addIncomeForm.lootText.trim()}
                        className="flex-1 bg-[#141414] border border-[#f0b419]/50 text-[#f0b419] py-2.5 rounded text-xs font-bold uppercase tracking-widest hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(240,180,25,0.05)]"
                      >
                        {isAppraising ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Appraising...</span>
                          </>
                        ) : (
                          <>
                            <Activity size={14} />
                            <span>Appraise Loot</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (addIncomeForm.type === 'Loot Value' && modalStep === 'confirm') {
                            const root = settings.janicePricingVariant === 'immediate' ? appraisalResult.immediatePrices : appraisalResult.top5AveragePrices;
                            const field = settings.janicePriceType === 'sell' ? 'totalSellPrice' : settings.janicePriceType === 'buy' ? 'totalBuyPrice' : 'totalSplitPrice';
                            const baseAmount = root ? root[field] : 0;
                            const finalAmount = Math.floor(baseAmount * (settings.janicePercentage / 100));
                            handleAddIncome(finalAmount);
                          } else {
                            handleAddIncome();
                          }
                        }}
                        className={`flex-1 py-2.5 ${modalStep === 'confirm' ? 'bg-[#00ff7f] text-black border-[#00ff7f]' : 'bg-[#f0b419] text-[#0a0a0a] border-[#f0b419]'} font-black text-xs uppercase tracking-[0.2em] rounded hover:brightness-110 transition-all shadow-[0_0_15px_rgba(240,180,25,0.15)] flex items-center justify-center space-x-2`}
                      >
                        {modalStep === 'confirm' ? <Plus size={16} /> : null}
                        <span>{modalStep === 'confirm' ? 'Confirm Import' : 'Add Entry'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete Journal Entry Confirmation Modal */}
          {journalEntryToDelete !== null && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200 backdrop-blur-sm">
              <div className="bg-[#141414] border border-red-500/30 rounded-lg p-6 w-full max-w-[320px] shadow-2xl">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                    <Trash2 size={32} className="text-red-500" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2 uppercase tracking-tight">Delete Transaction?</h3>
                  <p className="text-gray-400 text-xs mb-6 leading-relaxed">
                    This will permanently remove this manual income record from your history and statistics. This action cannot be undone.
                  </p>
                  <div className="flex w-full space-x-3">
                    <button
                      onClick={handleDeleteJournalEntry}
                      className="flex-1 py-2.5 bg-red-600 text-white font-bold text-xs uppercase tracking-widest rounded hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setJournalEntryToDelete(null)}
                      className="flex-1 py-2.5 bg-[#222] text-gray-400 font-bold text-xs uppercase tracking-widest rounded hover:bg-[#333] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <Splash />
      )}
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
  color = 'gold',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: 'gold' | 'blue' | 'green' | 'emerald' | 'cyan' | 'purple';
}) {
  const baseClasses =
    'w-full py-2 px-1 text-xs font-semibold uppercase tracking-wider rounded border transition-all duration-200 text-center cursor-pointer';

  const colorClasses =
    color === 'gold'
      ? active
        ? 'bg-[#f0b419]/20 border-[#f0b419] text-[#f0b419] shadow-[0_0_10px_rgba(240,180,25,0.4)]'
        : 'bg-[#141414] border-gray-800 text-gray-500 hover:border-[#f0b419]/50 hover:text-gray-300'
      : color === 'green'
        ? active
          ? 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f] shadow-[0_0_10px_rgba(0,255,127,0.4)]'
          : 'bg-[#141414] border-gray-800 text-gray-500 hover:border-[#00ff7f]/50 hover:text-gray-300'
        : color === 'emerald'
          ? active
            ? 'bg-[#50c878]/20 border-[#50c878] text-[#50c878] shadow-[0_0_10px_rgba(80,200,120,0.4)]'
            : 'bg-[#141414] border-gray-800 text-gray-500 hover:border-[#50c878]/50 hover:text-gray-300'
          : color === 'cyan'
            ? active
              ? 'bg-[#00ffff]/20 border-[#00ffff] text-[#00ffff] shadow-[0_0_10px_rgba(0,255,255,0.4)]'
              : 'bg-[#141414] border-gray-800 text-gray-500 hover:border-[#00ffff]/50 hover:text-gray-300'
            : color === 'purple'
              ? active
                ? 'bg-[#bf94ff]/20 border-[#bf94ff] text-[#bf94ff] shadow-[0_0_10px_rgba(191,148,255,0.4)]'
                : 'bg-[#141414] border-gray-800 text-gray-500 hover:border-[#bf94ff]/50 hover:text-gray-300'
              : active
                ? 'bg-[#00e5ff]/20 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                : 'bg-[#141414] border-gray-800 text-gray-500 hover:border-[#00e5ff]/50 hover:text-gray-300';

  return (
    <div className={`${baseClasses} ${colorClasses}`} onClick={onClick}>
      {label}
    </div>
  );
}
