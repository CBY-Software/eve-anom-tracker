import { ChangeEvent, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Folder, Save, Loader2, ExternalLink, Search, X, Plus, Activity, RefreshCw, Power, Monitor, MapPin, Database, Info, Users, Trash2, Clock, Globe } from 'lucide-react';
import systemsData from './data/solar_systems.json';
import { ESI_CLIENT_ID } from './constants';

interface SolarSystem {
  regionID: number;
  regionName: string;
  security: number;
  solarSystemID: number;
  solarSystemName: string;
}

export interface AppSettings {
  alwaysOnTop: boolean;
  globalScale: number;
  windowOpacity: number;
  customSites: string;
  enableSounds: boolean;
  orientation: 'portrait' | 'landscape';
  backupPath?: string;
  autoBackupFrequency: 'off' | 'daily' | 'weekly' | 'monthly';
  lastAutoBackup?: string;
  preferredSystems: string[];
  logShortcut: string;
  timeDisplay: 'eve' | 'local';
  janiceMarket: number;
  janicePriceType: 'sell' | 'buy' | 'split';
  janicePricingVariant: 'immediate' | 'top5percent';
  janicePercentage: number;
  combatAnomalyTracking: boolean;
  beltTracking: boolean;
}

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  showToast: (message: string) => void;
  appVersion: string;
  updateInfo: { latest: string, current: string } | null;
  updateError?: string | null;
  onOpenUrl: (url: string) => void;
  onCheckUpdates: () => void;
  esiAccounts: any[];
  onLinkAccount: () => void;
  onRemoveAccount: (characterId: number) => void;
  onSyncWallets: () => void;
  isSyncingWallet: boolean;
  activeTab: 'application' | 'window' | 'locations' | 'characters' | 'backup' | 'about';
  onActiveTabChange: (tab: 'application' | 'window' | 'locations' | 'characters' | 'backup' | 'about') => void;
}

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_IPC__' in window);

