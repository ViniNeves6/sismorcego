import React from 'react';
import { AccessibleSvg as Svg } from './AccessibleNative';
import { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

export function WifiIcon({ size = 15, color = '#181126' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <Path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <Line x1="12" y1="20" x2="12.01" y2="20" />
    </Svg>
  );
}

export function BatteryIcon({ size = 17, color = '#181126' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
      <Line x1="23" y1="13" x2="23" y2="11" />
    </Svg>
  );
}

export function CheckIcon({ size = 18, color = '#34D399', strokeWidth = 2.6 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

export function HelpQuestionIcon({ size = 20, color = '#6824D6', strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <Circle cx="12" cy="17" r="0.8" fill={color} />
    </Svg>
  );
}

export function BellIcon({ size = 22, color = '#6824D6' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <Path d="M10 21h4" />
    </Svg>
  );
}

export function CloseIcon({ size = 16, color = '#5E5473', strokeWidth = 2.4 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 16, color = '#5316B8', strokeWidth = 2.3 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 16, color = '#5316B8', strokeWidth = 2.3 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 18, color = '#5E5473', strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

export function ReporterBadgeIcon({ size = 19, color = '#6824D6', strokeWidth = 2.1 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="9" cy="7.5" r="3.8" />
      <Path d="M2.5 20v-.8a5.5 5.5 0 0 1 5.5-5.5h2" />
      <Path d="M13.5 20.5l.6-2.9 6.2-6.2a1.7 1.7 0 0 1 2.4 2.4l-6.2 6.2z" />
    </Svg>
  );
}

export function RefreshSyncIcon({ size = 16, color = '#FFFFFF', strokeWidth = 2.4 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Path d="M3 3v5h5" />
      <Path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <Path d="M16 16h5v5" />
    </Svg>
  );
}

export function SearchIcon({ size = 18, color = '#796E92', strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

export function PencilEditIcon({ size = 14, color = '#6824D6', strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}

export function TagInfoIcon({ size = 19, color = '#6824D6', strokeWidth = 2.1 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <Line x1="7" y1="7" x2="7.01" y2="7" />
    </Svg>
  );
}

export function VictimHumanoIcon({ size = 24, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

export function VictimCaninoIcon({ size = 24, color = '#6824D6', strokeWidth = 1.9 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="4" r="2" />
      <Circle cx="18" cy="8" r="2" />
      <Circle cx="20" cy="16" r="2" />
      <Path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </Svg>
  );
}

export function VictimAvesIcon({ size = 24, color = '#6824D6', strokeWidth = 1.9 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 7h.01" />
      <Path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
      <Path d="m20 7 2 .5-2 .5" />
      <Path d="M10 18v3" />
      <Path d="M14 17.75V21" />
      <Path d="M7 18a6 6 0 0 0 3.84-10.61" />
    </Svg>
  );
}

export function VictimProducaoIcon({ size = 24, color = '#6824D6', strokeWidth = 1.85 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 7c2.5 0 4 2 4 4.5L3 11C1.8 9.8 1.5 8 2 7Z" />
      <Path d="M22 7c-2.5 0-4 2-4 4.5l3-.5c1.2-1.2 1.5-3 1-4Z" />
      <Path d="M7 3.5C5.2 2 3.2 2.3 2.5 4.2c-.5 1.3.3 2.8 2 3.3" />
      <Path d="M17 3.5c1.8-1.5 3.8-1.2 4.5.7.5 1.3-.3 2.8-2 3.3" />
      <Path d="M6 9c0-2.5 2.5-4 6-4s6 1.5 6 4l.8 4.8c.5 3.2-1.8 6.2-5 6.2h-3.6c-3.2 0-5.5-3-5-6.2L6 9Z" />
      <Rect x="7.5" y="14" width="9" height="6" rx="3" />
      <Circle cx="9.5" cy="11" r="1" fill={color} stroke="none" />
      <Circle cx="14.5" cy="11" r="1" fill={color} stroke="none" />
      <Circle cx="10.2" cy="17" r="0.9" fill={color} stroke="none" />
      <Circle cx="13.8" cy="17" r="0.9" fill={color} stroke="none" />
    </Svg>
  );
}

export function VictimIconByKey({ victimKey, size = 20, color = '#6824D6' }) {
  if (victimKey === 'canino' || victimKey === 'canino_felino') {
    return <VictimCaninoIcon size={size} color={color} />;
  }
  if (victimKey === 'aves') {
    return <VictimAvesIcon size={size} color={color} />;
  }
  if (victimKey === 'producao') {
    return <VictimProducaoIcon size={size} color={color} />;
  }
  return <VictimHumanoIcon size={size} color={color} />;
}

export function CrosshairGpsIcon({ size = 20, color = '#6824D6', strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Line x1="22" y1="12" x2="18" y2="12" />
      <Line x1="6" y1="12" x2="2" y2="12" />
      <Line x1="12" y1="6" x2="12" y2="2" />
      <Line x1="12" y1="22" x2="12" y2="18" />
    </Svg>
  );
}

export function MapPinOutlineIcon({ size = 22, color = '#6824D6', strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" />
      <Circle cx="12" cy="9" r="2.5" />
    </Svg>
  );
}

export function MapPinStandardIcon({ size = 14, color = '#6824D6', strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

export function MapPinRedMarkerIcon({ width = 30, height = 38 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 30 38" fill="none">
      <Path
        d="M15 2C8.37 2 3 7.37 3 14c0 8.55 10.22 19.62 11.17 20.63a1.14 1.14 0 0 0 1.66 0C16.78 33.62 27 22.55 27 14c0-6.63-5.37-12-12-12Z"
        fill="#E11D48"
        stroke="#FFFFFF"
        strokeWidth={2.4}
      />
      <Circle cx="15" cy="14" r="4.5" fill="#FFFFFF" />
    </Svg>
  );
}

export function ExternalLinkIcon({ size = 13, color = '#6824D6', strokeWidth = 2.3 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <Polyline points="15 3 21 3 21 9" />
      <Line x1="10" y1="14" x2="21" y2="3" />
    </Svg>
  );
}

export function ArrowUpRightIcon({ size = 14, color = '#6824D6', strokeWidth = 2.4 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="7" y1="17" x2="17" y2="7" />
      <Polyline points="7 7 17 7 17 17" />
    </Svg>
  );
}

export function CameraIcon({ size = 22, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

export function GalleryImageIcon({ size = 22, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Polyline points="21 15 16 10 5 21" />
    </Svg>
  );
}

export function CalendarIcon({ size = 18, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

export function ArrowLeftIcon({ size = 18, color = '#5316B8', strokeWidth = 2.4 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 19 5 12 12 5" />
    </Svg>
  );
}

export function SettingsGearIcon({ size = 20, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function BookOpenIcon({ size = 20, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Svg>
  );
}

export function HelpCircleIcon({ size = 20, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  );
}

export function InfoCircleIcon({ size = 20, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="16" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12.01" y2="8" />
    </Svg>
  );
}

export function UsersIcon({ size = 20, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function LogOutIcon({ size = 20, color = '#C82333', strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  );
}

export function LockIcon({ size = 18, color = '#6824D6', strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

export function EyeIcon({ size = 18, color = '#5E5473', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function EyeOffIcon({ size = 18, color = '#5E5473', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  );
}

export function PlusIcon({ size = 16, color = '#FFFFFF', strokeWidth = 2.4 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

export function DoubtsBubbleIcon({ size = 34, color = '#6824D6', strokeWidth = 2.1 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <Path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
      <Line x1="12" y1="16" x2="12.01" y2="16" />
    </Svg>
  );
}

export function DockRegistrosIcon({ size = 22, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1="16" y1="13" x2="8" y2="13" />
      <Line x1="16" y1="17" x2="8" y2="17" />
      <Polyline points="10 9 9 9 8 9" />
    </Svg>
  );
}

export function DockMaisIcon({ size = 22, color = '#796E92', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="4" y1="6" x2="20" y2="6" />
      <Line x1="4" y1="12" x2="20" y2="12" />
      <Line x1="4" y1="18" x2="20" y2="18" />
    </Svg>
  );
}

export function GuideCompassIcon({ size = 22, color = '#6824D6', strokeWidth = 2.1 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 8v4l3 2" />
      <Path d="M4 4l2 2" />
    </Svg>
  );
}

export function DockPainelIcon({ size = 22, color = '#796E92', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="13" width="4" height="8" rx="1" />
      <Rect x="10" y="8" width="4" height="13" rx="1" />
      <Rect x="17" y="3" width="4" height="18" rx="1" />
    </Svg>
  );
}

export function DockAlertasIcon({ size = 22, color = '#796E92', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <Path d="M10 21h4" />
    </Svg>
  );
}

export function DoubleCheckIcon({ size = 22, color = '#6824D6', strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m2 12 4 4 7-8" />
      <Path d="m10 12 4 4 8-9" />
    </Svg>
  );
}


