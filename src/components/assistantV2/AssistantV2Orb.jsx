import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import AssistantV2Panel from './AssistantV2Panel';

const ORB_SIZE = 68;
const DRAG_THRESHOLD = 8;
const EDGE_GAP = 14;
const POSITION_PREFIX = 'scm-assistant-v2-position';
const DEVICE_KEY = 'scm-assistant-v2-device-id';

const readStorage = (key) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const writeStorage = (key, value) => { try { window.localStorage.setItem(key, value); } catch { /* private browsing */ } };
const deviceId = () => {
  const current = readStorage(DEVICE_KEY);
  if (current) return current;
  const next = globalThis.crypto?.randomUUID?.() || `device-${Math.random().toString(36).slice(2)}`;
  writeStorage(DEVICE_KEY, next);
  return next;
};

const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
const defaultPosition = () => ({ x: Math.max(EDGE_GAP, window.innerWidth - ORB_SIZE - EDGE_GAP), y: Math.max(EDGE_GAP, window.innerHeight - ORB_SIZE - 104) });
const clampPosition = ({ x, y }) => {
  const maxX = Math.max(EDGE_GAP, window.innerWidth - ORB_SIZE - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - ORB_SIZE - EDGE_GAP);
  const safeX = Number.isFinite(Number(x)) ? Number(x) : maxX;
  const safeY = Number.isFinite(Number(y)) ? Number(y) : maxY;
  return { x: clamp(safeX, EDGE_GAP, maxX), y: clamp(safeY, EDGE_GAP, maxY) };
};
const snapPosition = ({ x, y }) => {
  const current = clampPosition({ x, y });
  const right = window.innerWidth - ORB_SIZE - EDGE_GAP;
  const bottom = window.innerHeight - ORB_SIZE - EDGE_GAP;
  const distances = [{ edge: 'left', value: EDGE_GAP, distance: current.x }, { edge: 'right', value: right, distance: right - current.x }, { edge: 'top', value: EDGE_GAP, distance: current.y }, { edge: 'bottom', value: bottom, distance: bottom - current.y }];
  const nearest = distances.sort((a, b) => a.distance - b.distance)[0];
  if (nearest.edge === 'left' || nearest.edge === 'right') return { ...current, x: nearest.value };
  return { ...current, y: nearest.value };
};

function AssistantV2OrbInstance({ actorId, canReview = false, onVisibilityChange }) {
  const key = useMemo(() => `${POSITION_PREFIX}:${actorId || 'unknown'}:${deviceId()}`, [actorId]);
  const [position, setPosition] = useState(() => {
    const saved = readStorage(`${POSITION_PREFIX}:${actorId || 'unknown'}:${deviceId()}`);
    if (!saved) return defaultPosition();
    try { return clampPosition(JSON.parse(saved)); } catch { return defaultPosition(); }
  });
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const orbRef = useRef(null);

  useEffect(() => {
    const onResize = () => setPosition((current) => clampPosition(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { onVisibilityChange?.(open); }, [onVisibilityChange, open]);

  const persist = useCallback((next) => { const normalized = snapPosition(next); setPosition(normalized); writeStorage(key, JSON.stringify(normalized)); }, [key]);
  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, position, moved: false };
  };
  const onPointerMove = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    if (!drag.current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.current.moved = true;
    setPosition(clampPosition({ x: drag.current.position.x + dx, y: drag.current.position.y + dy }));
  };
  const onPointerUp = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const active = drag.current;
    drag.current = null;
    setDragging(false);
    if (active.moved) {
      suppressClick.current = true;
      const next = { x: active.position.x + event.clientX - active.startX, y: active.position.y + event.clientY - active.startY };
      persist(next);
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const onPointerCancel = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const active = drag.current;
    drag.current = null;
    setDragging(false);
    if (active.moved) {
      const next = { x: active.position.x + event.clientX - active.startX, y: active.position.y + event.clientY - active.startY };
      persist(next);
    }
  };
  const openFromKeyboard = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true); }
  };
  const onClick = () => { if (suppressClick.current) { suppressClick.current = false; return; } setOpen(true); };
  const closePanel = useCallback(() => {
    const active = document.activeElement;
    const restoreFocus = Boolean(active?.closest?.('[role="dialog"]'));
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => orbRef.current?.focus(), 0);
  }, []);

  return (
    <>
      <ButtonBase ref={orbRef} data-testid="scm-assistant-v2-orb" aria-label="Abrir asistente SCM" onClick={onClick} onKeyDown={openFromKeyboard} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onLostPointerCapture={onPointerCancel} sx={{ position: 'fixed', left: `max(${position.x}px, env(safe-area-inset-left, 0px))`, top: `max(${position.y}px, env(safe-area-inset-top, 0px))`, width: ORB_SIZE, height: ORB_SIZE, zIndex: 1399, borderRadius: '50%', bgcolor: '#f5c84c', color: '#101820', boxShadow: '0 10px 28px rgba(16,24,32,.28)', touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab', '&:focus-visible': { outline: '3px solid #1e3a5f', outlineOffset: 3 } }}>
        <Box aria-hidden="true" sx={{ position: 'relative', width: 42, height: 42, borderRadius: '50%', bgcolor: '#ffe796', border: '3px solid #101820' }}><Box sx={{ position: 'absolute', left: 9, top: 10, width: 6, height: 8, borderRadius: '50%', bgcolor: '#101820' }} /><Box sx={{ position: 'absolute', right: 9, top: 10, width: 6, height: 8, borderRadius: '50%', bgcolor: '#101820' }} /><Box sx={{ position: 'absolute', left: 12, bottom: 8, width: 12, height: 6, borderBottom: '2px solid #101820', borderRadius: '50%' }} /></Box>
      </ButtonBase>
      {open && <AssistantV2Panel onClose={closePanel} onMinimize={closePanel} canReview={canReview} />}
    </>
  );
}

export default function AssistantV2Orb(props) {
  return <AssistantV2OrbInstance key={props.actorId || 'unknown'} {...props} />;
}
