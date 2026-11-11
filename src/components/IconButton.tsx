import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconShell } from '@/components/ui/icon-shell';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type ButtonProps = ComponentProps<typeof Button>;

/** Ghost icon button + tooltip. Composition from button.json#ButtonIconOnly and tooltip.json#TooltipDemo. */
export function IconButton({
  icon,
  label,
  side = 'bottom',
  size = 'icon-sm',
  variant = 'ghost',
  ...props
}: Omit<ButtonProps, 'children' | 'size'> & {
  icon: string;
  label: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'icon-xs' | 'icon-sm' | 'icon';
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button aria-label={label} variant={variant} size={size} {...props} />}>
        <IconShell size="sm" type={variant === 'default' ? 'neutral-inverse' : 'neutral'} hoverable>
          <Icon icon={icon} />
        </IconShell>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Leading icon for text buttons (button.json#ButtonWithIcons). */
export function ButtonIcon({ icon, inverse = false }: { icon: string; inverse?: boolean }) {
  return (
    <IconShell size="sm" type={inverse ? 'neutral-inverse' : 'neutral'} variant="primary">
      <Icon icon={icon} />
    </IconShell>
  );
}
