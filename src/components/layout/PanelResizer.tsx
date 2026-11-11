import { type KeyboardEvent, type PointerEvent, useRef } from 'react';

import { cn } from '@/lib/utils';

/** Vertical splitter between map and panel. No registry equivalent (see plan newComponents). */
export function PanelResizer({
  width,
  min,
  max,
  onChange,
  onReset,
}: {
  width: number;
  min: number;
  max: number;
  onChange: (px: number) => void;
  onReset: () => void;
}) {
  const dragging = useRef(false);
  const clamp = (v: number) => Math.round(Math.max(min, Math.min(max, v)));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const right = e.currentTarget.parentElement?.getBoundingClientRect().right ?? window.innerWidth;
    onChange(clamp(right - e.clientX));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') onChange(clamp(width + 32));
    else if (e.key === 'ArrowRight') onChange(clamp(width - 32));
    else if (e.key === 'Home') onChange(max);
    else if (e.key === 'End') onChange(min);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative z-10 -mx-1 flex w-2 shrink-0 cursor-col-resize touch-none justify-center outline-none',
        'focus-visible:ring-stroke-status-focus focus-visible:ring-1',
      )}>
      <div className="bg-stroke-divider group-hover:bg-stroke-active group-active:bg-stroke-active h-full w-px transition-colors duration-200" />
    </div>
  );
}
