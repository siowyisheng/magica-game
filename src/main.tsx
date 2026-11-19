import { createRoot } from 'react-dom/client';
import { App } from './App';
import './ui/styles.css';
import { useGame } from './store';

// Debug/automation hook (dev only).
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;

createRoot(document.getElementById('root')!).render(<App />);
