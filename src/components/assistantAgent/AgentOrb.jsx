import { useTheme } from '@mui/material/styles';
import Strands from './vendor/Strands.jsx';
import './assistantAgent.css';

const labels = {
  idle: 'Agente listo',
  working: 'Agente trabajando',
  running: 'Agente trabajando',
  error: 'Agente requiere atención',
  success: 'Agente completó la tarea',
};

const profiles = {
  idle: { speed: 1, energy: 0.65, amplitude: 1, waviness: 1, accent: '#3569fa' },
  working: { colors: ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'], speed: 3, energy: 1, amplitude: 1.35, waviness: 1.7, accent: '#3b82f6' },
  running: { colors: ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'], speed: 3, energy: 1, amplitude: 1.35, waviness: 1.7, accent: '#3b82f6' },
  error: { colors: Array(7).fill('#ef4444'), speed: 0.35, energy: 0.5, amplitude: 0.7, waviness: 1, accent: '#ef4444' },
  success: { colors: ['#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d'], speed: 0.55, energy: 0.72, amplitude: 0.9, waviness: 1.1, accent: '#22c55e' },
};

export function AgentOrb({ state = 'idle', size = 40 }) {
  const theme = useTheme();
  const profile = profiles[state] || profiles.idle;
  return <span className={`assistant-agent-orb assistant-agent-orb--${state}`} role="img" aria-label={labels[state] || labels.idle} data-orb-speed={profile.speed} data-orb-energy={profile.energy} style={{ width: size, height: size, '--assistant-agent-orb-accent': profile.accent }}>
    <Strands colors={profile.colors} lightMode={theme.palette.mode !== 'dark'} speed={profile.speed} energy={profile.energy} amplitude={profile.amplitude} waviness={profile.waviness} interactive={false} clickPulse={false} />
  </span>;
}
