import { createRoot } from 'react-dom/client';
import { App } from './App';
import './ui/styles.css';
import { useGame } from './store';
import { installAudio } from './audio';
import { loadLocalBalance } from './dev/balance';
import { useOnline } from './online/session';

loadLocalBalance();

// Debug/automation hook (dev only).
if (import.meta.env.DEV) Object.assign(window as object, { __game: useGame, __online: useOnline });

installAudio();

createRoot(document.getElementById('root')!).render(<App />);
