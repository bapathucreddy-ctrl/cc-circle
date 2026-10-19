import type { AppearanceSelectProps } from './AppearanceSelect';

export function AppearanceSelect({ label, value, options, onChange, colors }: AppearanceSelectProps) {
  return <select aria-label={label} value={value} onChange={event => onChange(event.target.value)} style={{ minHeight: 44, minWidth: 160, maxWidth: '100%', padding: '0 10px', borderRadius: 12, border: `1px solid ${colors.line}`, backgroundColor: colors.panel, color: colors.text, fontSize: 12, cursor: 'pointer', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}
