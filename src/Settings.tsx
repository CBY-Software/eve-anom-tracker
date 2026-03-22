import { ChangeEvent, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Folder, Save, Loader2, ExternalLink, Search, X, Plus, Activity } from 'lucide-react';
import systemsData from './data/solar_systems.json';

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
}

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_IPC__' in window);

export default function Settings({ settings, onSettingsChange, showToast, appVersion, updateInfo, updateError, onOpenUrl, onCheckUpdates }: SettingsProps) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSystems, setFilteredSystems] = useState<SolarSystem[]>([]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      const filtered = (systemsData as SolarSystem[])
        .filter(s => s.solarSystemName.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 10);
      setFilteredSystems(filtered);
    } else {
      setFilteredSystems([]);
    }
  }, [searchTerm]);

  const handleChange = (key: keyof AppSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const addSystem = (systemName: string) => {
    if (!settings.preferredSystems.includes(systemName)) {
      handleChange('preferredSystems', [...settings.preferredSystems, systemName]);
    }
    setSearchTerm('');
  };

  const removeSystem = (systemName: string) => {
    handleChange('preferredSystems', settings.preferredSystems.filter(s => s !== systemName));
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
      const settingsFile = await invoke<string>('join_paths', { base: dataDir, sub: 'settings.json' });
      
      await invoke('create_backup_zip', { 
        srcFiles: [dbFile, settingsFile], 
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

  return (
    <div className="flex-1 overflow-y-auto pr-2 pb-8 space-y-6">
      <h2 className="text-sm font-semibold text-[#f0b419] uppercase tracking-wider mb-4 border-b border-[#f0b419]/30 pb-2">
        Application Information
      </h2>
      <div className="bg-[#141414] border border-[#f0b419]/20 rounded-lg p-4 mb-6 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 uppercase tracking-widest font-medium">Current Version</span>
          <span className="text-white font-mono">{appVersion}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 uppercase tracking-widest font-medium">Update Status</span>
            <button 
              onClick={(e) => {
                e.preventDefault();
                onCheckUpdates();
              }}
              className="text-gray-600 hover:text-[#f0b419] transition-colors p-1"
              title="Check for updates"
            >
              <Activity size={10} className="animate-pulse" />
            </button>
          </div>
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
        {updateInfo && (
          <button 
            onClick={() => onOpenUrl('https://github.com/CBY-Software/eve-anom-tracker/releases/latest')}
            className="w-full mt-2 py-2 bg-[#f0b419]/10 border border-[#f0b419] text-[#f0b419] font-bold text-[10px] uppercase tracking-[0.2em] rounded hover:bg-[#f0b419] hover:text-[#0a0a0a] transition-all text-center flex items-center justify-center space-x-2"
          >
            <ExternalLink size={12} />
            <span>Open Releases on GitHub</span>
          </button>
        )}
      </div>

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

        <div className="space-y-2 pt-2 border-t border-gray-800">
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
                // Handle special mappings
                if (key === ' ') key = 'Space';
                if (key === 'ARROWUP') key = 'Up';
                if (key === 'ARROWDOWN') key = 'Down';
                if (key === 'ARROWLEFT') key = 'Left';
                if (key === 'ARROWRIGHT') key = 'Right';
                
                // Only register if there's a primary key (not just modifiers)
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
          <p className="text-[10px] text-gray-500 italic">
            Focus the field and press your desired combination (e.g. Ctrl+Shift+L)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mt-8">
        <div className="flex flex-col h-full">
          <h2 className="text-sm font-semibold text-[#f0b419] uppercase tracking-wider mb-4 border-b border-[#f0b419]/30 pb-2">
            Preferred Systems
          </h2>
          <div className="space-y-4 flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-gray-500" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#141414] border border-[#f0b419]/50 text-white pl-10 pr-3 py-2 rounded text-xs focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419]"
                placeholder="Search solar systems..."
              />
              
              {filteredSystems.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-[#1a1a1a] border border-[#f0b419]/30 rounded shadow-xl max-h-48 overflow-y-auto">
                  {filteredSystems.map(system => (
                    <button
                      key={system.solarSystemID}
                      onClick={() => addSystem(system.solarSystemName)}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#f0b419]/10 hover:text-[#f0b419] flex justify-between items-center group"
                    >
                      <span>{system.solarSystemName} <span className="text-[10px] text-gray-500">({system.regionName})</span></span>
                      <Plus size={12} className="opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.preferredSystems.map(system => (
                <div 
                  key={system}
                  className="flex items-center space-x-1 bg-[#f0b419]/10 border border-[#f0b419]/30 px-2 py-1 rounded group"
                >
                  <span className="text-xs text-gray-300">{system}</span>
                  <button
                    onClick={() => removeSystem(system)}
                    className="text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {settings.preferredSystems.length === 0 && (
                <p className="text-[10px] text-gray-500 italic">No preferred systems added yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col h-full">
          <h2 className="text-sm font-semibold text-[#f0b419] uppercase tracking-wider mb-4 border-b border-[#f0b419]/30 pb-2">
            Custom Site List
          </h2>
          <div className="space-y-2 flex-1 flex flex-col">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Comma-separated list of anomaly sites
            </p>
            <textarea
              value={settings.customSites}
              onChange={(e) => handleChange('customSites', e.target.value)}
              className="w-full flex-1 min-h-[120px] bg-[#141414] border border-[#f0b419]/50 text-white p-2 rounded text-xs focus:outline-none focus:border-[#f0b419] focus:ring-1 focus:ring-[#f0b419] resize-none"
              placeholder="Haven, Sanctum, Forsaken Hub..."
            />
          </div>
        </div>
      </div>



      <h2 className="text-sm font-semibold text-[#f0b419] uppercase tracking-wider mt-8 mb-4 border-b border-[#f0b419]/30 pb-2">
        Data Backup
      </h2>
      <div className="space-y-4">
        {settings.lastAutoBackup && (
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              Last Auto-Backup
            </span>
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-bold ${
                settings.lastAutoBackup === new Date().toISOString().split('T')[0]
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
      </div>
    </div>
  );
}
