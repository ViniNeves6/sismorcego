import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Animated, Pressable, Text, View, AccessibleSvg as Svg } from '../../ui/AccessibleNative';
import { Circle, Defs, Line, LinearGradient as SvgLinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';
import { panelChart } from '../../services/adminPanelData';
import useAnimatedTrend, { TREND_LAYOUT } from './useAnimatedTrend';
import useAccessibility from '../../hooks/useAccessibility';
import { describeChart } from '../../services/accessibilityDescriptions';

export default function PanelTrendChart({ records, reduceMotion = false }) {
  const { speak } = useAccessibility();
  const [chartMode, setChartMode] = useState('day');
  const target = useMemo(() => panelChart(records, chartMode), [records, chartMode]);
  const { data: chartData, ys, values, progress } = useAnimatedTrend(target, reduceMotion);
  const { svgWidth, svgHeight, padX, padTop, padBottom, baseline } = TREND_LAYOUT;
  const xs = chartData.values.map((_, i) => padX + i * (svgWidth - 2 * padX) / (chartData.values.length - 1));
  const polylinePoints = ys.map((y, i) => `${xs[i].toFixed(1)},${y.toFixed(1)}`).join(' ');
  const polygonPoints = `${xs[0].toFixed(1)},${baseline} ${polylinePoints} ${xs[xs.length - 1].toFixed(1)},${baseline}`;
  const entryStyles = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    const inputRange = [i * 60 / 740, (i * 60 + 500) / 740];
    return {
      opacity: progress.interpolate({ inputRange, outputRange: [0, 1], extrapolate: 'clamp' }),
      transform: [{ translateY: progress.interpolate({ inputRange, outputRange: [9, 0], extrapolate: 'clamp' }) }],
    };
  }), [progress]);
  return <>
  <View style={styles.sectionHeading}>
    <Text style={styles.headingTitle}>Registros por período</Text>
    <View style={styles.chartToggle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: chartMode === 'day' }}
        onPress={() => { setChartMode('day'); speak?.(describeChart(panelChart(records, 'day'))); }}
        style={[
          styles.chartToggleBtn,
          chartMode === 'day' && styles.chartToggleBtnActive,
        ]}
      >
        <Text
          style={[
            styles.chartToggleText,
            chartMode === 'day' && styles.chartToggleTextActive,
          ]}
        >
          Dia
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: chartMode === 'month' }}
        onPress={() => { setChartMode('month'); speak?.(describeChart(panelChart(records, 'month'))); }}
        style={[
          styles.chartToggleBtn,
          chartMode === 'month' && styles.chartToggleBtnActive,
        ]}
      >
        <Text
          style={[
            styles.chartToggleText,
            chartMode === 'month' && styles.chartToggleTextActive,
          ]}
        >
          Mês
        </Text>
      </Pressable>
    </View>
  </View>

  {/* Trend Summary */}
  <Animated.View style={[styles.trendSummary, entryStyles[0]]}>
    <Text style={styles.trendPeriod}>{chartData.periodTitle}</Text>
    <View style={styles.trendTotalBadge}>
      <Text style={styles.trendTotalText}>
        {`${chartData.sum} ${
          chartData.sum === 1 ? 'registro' : 'registros'
        } no gráfico`}
      </Text>
    </View>
  </Animated.View>

  {/* SVG Trend Graph */}
  <View style={styles.trendGraphContainer} accessible accessibilityRole="image" accessibilityLabel={describeChart(target)}>
    <Svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={styles.trendSvg}>
      <Defs>
        <SvgLinearGradient id="adminTrendGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#6824D6" stopOpacity={0.32} />
          <Stop offset="100%" stopColor="#6824D6" stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>

      {/* 4 Background horizontal grid lines */}
      {Array.from({ length: 4 }, (_, i) => {
        const y = padTop + (i * (svgHeight - padTop - padBottom)) / 3;
        return (
          <Line
            key={`gl-${i}`}
            x1={padX}
            y1={y.toFixed(2)}
            x2={svgWidth - padX}
            y2={y.toFixed(2)}
            stroke="#CEC1E8"
            strokeWidth={1}
            strokeOpacity={0.48}
          />
        );
      })}

      {/* Dotted Baseline */}
      <Line
        x1={padX}
        y1={baseline}
        x2={svgWidth - padX}
        y2={baseline}
        stroke="#EAE5F5"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />

      {/* Area Polygon */}
      <Polygon points={polygonPoints} fill="url(#adminTrendGradient)" />

      {/* Line Polyline */}
      <Polyline
        points={polylinePoints}
        fill="none"
        stroke="#6824D6"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Points circles */}
      {chartData.values.map((v, i) => {
        const isPeak = v === chartData.max && v > 0;
        return (
          <Circle
            key={`dot-${i}`}
            cx={xs[i].toFixed(2)}
            cy={ys[i].toFixed(2)}
            r={isPeak ? 5.8 : 4.5}
            fill="#FFFFFF"
            stroke={isPeak ? '#5316B8' : '#6824D6'}
            strokeWidth={2.8}
          />
        );
      })}
    </Svg>
  </View>

  {/* Labels & Values */}
  <View style={styles.trendLabels}>
    {chartData.buckets.map((bucket, i) => {
      const val = Math.round(values[i]);
      const isPeak = val > 0 && val === chartData.max;
      return (
        <Animated.View key={`pt-lbl-${bucket.key}`} style={[styles.trendPoint, entryStyles[i]]}>
          <View
            style={[
              styles.trendValueBadge,
              isPeak && styles.trendValueBadgePeak,
            ]}
          >
            <Text
              style={[
                styles.trendValueText,
                isPeak && styles.trendValueTextPeak,
              ]}
            >
              {val}
            </Text>
          </View>
          <Text style={styles.trendDateText}>{bucket.caption}</Text>
        </Animated.View>
      );
    })}
  </View>
  </>;
}

const styles = StyleSheet.create({
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
    marginBottom: 12,
  },
  headingTitle: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    includeFontPadding: false,
  },
  chartToggle: {
    flexShrink: 0,
    flexDirection: 'row',
    backgroundColor: '#F8F6FD',
    padding: 3,
    borderRadius: 9,
    gap: 2,
  },
  chartToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 7,
  },
  chartToggleBtnActive: {
    backgroundColor: '#6824D6',
  },
  chartToggleText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    includeFontPadding: false,
    color: '#796E92',
  },
  chartToggleTextActive: {
    color: '#FFFFFF',
  },
  trendSummary: {
    backgroundColor: '#F8F6FD',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 7,
  },
  trendPeriod: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5E5473',
  },
  trendTotalBadge: {
    backgroundColor: '#EDE7F8',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  trendTotalText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6824D6',
  },
  trendGraphContainer: {
    width: '100%',
    height: 122,
    overflow: 'visible',
    marginVertical: 4,
  },
  trendSvg: {
    width: '100%',
    height: '100%',
  },
  trendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  trendPoint: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  trendValueBadge: {
    backgroundColor: '#EDE7F8',
    borderRadius: 7,
    paddingVertical: 2,
    paddingHorizontal: 8,
    minWidth: 26,
    alignItems: 'center',
  },
  trendValueBadgePeak: {
    backgroundColor: '#6824D6',
  },
  trendValueText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6824D6',
  },
  trendValueTextPeak: {
    color: '#FFFFFF',
  },
  trendDateText: {
    fontSize: 9.5,
    fontWeight: '650',
    color: '#796E92',
  },
});
