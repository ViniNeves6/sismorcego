import React from 'react';
import Svg, { Circle, Path, Rect, Text } from 'react-native-svg';
import useAccessibility from '../hooks/useAccessibility';

// Code-based illustration of the current search, coordinator selectors and
// status pills. It scales as one picture instead of cropping text on phones.
export default function HowToRecordsPreview({ isCoordenador = false }) {
  const { highContrast } = useAccessibility();
  const surface = highContrast ? '#08080C' : '#FFFFFF';
  const ink = highContrast ? '#FFFFFF' : '#181126';
  const purple = highContrast ? '#FFD700' : '#6824D6';
  const muted = highContrast ? '#F2E8A6' : '#796E92';
  const selectedInk = highContrast ? '#000000' : '#FFFFFF';
  const pillsY = isCoordenador ? 140 : 58;
  const label = isCoordenador
    ? 'Busca de registros, filtros Município: Todos e Espécie: Todas, e opções Todos, Pendentes e Enviados'
    : 'Busca de registros e opções Todos, Pendentes e Enviados';
  return <Svg testID="howto-records-preview" width="100%" height="100%"
    viewBox={`0 0 360 ${isCoordenador ? 174 : 92}`} preserveAspectRatio="xMidYMid meet"
    accessibilityRole="image" accessibilityLabel={label}>
    <Rect x={5} y={5} width={350} height={35} rx={11} fill={surface} stroke={purple} strokeWidth={1} />
    <Circle cx={24} cy={21} r={6} stroke={purple} strokeWidth={1.7} fill="none" />
    <Path d="M28.5 25.5 L33 30" stroke={purple} strokeWidth={1.7} strokeLinecap="round" />
    <Text x={43} y={26} fill={muted} fontFamily="PlusJakartaSans-Medium" fontSize={11}>
      Buscar por município, espécie ou comunidade...
    </Text>
    {isCoordenador && ['Município: Todos', 'Espécie: Todas'].map((text, index) => {
      const y = 50 + index * 44;
      return <React.Fragment key={text}>
        <Rect x={5} y={y} width={350} height={35} rx={11} fill={surface} stroke={purple} strokeWidth={1} />
        <Text x={19} y={y + 23} fill={ink} fontFamily="PlusJakartaSans-SemiBold" fontSize={13}>{text}</Text>
        <Path d={`M328 ${y + 15} l5 5 l5 -5`} stroke={muted} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </React.Fragment>;
    })}
    {[
      { label: 'Todos', x: 5, width: 120, active: true },
      { label: 'Pendentes', x: 134, width: 106 },
      { label: 'Enviados', x: 249, width: 106 },
    ].map(pill => <React.Fragment key={pill.label}>
      <Rect x={pill.x} y={pillsY} width={pill.width} height={29} rx={14.5}
        fill={pill.active ? purple : surface} stroke={pill.active ? purple : highContrast ? purple : '#EAE5F5'} />
      <Text x={pill.x + pill.width / 2 - (pill.active ? 10 : 0)} y={pillsY + 19}
        textAnchor="middle" fill={pill.active ? selectedInk : muted}
        fontFamily="PlusJakartaSans-Bold" fontSize={12}>{pill.label}</Text>
      {pill.active && <>
        <Circle cx={pill.x + 88} cy={pillsY + 14.5} r={9} fill={selectedInk} fillOpacity={0.2} />
        <Text x={pill.x + 88} y={pillsY + 18} textAnchor="middle" fill={selectedInk}
          fontFamily="PlusJakartaSans-Bold" fontSize={10}>0</Text>
      </>}
    </React.Fragment>)}
  </Svg>;
}