export default function Settings({
  settings, onSettingsChange, showToast, appVersion, updateInfo, updateError, onOpenUrl, onCheckUpdates,
  esiAccounts, onLinkAccount, onRemoveAccount, onSyncWallets, isSyncingWallet,
  activeTab, onActiveTabChange
}: SettingsProps) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSystems, setFilteredSystems] = useState<SolarSystem[]>([]);
  const [characterDetails, setCharacterDetails] = useState<Record<number, any>>({});

  useEffect(() => {
    if (searchTerm.length >= 2) {
      const filtered = (systemsData as SolarSystem[]).filter((s) =>
        s.solarSystemName.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10);
      setFilteredSystems(filtered);
    } else {
      setFilteredSystems([]);
    }
  }, [searchTerm]);

  useEffect(() => {
    // Fetch detailed info for linked characters
    const fetchAllDetails = async () => {
      for (const acc of esiAccounts) {
        if (!characterDetails[acc.character_id]) {
          try {
            const detail = await invoke('get_character_public_info', { characterId: acc.character_id });
            setCharacterDetails(prev => ({ ...prev, [acc.character_id]: detail }));
          } catch (e) {
            console.error(`Failed to fetch detail for ${acc.character_id}:`, e);
          }
        }
      }
    };

    if (isTauri && activeTab === 'characters') {
      fetchAllDetails();
    }
  }, [esiAccounts, activeTab]);

  const handleChange = (key: keyof AppSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleBrowse = async () => {
    if (!isTauri) {
      showToast('Backup is only available in the desktop application');
      return;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Backup Destination'
      });

      if (selected) {
        handleChange('backupPath', selected);
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
      showToast('Failed to select directory');
    }
  };

  const handleBackup = async () => {
    if (!isTauri) {
      showToast('Backup is only available in the desktop application');
      return;
    }

    if (!settings.backupPath) {
      showToast('Please select a backup path first');
      return;
    }

    setIsBackingUp(true);
    try {
      const dataDir = await invoke<string>('get_data_dir');
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
      const zipName = `${timestamp}_EVE_AnomTracker_Backup.zip`;
      const backupDest = await invoke<string>('join_paths', { base: settings.backupPath, sub: zipName });

      const dbFile = await invoke<string>('join_paths', { base: dataDir, sub: 'anomtracker.db' });
      const dbWal = await invoke<string>('join_paths', { base: dataDir, sub: 'anomtracker.db-wal' });
      const dbShm = await invoke<string>('join_paths', { base: dataDir, sub: 'anomtracker.db-shm' });
      const settingsFile = await invoke<string>('join_paths', { base: dataDir, sub: 'settings.json' });

      await invoke('create_backup_zip', {
        srcFiles: [dbFile, dbWal, dbShm, settingsFile],
        destZip: backupDest
      });

      showToast('Backup Successful (ZIP created)');
    } catch (error) {
      console.error('Backup failed:', error);
      showToast(`Backup Error: ${error}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!isTauri) {
      showToast('Restore is only available in the desktop application');
      return;
    }

    try {
      const { open, message, confirm } = await import('@tauri-apps/plugin-dialog');

      const confirmed = await confirm(
        'This will overwrite your current settings and database with the backup content. The application will restart to apply changes. Continue?',
        { title: 'Restore Backup', kind: 'warning' }
      );

      if (!confirmed) return;

      const selected = await open({
        multiple: false,
        title: 'Select Backup File',
        filters: [{ name: 'Backup Archive', extensions: ['zip'] }]
      });

      if (selected && typeof selected === 'string') {
        setIsRestoring(true);
        try {
          await invoke('restore_backup_zip', { zipPath: selected });
          await message('Restore successful! The application will now restart.', { title: 'Success', kind: 'info' });
          await invoke('restart_app');
        } catch (error) {
          console.error('Restore failed:', error);
          showToast(`Restore Error: ${error}`);
        } finally {
          setIsRestoring(false);
        }
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      showToast('Failed to select file');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab Header */}
      <div className="flex justify-center mb-6">
        <div className="flex items-center bg-[#141414]/50 border border-[#f0b419]/10 p-0.5 rounded-lg shadow-lg h-[28px]">
          <button
            onClick={() => onActiveTabChange('window')}
            className={`h-full px-4 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${activeTab === 'window'
              ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
          >
            <Monitor size={9} className={activeTab === 'window' ? 'opacity-100' : 'opacity-40'} />
            <span>Window</span>
          </button>
          <button
            onClick={() => onActiveTabChange('application')}
            className={`h-full px-4 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${activeTab === 'application'
              ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
          >
            <Clock size={9} className={activeTab === 'application' ? 'opacity-100' : 'opacity-40'} />
            <span>Application</span>
          </button>
          <button
            onClick={() => onActiveTabChange('locations')}
            className={`h-full px-4 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${activeTab === 'locations'
              ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
          >
            <MapPin size={9} className={activeTab === 'locations' ? 'opacity-100' : 'opacity-40'} />
            <span>Locations</span>
          </button>
          <button
            onClick={() => onActiveTabChange('characters')}
            className={`h-full px-4 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${activeTab === 'characters'
              ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
          >
            <Users size={9} className={activeTab === 'characters' ? 'opacity-100' : 'opacity-40'} />
            <span>Characters</span>
          </button>
          <button
            onClick={() => onActiveTabChange('backup')}
            className={`h-full px-4 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${activeTab === 'backup'
              ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
          >
            <Database size={9} className={activeTab === 'backup' ? 'opacity-100' : 'opacity-40'} />
            <span>Backup</span>
          </button>
          <button
            onClick={() => onActiveTabChange('about')}
            className={`h-full px-4 text-[8.5px] font-black uppercase tracking-wider rounded flex items-center space-x-1.5 transition-all duration-300 ${activeTab === 'about'
              ? 'bg-[#f0b419]/20 text-[#f0b419] border border-[#f0b419]/30 shadow-[0_0_10px_rgba(240,180,25,0.1)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
          >
            <Info size={9} className={activeTab === 'about' ? 'opacity-100' : 'opacity-40'} />
            <span>About</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-8 space-y-6 text-gray-300">
        {activeTab === 'application' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-sm font-semibold text-[#f0b419] uppercase tracking-wider mb-4 border-b border-[#f0b419]/30 pb-2">
              Application Settings
            </h2>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Clock size={14} className="text-[#f0b419]" />
                  <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Time Display
                  </label>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => handleChange('timeDisplay', 'eve')}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                      settings.timeDisplay === 'eve'
                        ? 'bg-[#f0b419]/10 border-[#f0b419]/50 shadow-[0_0_15px_rgba(240,180,25,0.05)]'
                        : 'bg-[#141414] border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        settings.timeDisplay === 'eve' ? 'border-[#f0b419]' : 'border-gray-600'
                      }`}>
                        {settings.timeDisplay === 'eve' && <div className="w-2 h-2 rounded-full bg-[#f0b419]" />}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className={`text-xs font-bold uppercase tracking-wide ${
                          settings.timeDisplay === 'eve' ? 'text-white' : 'text-gray-400'
                        }`}>Use EVE Time</span>
                        <span className="text-[10px] text-gray-500 mt-0.5">Displays all timestamps in UTC (EVE Standard Time)</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-mono text-gray-500 uppercase">Current GMT</span>
                      <span className="text-sm font-mono font-bold text-[#f0b419]">
                        {new Date().getUTCHours().toString().padStart(2, '0')}:{new Date().getUTCMinutes().toString().padStart(2, '0')}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleChange('timeDisplay', 'local')}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                      settings.timeDisplay === 'local'
                        ? 'bg-[#f0b419]/10 border-[#f0b419]/50 shadow-[0_0_15px_rgba(240,180,25,0.05)]'
                        : 'bg-[#141414] border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        settings.timeDisplay === 'local' ? 'border-[#f0b419]' : 'border-gray-600'
                      }`}>
                        {settings.timeDisplay === 'local' && <div className="w-2 h-2 rounded-full bg-[#f0b419]" />}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className={`text-xs font-bold uppercase tracking-wide ${
                          settings.timeDisplay === 'local' ? 'text-white' : 'text-gray-400'
                        }`}>Use Local Time</span>
                        <span className="text-[10px] text-gray-500 mt-0.5">Displays all timestamps in your system's local time</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-mono text-gray-500 uppercase">
                        Current Local (GMT{new Date().getTimezoneOffset() <= 0 ? '+' : '-'}{Math.abs(Math.floor(new Date().getTimezoneOffset() / 60))})
                      </span>
                      <span className="text-sm font-mono font-bold text-[#f0b419]">
                        {new Date().getHours().toString().padStart(2, '0')}:{new Date().getMinutes().toString().padStart(2, '0')}
                      </span>
                    </div>
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 italic px-1">
                  * This setting affects how logs are filtered, grouped in statistics, and displayed throughout the application.
                </p>

                <div className="space-y-2 pt-6 border-t border-gray-800">
                  <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Global Log Hotkey
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={settings.logShortcut}
                      onKeyDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const isModifierOnly = ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key);
                        if (isModifierOnly) return;

                        const parts: string[] = [];
                        if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
                        if (e.altKey) parts.push('Alt');
                        if (e.shiftKey) parts.push('Shift');

                        let key = e.key.toUpperCase();
                        if (key === ' ') key = 'Space';
                        if (key === 'ARROWUP') key = 'Up';
                        if (key === 'ARROWDOWN') key = 'Down';
                        if (key === 'ARROWLEFT') key = 'Left';
                        if (key === 'ARROWRIGHT') key = 'Right';

                        if (key && !isModifierOnly) {
                          parts.push(key);
                          const combined = parts.join('+');
                          handleChange('logShortcut', combined);
                          showToast(`Hotkey set: ${combined}`);
                        }
                      }}
                      className="w-full bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded text-xs px-8 focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] cursor-pointer"
                      placeholder="Press key combination..."
                    />
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Activity size={12} className="text-[#f0b419]/50" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-gray-800">
                  <div className="flex items-center space-x-2">
                    <Power size={14} className="text-[#f0b419]" />
                    <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Feature Modules
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-300 uppercase tracking-wider group-hover:text-[#f0b419] transition-colors">
                          Combat Anomaly Tracking
                        </span>
                        <span className="text-[10px] text-gray-500">Show/hide Combat Log and Stats menu elements</span>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={settings.combatAnomalyTracking}
                          onChange={(e) => handleChange('combatAnomalyTracking', e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${settings.combatAnomalyTracking ? 'bg-[#f0b419]' : 'bg-gray-800'}`}></div>
                        <div className={`absolute left-1 top-1 bg-[#0a0a0a] w-4 h-4 rounded-full transition-transform ${settings.combatAnomalyTracking ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                    </label>

                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-300 uppercase tracking-wider group-hover:text-[#f0b419] transition-colors">
                          Belt Tracking
                        </span>
                        <span className="text-[10px] text-gray-500">Show/hide Belt Log and Stats menu elements</span>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={settings.beltTracking}
                          onChange={(e) => handleChange('beltTracking', e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${settings.beltTracking ? 'bg-[#f0b419]' : 'bg-gray-800'}`}></div>
                        <div className={`absolute left-1 top-1 bg-[#0a0a0a] w-4 h-4 rounded-full transition-transform ${settings.beltTracking ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'window' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-sm font-semibold text-[#f0b419] uppercase tracking-wider mb-4 border-b border-[#f0b419]/30 pb-2">
              Window Controls
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Orientation
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleChange('orientation', 'portrait')}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${settings.orientation === 'portrait' ? 'bg-[#f0b419] text-[#0a0a0a]' : 'bg-[#141414] text-gray-400 border border-gray-800 hover:text-[#f0b419]'}`}
                  >
                    Portrait
                  </button>
                  <button
                    onClick={() => handleChange('orientation', 'landscape')}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${settings.orientation === 'landscape' ? 'bg-[#f0b419] text-[#0a0a0a]' : 'bg-[#141414] text-gray-400 border border-gray-800 hover:text-[#f0b419]'}`}
                  >
                    Landscape
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs font-medium text-gray-300 uppercase tracking-wider group-hover:text-[#f0b419] transition-colors">
                  Always on Top
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={settings.alwaysOnTop}
                    onChange={(e) => handleChange('alwaysOnTop', e.target.checked)}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${settings.alwaysOnTop ? 'bg-[#f0b419]' : 'bg-gray-800'}`}></div>
                  <div className={`absolute left-1 top-1 bg-[#0a0a0a] w-4 h-4 rounded-full transition-transform ${settings.alwaysOnTop ? 'transform translate-x-4' : ''}`}></div>
                </div>
              </label>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Combat Log Scale
                  </label>
                  <span className="text-xs text-[#f0b419]">{settings.globalScale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={settings.globalScale}
                  onChange={(e) => handleChange('globalScale', parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#f0b419]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Combat Log Opacity
                  </label>
                  <span className="text-xs text-[#f0b419]">{Math.round(settings.windowOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="1.0"
                  step="0.05"
                  value={settings.windowOpacity}
                  onChange={(e) => handleChange('windowOpacity', parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#f0b419]"
                />
              </div>

              <label className="flex items-center justify-between cursor-pointer group pt-2">
                <span className="text-xs font-medium text-gray-300 uppercase tracking-wider group-hover:text-[#f0b419] transition-colors">
                  Enable UI Sounds
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={settings.enableSounds}
                    onChange={(e) => handleChange('enableSounds', e.target.checked)}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${settings.enableSounds ? 'bg-[#f0b419]' : 'bg-gray-800'}`}></div>
                  <div className={`absolute left-1 top-1 bg-[#0a0a0a] w-4 h-4 rounded-full transition-transform ${settings.enableSounds ? 'transform translate-x-4' : ''}`}></div>
                </div>
              </label>

            </div>
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <section className="bg-[#141414] border border-gray-800/40 p-4 rounded-xl">
              <div className="flex items-center space-x-2 mb-4">
                <div className="p-1.5 bg-[#f0b419]/10 rounded border border-[#f0b419]/20">
                  <Search size={14} className="text-[#f0b419]" />
                </div>
                <h3 className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Preferred Systems</h3>
              </div>

              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search solar system..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-gray-800 text-gray-200 p-2.5 pl-9 rounded text-xs focus:outline-none focus:border-[#f0b419] transition-all"
                />
                <Search size={14} className="absolute left-3 top-3 text-gray-600" />
                {filteredSystems.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-[#141414] border border-gray-800 rounded-b mt-1 z-50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {filteredSystems.map((sys) => (
                      <button
                        key={sys.solarSystemID}
                        onClick={() => {
                          if (!settings.preferredSystems.includes(sys.solarSystemName)) {
                            onSettingsChange({
                              ...settings,
                              preferredSystems: [...settings.preferredSystems, sys.solarSystemName],
                            });
                          }
                          setSearchTerm('');
                          setFilteredSystems([]);
                        }}
                        className="w-full text-left px-3 py-2 text-[10px] text-gray-300 hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-colors flex justify-between items-center"
                      >
                        <span className="font-bold">{sys.solarSystemName}</span>
                        <span className="text-gray-500 text-[9px] uppercase tracking-tighter">{sys.regionName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {settings.preferredSystems.map((sys) => (
                  <div key={sys} className="flex items-center bg-[#0a0a0a] border border-[#f0b419]/30 px-2 py-1.5 rounded-md group hover:border-[#f0b419] transition-all">
                    <span className="text-[10px] text-[#f0b419] font-bold uppercase tracking-wider mr-2">{sys}</span>
                    <button
                      onClick={() => onSettingsChange({
                        ...settings,
                        preferredSystems: settings.preferredSystems.filter(s => s !== sys)
                      })}
                      className="text-gray-600 hover:text-red-500 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[#141414] border border-gray-800/40 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-[#f0b419]/10 rounded border border-[#f0b419]/20">
                    <Plus size={14} className="text-[#f0b419]" />
                  </div>
                  <h3 className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Custom Site List</h3>
                </div>
              </div>
              <textarea
                value={settings.customSites}
                onChange={(e) => onSettingsChange({ ...settings, customSites: e.target.value })}
                placeholder="Comma separated site names..."
                className="w-full h-24 bg-[#0a0a0a] border border-gray-800 text-gray-200 p-3 rounded text-xs focus:outline-none focus:border-[#f0b419] transition-all resize-none font-mono"
              />
              <p className="text-[10px] text-gray-600 mt-2 italic">Standardizes the site dropdown labels (e.g., Haven, Sanctum, Forsaken Hub).</p>
            </section>
          </div>
        )}

        {activeTab === 'characters' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-4 border-b border-[#f0b419]/30 pb-2">
              <h2 className="text-sm font-semibold text-[#f0b419] uppercase tracking-wider">
                Authorized Characters
              </h2>
              <button
                onClick={onLinkAccount}
                className="px-3 py-1 bg-[#f0b419]/10 border border-[#f0b419]/30 text-[#f0b419] hover:bg-[#f0b419] hover:text-[#0a0a0a] rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center space-x-2"
              >
                <Plus size={12} />
                <span>Link Account</span>
              </button>
            </div>

            <div className="space-y-4">
              {esiAccounts.map((account) => (
                <div
                  key={account.character_id}
                  className="bg-[#141414] border border-[#f0b419]/10 rounded-lg p-4 flex items-center justify-between group hover:border-[#f0b419]/30 transition-all shadow-md"
                >
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <img
                        src={`https://images.evetech.net/characters/${account.character_id}/portrait?size=128`}
                        alt={account.character_name}
                        className="w-20 h-20 rounded-lg border border-[#f0b419]/20 bg-[#0a0a0a]"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#141414] shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white tracking-tight">{account.character_name}</span>
                      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest flex items-center">
                        {characterDetails[account.character_id] ? (
                          <>
                            {characterDetails[account.character_id].alliance_name
                              ? `${characterDetails[account.character_id].alliance_name} | ${characterDetails[account.character_id].corporation_name}`
                              : characterDetails[account.character_id].corporation_name
                            }
                          </>
                        ) : (
                          <span className="animate-pulse flex items-center">
                            <RefreshCw size={8} className="mr-1 animate-spin" />
                            Loading details...
                          </span>
                        )}
                      </span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">ACTIVE</span>
                        <span className="text-[9px] text-gray-600 font-mono">ID: {account.character_id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onRemoveAccount(account.character_id)}
                      className="p-2 bg-red-900/10 border border-red-500/30 text-red-500 hover:bg-red-900 hover:text-white rounded transition-all"
                      title="Remove Account"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {esiAccounts.length === 0 && (
                <div className="bg-[#141414]/30 border border-dashed border-gray-800 rounded-lg p-8 flex flex-col items-center justify-center text-center">
                  <Users size={32} className="text-gray-700 mb-3" />
                  <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
                    No characters linked. Connect an EVE account to enable financial tracking.
                  </p>
                </div>
              )}
            </div>

            {esiAccounts.length > 0 && (
              <div className="mt-8 pt-4 border-t border-gray-800/50 flex justify-between items-center">
                <div className="text-[10px] text-gray-400 max-w-[240px]">
                  All character data is stored locally and encrypted on your device. Only public profile info and wallet journals are accessed via ESI.
                </div>
                <button
                  onClick={onSyncWallets}
                  disabled={isSyncingWallet}
                  className="px-4 py-2 bg-[#f0b419]/5 border border-[#f0b419]/40 text-[#f0b419] rounded text-[10px] font-bold uppercase hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-all flex items-center space-x-2"
                >
                  <RefreshCw size={12} className={isSyncingWallet ? "animate-spin" : ""} />
                  <span>{isSyncingWallet ? 'Syncing...' : 'Sync All'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-sm font-semibold text-[#f0b419] uppercase tracking-wider mb-4 border-b border-[#f0b419]/30 pb-2">
              Data Backup
            </h2>
            <div className="space-y-4">
              {settings.lastAutoBackup && (
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Last Auto-Backup
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold ${settings.lastAutoBackup === new Date().toISOString().split('T')[0]
                        ? 'text-emerald-500'
                        : 'text-[#f0b419]'
                      }`}>
                      {settings.lastAutoBackup}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      ({settings.lastAutoBackup === new Date().toISOString().split('T')[0]
                        ? 'Today'
                        : `${Math.floor((new Date(new Date().toISOString().split('T')[0]).getTime() - new Date(settings.lastAutoBackup).getTime()) / (1000 * 60 * 60 * 24))} days ago`}
                      )
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Auto-Backup Frequency
                </label>
                <select
                  value={settings.autoBackupFrequency}
                  onChange={(e) => handleChange('autoBackupFrequency', e.target.value)}
                  className="w-full bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded text-xs focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] appearance-none"
                >
                  <option value="off">Off</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Backup Destination
                </label>
                <div className="flex space-x-2">
                  <div className="flex-1 bg-[#141414] border border-[#f0b419]/30 rounded p-2 text-[10px] text-gray-400 truncate">
                    {settings.backupPath || 'No path selected'}
                  </div>
                  <button
                    onClick={handleBrowse}
                    className="bg-[#141414] border border-[#f0b419]/50 text-[#f0b419] p-2 rounded hover:bg-[#f0b419]/10 transition-colors"
                    title="Browse"
                  >
                    <Folder size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      if (settings.backupPath) {
                        await invoke('open_folder', { path: settings.backupPath });
                      } else {
                        showToast('Please select a backup path first');
                      }
                    }}
                    className="bg-[#141414] border border-[#f0b419]/50 text-[#f0b419] p-2 rounded hover:bg-[#f0b419]/10 transition-colors"
                    title="Open Folder"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>

              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="w-full py-3 bg-[#f0b419]/10 border border-[#f0b419] text-[#f0b419] font-bold text-xs uppercase tracking-[0.2em] rounded hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBackingUp ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Backing up...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Backup Data Now</span>
                  </>
                )}
              </button>

              <button
                onClick={handleRestore}
                disabled={isRestoring}
                className="w-full py-3 bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 font-bold text-xs uppercase tracking-[0.2em] rounded hover:bg-emerald-500 hover:text-[#0a0a0a] transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isRestoring ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Restoring...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    <span>Restore Data from ZIP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-sm font-semibold text-[#f0b419] uppercase tracking-wider mb-4 border-b border-[#f0b419]/30 pb-2">
              Application Information
            </h2>
            <div className="bg-[#141414] border border-[#f0b419]/20 rounded-lg p-4 mb-6 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 uppercase tracking-widest font-medium">Current Version</span>
                <span className="text-white font-mono">{appVersion}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex flex-col space-y-1">
                  <span className="text-gray-500 uppercase tracking-widest font-medium">Update Status</span>
                  {updateInfo ? (
                    <span className="text-[#00ff7f] font-bold animate-pulse flex items-center">
                      <Activity size={12} className="mr-1" />
                      New Update {updateInfo.latest}
                    </span>
                  ) : updateError ? (
                    <span className="text-red-400 font-medium flex items-center">
                      <X size={12} className="mr-1" />
                      Check Failed ({updateError})
                    </span>
                  ) : (
                    <span className="text-[#00e5ff] font-medium flex items-center">
                      <Activity size={12} className="mr-1 invisible" />
                      Up to date
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onCheckUpdates();
                  }}
                  className="px-3 py-1.5 bg-[#f0b419]/10 border border-[#f0b419]/30 text-[#f0b419] hover:bg-[#f0b419] hover:text-[#0a0a0a] rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center space-x-2"
                >
                  <RefreshCw size={12} className={updateInfo ? "animate-spin" : ""} />
                  <span>Check Now</span>
                </button>
              </div>
              {updateInfo && (
                <div className="space-y-2 mt-2">
                  <button
                    onClick={() => onOpenUrl('https://github.com/CBY-Software/eve-anom-tracker/releases/latest')}
                    className="w-full py-2 bg-[#f0b419]/10 border border-[#f0b419] text-[#f0b419] font-bold text-[10px] uppercase tracking-[0.2em] rounded hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-all text-center flex items-center justify-center space-x-2"
                  >
                    <ExternalLink size={12} />
                    <span>Open Releases on GitHub</span>
                  </button>
                  <button
                    onClick={() => isTauri && getCurrentWindow().close()}
                    className="w-full py-2 bg-red-900/10 border border-red-500/50 text-red-500 font-bold text-[10px] uppercase tracking-[0.2em] rounded hover:bg-red-900/20 hover:text-white transition-all text-center flex items-center justify-center space-x-2"
                  >
                    <Power size={12} />
                    <span>Exit App to Update</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
