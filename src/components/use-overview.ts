'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, post } from './client';
import type { Kind, Overview } from '@/lib/types';
export function useOverview() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<Overview>('overview')
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (e.status === 401) router.replace('/start');
        else if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [router]);
  async function begin(kind: Kind, skill?: string) {
    setBusy(true);
    setError('');
    try {
      const { id } = await post('sessions', { kind, skill });
      router.push('/session/' + id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return { data, error, busy, begin, router };
}
