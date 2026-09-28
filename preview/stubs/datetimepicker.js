import React from 'react';

const pad = (n) => String(n).padStart(2, '0');

export default function DateTimePicker({ value, maximumDate, onChange }) {
  const v = new Date(value);
  const max = maximumDate ? new Date(maximumDate) : null;
  return React.createElement('input', {
    type: 'date',
    value: `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`,
    max: max ? `${max.getFullYear()}-${pad(max.getMonth() + 1)}-${pad(max.getDate())}` : undefined,
    onChange: (e) => {
      const [y, m, d] = e.target.value.split('-').map(Number);
      if (y) onChange({ type: 'set' }, new Date(y, m - 1, d, 12));
    },
    style: { alignSelf: 'center', fontSize: 20, padding: 8, margin: '12px 0' },
  });
}
