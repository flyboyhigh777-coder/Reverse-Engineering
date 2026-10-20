import { bmiBand } from '../../domain/metrics';

/**
 * The BMI bands as a strip with a marker.
 *
 * BMI is a population measure: it says nothing about where the mass is, and
 * it reads high for muscular people. The card says so, because a number that
 * is presented without its limits is read as a verdict.
 */

const BANDS: readonly { readonly from: number; readonly to: number; readonly label: string; readonly color: string }[] = [
  { from: 15, to: 18.5, label: 'ниже', color: 'var(--p-fed)' },
  { from: 18.5, to: 25, label: 'норма', color: 'var(--accent)' },
  { from: 25, to: 30, label: 'избыток', color: 'var(--warm)' },
  { from: 30, to: 40, label: 'ожирение', color: 'var(--danger)' },
];

const MIN = 15;
const MAX = 40;

export function BmiBar({ value }: { value: number }): JSX.Element {
  const clamped = Math.min(MAX, Math.max(MIN, value));
  const left = ((clamped - MIN) / (MAX - MIN)) * 100;
  const band = bmiBand(value);

  return (
    <div className="col" style={{ gap: 7 }}>
      <div className="row between">
        <span className="num" style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 700 }}>
          {value.toFixed(1)}
        </span>
        <span className="pill">{band.label}</span>
      </div>

      <div style={{ position: 'relative', paddingTop: 10 }}>
        <div style={{ display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden' }}>
          {BANDS.map((item) => (
            <span
              key={item.label}
              style={{ flex: item.to - item.from, background: item.color }}
              title={`${item.from}–${item.to}`}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            left: `${left}%`,
            transform: 'translateX(-50%)',
            width: 4,
            height: 21,
            borderRadius: 3,
            background: 'var(--ink)',
            border: '2px solid var(--surface)',
          }}
        />
      </div>

      <div style={{ position: 'relative', height: 14 }}>
        {[18.5, 25, 30].map((edge) => (
          <span
            key={edge}
            className="tiny muted num"
            style={{
              position: 'absolute',
              left: `${((edge - MIN) / (MAX - MIN)) * 100}%`,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
            }}
          >
            {String(edge).replace('.', ',')}
          </span>
        ))}
      </div>

      <p className="tiny muted">
        ИМТ — показатель для групп людей, а не диагноз. Он не различает мышцы и жир и не говорит, где расположена масса,
        поэтому у тренирующихся он завышен. Окружность талии добавляет к нему больше, чем ещё один знак после запятой.
      </p>
    </div>
  );
}
