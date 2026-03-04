import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, Mic, Upload, Settings, Pause, Play, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRecordingState, useRecordingActions } from '../../contexts/RecordingContext';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function NavBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const recordingState = useRecordingState();
  const actions = useRecordingActions();
  const { isRecording, isPaused, duration, isTranscribing, transcriptionProgress } = recordingState;

  const showRecordingControls = isRecording || isTranscribing;
  const isOnRecordPage = location.pathname === '/tabs/record';

  // Derive a simple page title from the current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/tabs' || path === '/tabs/') return t('nav.home');
    if (path.startsWith('/tabs/meetings') || path.startsWith('/tabs/meeting')) return t('nav.meetings');
    if (path === '/tabs/record') return t('nav.record');
    if (path === '/tabs/upload') return t('nav.upload');
    if (path === '/tabs/settings') return t('nav.settings');
    if (path === '/tabs/prompts') return t('nav.prompts') || 'Atelier Prompts';
    return 'Antislash Talk';
  };

  const tabItems = [
    { href: '/tabs', label: t('nav.home'), icon: Home, exact: true },
    { href: '/tabs/meetings', label: t('nav.meetings'), icon: FileText, exact: false },
    { href: '/tabs/record', label: t('nav.record'), icon: Mic, exact: true, isCenter: true },
    { href: '/tabs/upload', label: t('nav.upload'), icon: Upload, exact: true },
    { href: '/tabs/settings', label: t('nav.settings'), icon: Settings, exact: true },
  ];

  // Handle center button tap
  const handleCenterTap = () => {
    if (!isOnRecordPage) {
      navigate('/tabs/record');
      return;
    }
    // On record page: start recording if idle
    if (!isRecording && !isTranscribing && actions.onStart) {
      actions.onStart();
    }
  };

  return (
    <>
      {/* Top bar - simplified, just the page title (mobile only) */}
      <nav
        className="bg-white/20 backdrop-blur-xl border-b border-gray-200/50 md:hidden fixed top-0 left-0 right-0 z-40"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div
          className="flex items-center justify-center h-12"
          style={{
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
          }}
        >
          <span className="font-semibold text-base text-black">
            {isRecording ? (
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-gray-400' : 'bg-red-500 animate-pulse'}`} />
                <span className="font-mono">{formatTime(duration)}</span>
                <span className="text-gray-400 font-normal text-sm">{isPaused ? 'Pause' : 'REC'}</span>
              </span>
            ) : isTranscribing ? (
              <span className="text-gray-600">Transcription...</span>
            ) : (
              getPageTitle()
            )}
          </span>
        </div>
      </nav>

      {/* Bottom tab bar (mobile only) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/20 backdrop-blur-xl border-t border-gray-200/50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div>
          {showRecordingControls ? (
            /* Recording mode: show controls instead of tabs */
            <div
              className="flex items-center justify-center gap-6 px-4 py-2"
              style={{
                paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
              }}
            >
              {isRecording && (
                <>
                  {/* Pause/Resume button */}
                  <button
                    onClick={actions.onPauseResume}
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 active:scale-90 transition-all"
                  >
                    {isPaused ? (
                      <Play className="w-5 h-5 text-black ml-0.5" />
                    ) : (
                      <Pause className="w-5 h-5 text-black" />
                    )}
                  </button>

                  {/* Timer */}
                  <div className="flex flex-col items-center min-w-[80px]">
                    <span className="text-2xl font-mono font-semibold text-black tracking-tight">
                      {formatTime(duration)}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-gray-400' : 'bg-red-500 animate-pulse'}`} />
                      <span className="text-[11px] text-gray-500 font-medium">
                        {isPaused ? 'Pause' : 'REC'}
                      </span>
                    </div>
                  </div>

                  {/* Stop button */}
                  <button
                    onClick={actions.onStop}
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-red-600 shadow-lg shadow-red-600/30 active:scale-90 transition-all"
                  >
                    <Square className="w-5 h-5 text-white" />
                  </button>
                </>
              )}

              {isTranscribing && !isRecording && (
                <div className="flex flex-col items-center py-1">
                  <span className="text-sm font-medium text-black">Transcription en cours...</span>
                  <div className="w-48 mt-2 h-1.5 rounded-full overflow-hidden bg-gray-200">
                    <div
                      className="h-full rounded-full bg-black transition-all duration-300"
                      style={{ width: `${transcriptionProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Normal tab bar */
            <div
              className="flex items-end justify-around px-2 pt-1 pb-1"
              style={{
                paddingLeft: 'max(0.25rem, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(0.25rem, env(safe-area-inset-right, 0px))',
              }}
            >
              {tabItems.map((item) => {
                const IconComponent = item.icon;

                // Active state logic matching SideBar
                const isActive = item.exact
                  ? location.pathname === item.href
                  : location.pathname.startsWith(item.href);

                if (item.isCenter) {
                  // Center Record button - accentuated, raised
                  return (
                    <button
                      key={item.href}
                      onClick={handleCenterTap}
                      className="flex flex-col items-center justify-center -translate-y-3 transition-all duration-200"
                    >
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-black shadow-black/20 scale-105'
                            : 'bg-black shadow-black/15'
                        }`}
                      >
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <span
                        className={`text-[10px] font-medium mt-1 transition-all duration-200 ${
                          isActive ? 'text-black' : 'text-gray-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                }

                // Standard tab item
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.exact}
                    className="flex flex-col items-center justify-center py-1.5 px-1 min-w-[56px] transition-all duration-200"
                  >
                    <IconComponent
                      className={`w-5 h-5 transition-all duration-200 ${
                        isActive ? 'text-black' : 'text-gray-400'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-medium mt-0.5 transition-all duration-200 ${
                        isActive ? 'text-black' : 'text-gray-400'
                      }`}
                    >
                      {item.label}
                    </span>
                    {/* Active dot indicator */}
                    {isActive && (
                      <div className="w-1 h-1 rounded-full bg-black mt-0.5 transition-all duration-200" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
