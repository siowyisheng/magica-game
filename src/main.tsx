import { createRoot } from 'react-dom/client';
import { App } from './App';
import './ui/styles.css';
import { useGame } from './store';
import { installAudio } from './audio';

// Debug/automation hook (dev only).
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;

installAudio();

createRoot(document.getElementById('root')!).render(<App />);
