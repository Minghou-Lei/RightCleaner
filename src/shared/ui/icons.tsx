import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="20"
      {...props}
    />
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
      <path d="M5 18l.7 1.8L7.5 21l-1.8.7L5 23l-.7-1.3L2.5 21l1.8-1.2L5 18Z" />
    </BaseIcon>
  );
}

export function OverviewIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect height="7" rx="1.5" width="7" x="3" y="4" />
      <rect height="7" rx="1.5" width="11" x="10" y="4" />
      <rect height="9" rx="1.5" width="7" x="3" y="11" />
      <rect height="9" rx="1.5" width="11" x="10" y="11" />
    </BaseIcon>
  );
}

export function CleanupIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16" />
      <path d="M9 3h6" />
      <path d="M8 7v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </BaseIcon>
  );
}

export function BatchIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h12" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
      <path d="m18 6 1.5 1.5L22 5" />
      <path d="m16 16 2 2 4-4" />
    </BaseIcon>
  );
}

export function RecoveryIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
      <path d="M12 8v4l3 2" />
    </BaseIcon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3 5 6v5c0 4.5 2.9 7.8 7 10 4.1-2.2 7-5.5 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.7 1.7 3.8-4.2" />
    </BaseIcon>
  );
}

export function SourceIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 7h10" />
      <path d="M7 12h10" />
      <path d="M7 17h6" />
      <rect height="16" rx="2" width="18" x="3" y="4" />
    </BaseIcon>
  );
}
