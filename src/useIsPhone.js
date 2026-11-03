import { useState, useEffect } from 'react';

const QUERY = '(max-width: 639px)';

export function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const handler = (e) => setIsPhone(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isPhone;
}
