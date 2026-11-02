// Stroke icon set (24×24 grid, Lucide-style geometry) drawn with
// react-native-svg, so no icon font or extra native module is needed.
import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Polygon, Rect } from 'react-native-svg';
import { useTheme } from '@/design/theme';

const glyphs = {
  home: (
    <>
      <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  receipt: (
    <>
      <Path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <Path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <Path d="M12 17.5v-11" />
    </>
  ),
  chart: (
    <>
      <Path d="M3 3v18h18" />
      <Path d="M18 17V9" />
      <Path d="M13 17V5" />
      <Path d="M8 17v-3" />
    </>
  ),
  pie: (
    <>
      <Path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <Path d="M22 12A10 10 0 0 0 12 2v10z" />
    </>
  ),
  settings: (
    <>
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  plus: (
    <>
      <Path d="M5 12h14" />
      <Path d="M12 5v14" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.3-4.3" />
    </>
  ),
  x: (
    <>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  chevronRight: <Path d="m9 18 6-6-6-6" />,
  chevronLeft: <Path d="m15 18-6-6 6-6" />,
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  arrowLeft: (
    <>
      <Path d="m12 19-7-7 7-7" />
      <Path d="M19 12H5" />
    </>
  ),
  calendar: (
    <>
      <Rect width="18" height="18" x="3" y="4" rx="2" />
      <Path d="M16 2v4" />
      <Path d="M8 2v4" />
      <Path d="M3 10h18" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </>
  ),
  trash: (
    <>
      <Path d="M3 6h18" />
      <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </>
  ),
  pencil: <Path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  bell: (
    <>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  wallet: (
    <>
      <Path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <Path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <Path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </>
  ),
  users: (
    <>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  tag: (
    <>
      <Path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <Path d="M7 7h.01" />
    </>
  ),
  target: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Circle cx="12" cy="12" r="6" />
      <Circle cx="12" cy="12" r="2" />
    </>
  ),
  share: (
    <>
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <Polyline points="16 6 12 2 8 6" />
      <Line x1="12" x2="12" y1="2" y2="15" />
    </>
  ),
  shield: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  info: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 16v-4" />
      <Path d="M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </>
  ),
  sparkles: (
    <>
      <Path d="M12 3l1.9 5.8L20 10.5l-6.1 1.7L12 18l-1.9-5.8L4 10.5l6.1-1.7z" />
      <Path d="M19 3v4" />
      <Path d="M21 5h-4" />
    </>
  ),
  zap: <Path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  smartphone: (
    <>
      <Rect width="14" height="20" x="5" y="2" rx="2" />
      <Path d="M12 18h.01" />
    </>
  ),
  refresh: (
    <>
      <Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <Path d="M21 3v5h-5" />
      <Path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <Path d="M8 16H3v5" />
    </>
  ),
  note: (
    <>
      <Path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1="16" x2="8" y1="13" y2="13" />
      <Line x1="16" x2="8" y1="17" y2="17" />
    </>
  ),
  store: (
    <>
      <Path d="M3 9l1.5-5h15L21 9" />
      <Path d="M3 9h18v1.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
      <Path d="M5 13v8h14v-8" />
      <Path d="M10 21v-5h4v5" />
    </>
  ),
  trendingUp: (
    <>
      <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <Polyline points="16 7 22 7 22 13" />
    </>
  ),
  trendingDown: (
    <>
      <Polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <Polyline points="16 17 22 17 22 11" />
    </>
  ),
  database: (
    <>
      <Path d="M21 5c0 1.66-4.03 3-9 3S3 6.66 3 5s4.03-3 9-3 9 1.34 9 3z" />
      <Path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <Path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </>
  ),
  inbox: (
    <>
      <Polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <Path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  lock: (
    <>
      <Rect width="18" height="11" x="3" y="11" rx="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  flask: (
    <>
      <Path d="M9 2v7.31L3.62 18.5A2 2 0 0 0 5.35 21.5h13.3a2 2 0 0 0 1.73-3L15 9.31V2" />
      <Path d="M8.5 2h7" />
      <Path d="M7 16h10" />
    </>
  ),
  battery: (
    <>
      <Path d="M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
      <Path d="M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1" />
      <Path d="m11 7-3 5h4l-3 5" />
      <Line x1="22" x2="22" y1="11" y2="13" />
    </>
  ),
  repeat: (
    <>
      <Path d="m17 2 4 4-4 4" />
      <Path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <Path d="m7 22-4-4 4-4" />
      <Path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  split: (
    <>
      <Path d="M16 3h5v5" />
      <Path d="M8 3H3v5" />
      <Path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
      <Path d="m15 9 6-6" />
    </>
  ),
  upload: (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="17 8 12 3 7 8" />
      <Line x1="12" x2="12" y1="3" y2="15" />
    </>
  ),
  download: (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="7 10 12 15 17 10" />
      <Line x1="12" x2="12" y1="15" y2="3" />
    </>
  ),
  moon: <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  sun: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2" />
      <Path d="M12 20v2" />
      <Path d="m4.93 4.93 1.41 1.41" />
      <Path d="m17.66 17.66 1.41 1.41" />
      <Path d="M2 12h2" />
      <Path d="M20 12h2" />
      <Path d="m6.34 17.66-1.41 1.41" />
      <Path d="m19.07 4.93-1.41 1.41" />
    </>
  ),
  arrowDownLeft: (
    <>
      <Path d="M17 7 7 17" />
      <Path d="M17 17H7V7" />
    </>
  ),
  arrowUpRight: (
    <>
      <Path d="M7 7h10v10" />
      <Path d="M7 17 17 7" />
    </>
  ),
  send: (
    <>
      <Path d="m22 2-7 20-4-9-9-4Z" />
      <Path d="M22 2 11 13" />
    </>
  ),
  undo: (
    <>
      <Path d="M3 7v6h6" />
      <Path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ),

  // ---- UI additions (Paper & Ink)
  user: (
    <>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  sliders: (
    <>
      <Path d="M21 4h-7" />
      <Path d="M10 4H3" />
      <Path d="M21 12h-9" />
      <Path d="M8 12H3" />
      <Path d="M21 20h-5" />
      <Path d="M12 20H3" />
      <Path d="M14 2v4" />
      <Path d="M8 10v4" />
      <Path d="M16 18v4" />
    </>
  ),
  history: (
    <>
      <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Path d="M3 3v5h5" />
      <Path d="M12 7v5l4 2" />
    </>
  ),
  layoutGrid: (
    <>
      <Rect width="7" height="7" x="3" y="3" rx="1" />
      <Rect width="7" height="7" x="14" y="3" rx="1" />
      <Rect width="7" height="7" x="14" y="14" rx="1" />
      <Rect width="7" height="7" x="3" y="14" rx="1" />
    </>
  ),
  message: (
    <>
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <Path d="M13 8H7" />
      <Path d="M17 12H7" />
    </>
  ),
  qrCode: (
    <>
      <Rect width="5" height="5" x="3" y="3" rx="1" />
      <Rect width="5" height="5" x="16" y="3" rx="1" />
      <Rect width="5" height="5" x="3" y="16" rx="1" />
      <Path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <Path d="M21 21v.01" />
      <Path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <Path d="M3 12h.01" />
      <Path d="M12 3h.01" />
      <Path d="M12 16v.01" />
      <Path d="M16 12h1" />
      <Path d="M21 12v.01" />
      <Path d="M12 21v-1" />
    </>
  ),
  shapes: (
    <>
      <Path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
      <Rect x="3" y="14" width="7" height="7" rx="1" />
      <Circle cx="17.5" cy="17.5" r="3.5" />
    </>
  ),
  fileSpreadsheet: (
    <>
      <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <Path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <Path d="M8 13h2" />
      <Path d="M14 13h2" />
      <Path d="M8 17h2" />
      <Path d="M14 17h2" />
    </>
  ),
  cloudUpload: (
    <>
      <Path d="M12 13v8" />
      <Path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <Path d="m8 17 4-4 4 4" />
    </>
  ),
  shieldCheck: (
    <>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  ),
  share2: (
    <>
      <Circle cx="18" cy="5" r="3" />
      <Circle cx="6" cy="12" r="3" />
      <Circle cx="18" cy="19" r="3" />
      <Line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
      <Line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
    </>
  ),
  coins: (
    <>
      <Circle cx="8" cy="8" r="6" />
      <Path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <Path d="M7 6h1v4" />
      <Path d="m16.71 13.88.7.71-2.82 2.82" />
    </>
  ),

  // ---- Voice / audio icons
  mic: (
    <>
      <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <Path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <Line x1="12" x2="12" y1="19" y2="22" />
    </>
  ),
  micOff: (
    <>
      <Path d="M1 1l23 23" />
      <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <Path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <Line x1="12" x2="12" y1="19" y2="22" />
    </>
  ),
  volume: (
    <>
      <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </>
  ),
  pause: (
    <>
      <Rect x="6" y="4" width="4" height="16" rx="1" />
      <Rect x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
  arrowUp: (
    <>
      <Path d="M12 19V5" />
      <Path d="m5 12 7-7 7 7" />
    </>
  ),
  arrowDown: (
    <>
      <Path d="M12 5v14" />
      <Path d="m19 12-7 7-7-7" />
    </>
  ),

  // ---- Category icons
  utensils: (
    <>
      <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <Path d="M7 2v20" />
      <Path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </>
  ),
  coffee: (
    <>
      <Path d="M10 2v2" />
      <Path d="M14 2v2" />
      <Path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
      <Path d="M6 2v2" />
    </>
  ),
  shoppingCart: (
    <>
      <Circle cx="8" cy="21" r="1" />
      <Circle cx="19" cy="21" r="1" />
      <Path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </>
  ),
  car: (
    <>
      <Path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <Circle cx="7" cy="17" r="2" />
      <Path d="M9 17h6" />
      <Circle cx="17" cy="17" r="2" />
    </>
  ),
  fuel: (
    <>
      <Path d="M3 22h12" />
      <Path d="M4 9h10" />
      <Path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
      <Path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
    </>
  ),
  plane: (
    <Path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  ),
  shoppingBag: (
    <>
      <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <Path d="M3 6h18" />
      <Path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  shirt: (
    <Path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
  ),
  receiptText: (
    <>
      <Path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <Path d="M14 8H8" />
      <Path d="M16 12H8" />
      <Path d="M13 16H8" />
    </>
  ),
  lightbulb: (
    <>
      <Path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <Path d="M9 18h6" />
      <Path d="M10 22h4" />
    </>
  ),
  clapperboard: (
    <>
      <Path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
      <Path d="m6.2 5.3 3.1 3.9" />
      <Path d="m12.4 3.4 3.1 4" />
      <Path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </>
  ),
  gamepad: (
    <>
      <Path d="M6 11h4" />
      <Path d="M8 9v4" />
      <Path d="M15 12h.01" />
      <Path d="M18 10h.01" />
      <Path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z" />
    </>
  ),
  music: (
    <>
      <Path d="M9 18V5l12-2v13" />
      <Circle cx="6" cy="18" r="3" />
      <Circle cx="18" cy="16" r="3" />
    </>
  ),
  pill: (
    <>
      <Path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <Path d="m8.5 8.5 7 7" />
    </>
  ),
  dumbbell: (
    <>
      <Path d="m6.5 6.5 11 11" />
      <Path d="m21 21-1-1" />
      <Path d="m3 3 1 1" />
      <Path d="m18 22 4-4" />
      <Path d="m2 6 4-4" />
      <Path d="m3 10 7-7" />
      <Path d="m14 21 7-7" />
    </>
  ),
  bookOpen: (
    <>
      <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  graduationCap: (
    <>
      <Path d="M22 10v6" />
      <Path d="M2 10l10-5 10 5-10 5z" />
      <Path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  pawPrint: (
    <>
      <Circle cx="11" cy="4" r="2" />
      <Circle cx="18" cy="8" r="2" />
      <Circle cx="20" cy="16" r="2" />
      <Path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </>
  ),
  gift: (
    <>
      <Rect x="3" y="8" width="18" height="4" rx="1" />
      <Path d="M12 8v13" />
      <Path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <Path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </>
  ),
  scissors: (
    <>
      <Circle cx="6" cy="6" r="3" />
      <Path d="M8.12 8.12 12 12" />
      <Path d="M20 4 8.12 15.88" />
      <Circle cx="6" cy="18" r="3" />
      <Path d="M14.8 14.8 20 20" />
    </>
  ),
  wine: (
    <>
      <Path d="M8 22h8" />
      <Path d="M7 10h10" />
      <Path d="M12 15v7" />
      <Path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
    </>
  ),
  heartPulse: (
    <>
      <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <Path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </>
  ),
  train: (
    <>
      <Rect width="16" height="16" x="4" y="3" rx="2" />
      <Path d="M4 11h16" />
      <Path d="M12 3v8" />
      <Path d="m8 19-2 3" />
      <Path d="m18 22-2-3" />
      <Path d="M8 15h.01" />
      <Path d="M16 15h.01" />
    </>
  ),
  briefcase: (
    <>
      <Rect width="20" height="14" x="2" y="7" rx="2" />
      <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  wrench: (
    <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  package: (
    <>
      <Path d="m7.5 4.27 9 5.15" />
      <Path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <Path d="m3.3 7 8.7 5 8.7-5" />
      <Path d="M12 22V12" />
    </>
  ),
  laptop: (
    <Path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
  ),
  landmark: (
    <>
      <Path d="M3 22h18" />
      <Path d="M6 18v-7" />
      <Path d="M10 18v-7" />
      <Path d="M14 18v-7" />
      <Path d="M18 18v-7" />
      <Path d="M12 2 20 7H4z" />
    </>
  ),
} as const;

export type IconName = keyof typeof glyphs;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color: colorProp, strokeWidth = 2 }: IconProps) {
  const { colors } = useTheme();
  const color = colorProp ?? colors.text;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyphs[name]}
    </Svg>
  );
}
