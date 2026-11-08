import React from 'react';
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export default function DateTimePicker({ value, maximumDate, minimumDate, onChange }) {
  return React.createElement('input', {
    type: 'date', value: iso(new Date(value)),
    max: maximumDate ? iso(new Date(maximumDate)) : undefined, min: minimumDate ? iso(new Date(minimumDate)) : undefined,
    onChange: e => { const [y, m, d] = e.target.value.split('-').map(Number); if (y) onChange?.({ type: 'set' }, new Date(y, m - 1, d, 12)); },
    style: { alignSelf: 'center', fontSize: 20, padding: 8, margin: '12px 0' },
  });
}
