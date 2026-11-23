import { useEffect, useRef, useState } from 'react';

interface AestheticClockCardProps {
  config: Record<string, unknown>;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}

const THAI_FULL_DATE = new Intl.DateTimeFormat('th-TH', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function getThaiGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'สวัสดีตอนเช้า ☀️';
  if (hour >= 12 && hour < 17) return 'สวัสดีตอนบ่าย 🌤️';
  if (hour >= 17 && hour < 21) return 'สวัสดีตอนเย็น 🌇';
  return 'ดึกแล้ว อย่าลืมพักผ่อนนะครับ 🌙';
}

export function AestheticClockCard({
  config,
  onUpdateConfig,
}: AestheticClockCardProps) {
  const initialQuote =
    typeof config.customQuote === 'string'
      ? config.customQuote
      : 'หายใจลึกๆ แล้วค่อยๆ ไปทีละก้าว';

  const [now, setNow] = useState(() => new Date());
  const [quote, setQuote] = useState(initialQuote);
  const lastSavedRef = useRef(initialQuote);
  const draftRef = useRef(quote);
  const onUpdateRef = useRef(onUpdateConfig);
  draftRef.current = quote;
  onUpdateRef.current = onUpdateConfig;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (initialQuote !== lastSavedRef.current) {
      lastSavedRef.current = initialQuote;
      setQuote(initialQuote);
    }
  }, [initialQuote]);

  useEffect(() => {
    return () => {
      if (draftRef.current !== lastSavedRef.current) {
        lastSavedRef.current = draftRef.current;
        onUpdateRef.current({ customQuote: draftRef.current });
      }
    };
  }, []);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const greeting = getThaiGreeting(now.getHours());
  const dateLabel = THAI_FULL_DATE.format(now);

  const commitQuote = () => {
    if (quote === lastSavedRef.current) return;
    lastSavedRef.current = quote;
    onUpdateConfig({ customQuote: quote });
  };

  return (
    <div className="glass-card widget-card clock-card">
      <div className="clock-top">
        <span className="clock-greeting">{greeting}</span>
        <span className="clock-date">{dateLabel}</span>
      </div>

      <div className="clock-digits" aria-label={`เวลาปัจจุบัน ${hours}:${minutes}`}>
        <span>{hours}</span>
        <span className="clock-colon">:</span>
        <span>{minutes}</span>
        <span className="clock-sec">{seconds}</span>
      </div>

      <input
        type="text"
        className="clock-quote-input"
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        onBlur={commitQuote}
        placeholder="เขียนข้อความให้กำลังใจตัวเอง..."
        maxLength={100}
        aria-label="ข้อความให้กำลังใจใต้เวลา"
      />
    </div>
  );
}
