import { IconButton } from '@/components/IconButton';
import { useStudio } from '@/state/studio';

/** Header composition from sidebar.json#SidebarApp (AppHeader), without the sidebar. */
export function AppHeader() {
  const { theme, toggleTheme, analysis } = useStudio();
  const { counts, status } = analysis;
  const summary =
    status === 'syntax-error'
      ? 'JSON has errors'
      : counts.total === 0
        ? 'No data'
        : `${counts.rendered.toLocaleString()} of ${counts.total.toLocaleString()} features drawn`;

  return (
    <header className="border-stroke-divider bg-surface-primary flex h-14 shrink-0 items-center gap-3 border-b px-4">
      {/* The logo sits on its own navy square, so one file serves both themes. */}
      <img src="/logo.svg" alt="" width={24} height={24} className="size-6" />
      <span className="headings-h4-semibold text-fg-primary">GeoJSON Studio</span>
      <span className="label-small-primary text-fg-secondary hidden sm:inline" aria-live="polite">
        {summary}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <IconButton
          icon={theme === 'dark' ? 'light_mode' : 'dark_mode'}
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        />
      </div>
    </header>
  );
}
