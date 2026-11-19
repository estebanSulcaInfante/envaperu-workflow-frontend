import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './C66PiecePicker.css';

const MAX_VISIBLE_OPTIONS = 8;
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

const uniqueNames = (options) => [...new Set((Array.isArray(options) ? options : [])
  .map((option) => String(option ?? '').trim()).filter(Boolean))];

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="m4 4 8 8M12 4l-8 8" /></svg>;
}

export default function C66PiecePicker({ options = [], value = [], onChange }) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const legendId = `${inputId}-legend`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const names = useMemo(() => uniqueNames(options), [options]);
  const selected = useMemo(() => (Array.isArray(value) ? value.map(String).filter(Boolean) : []), [value]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const normalizedQuery = normalize(query.trim());
  const filteredNames = useMemo(() => {
    if (!normalizedQuery) return names;
    return names.filter((name) => normalizedQuery.split(/\s+/).every((word) => normalize(name).includes(word)));
  }, [names, normalizedQuery]);
  const visibleNames = filteredNames.slice(0, MAX_VISIBLE_OPTIONS);

  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  const emitSelection = (name) => {
    onChange?.(selectedSet.has(name) ? selected.filter((item) => item !== name) : [...selected, name]);
    inputRef.current?.focus();
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        if (!visibleNames.length) return -1;
        return event.key === 'ArrowDown'
          ? (current + 1) % visibleNames.length
          : (current <= 0 ? visibleNames.length - 1 : current - 1);
      });
    } else if (event.key === 'Enter' && open && visibleNames.length && (activeIndex >= 0 || normalizedQuery)) {
      event.preventDefault();
      emitSelection(visibleNames[Math.max(0, activeIndex)]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'Backspace' && !query && selected.length) {
      onChange?.(selected.slice(0, -1));
    }
  };

  return (
    <fieldset className="c66-piece-picker" ref={rootRef}>
      <legend id={legendId} className="c66-piece-picker__label">Piezas a contar</legend>
      <div className="c66-piece-picker__shell">
        <div className="c66-piece-picker__selected" aria-label="Piezas seleccionadas">
          {selected.map((name) => (
            <span className="c66-piece-picker__chip" key={name}>
              <span>{name}</span>
              <button type="button" className="c66-piece-picker__remove" aria-label={`Quitar pieza ${name}`} onClick={() => onChange?.(selected.filter((item) => item !== name))}>
                <CloseIcon />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={inputId}
            className="c66-piece-picker__input"
            type="search"
            value={query}
            placeholder="Buscar pieza"
            autoComplete="off"
            role="combobox"
            aria-labelledby={legendId}
            aria-autocomplete="list"
            aria-controls={open ? listboxId : undefined}
            aria-expanded={open}
            aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(-1); }}
            onKeyDown={handleKeyDown}
          />
        </div>
        {open && (
          <div className="c66-piece-picker__popover">
            <div id={listboxId} className="c66-piece-picker__options" role="listbox" aria-label="Resultados de piezas" aria-multiselectable="true">
              {visibleNames.map((name, index) => (
                <div
                  id={`${listboxId}-option-${index}`}
                  className={`c66-piece-picker__option${selectedSet.has(name) ? ' is-selected' : ''}${activeIndex === index ? ' is-active' : ''}`}
                  key={name}
                  role="option"
                  aria-selected={selectedSet.has(name)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => emitSelection(name)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="c66-piece-picker__indicator" aria-hidden="true" />
                  <span>{name}</span>
                </div>
              ))}
              {!visibleNames.length && <p className="c66-piece-picker__empty" role="status">{names.length ? 'No hay piezas que coincidan.' : 'No hay piezas disponibles.'}</p>}
            </div>
            {filteredNames.length > 0 && <p className="c66-piece-picker__count" role="status">{filteredNames.length} {filteredNames.length === 1 ? 'resultado' : 'resultados'}</p>}
          </div>
        )}
      </div>
    </fieldset>
  );
}
