import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settleWrite } from '@/data/pendingWrite';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('settleWrite（#126: オフラインで保存が終わらない問題）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('オンラインでサーバーが受け取れば saved', async () => {
    const write = deferred();
    const result = settleWrite(write.promise, { isOnline: () => true });
    write.resolve();
    await expect(result).resolves.toBe('saved');
  });

  it('オンラインで失敗すればそのままエラー', async () => {
    const write = deferred();
    const result = settleWrite(write.promise, { isOnline: () => true });
    write.reject(new Error('permission-denied'));
    await expect(result).rejects.toThrow('permission-denied');
  });

  it('オフラインならサーバーを待たずに queued', async () => {
    const write = deferred();
    await expect(settleWrite(write.promise, { isOnline: () => false })).resolves.toBe('queued');
  });

  it('オンラインでも返事が無ければ一定時間で queued', async () => {
    const write = deferred();
    const result = settleWrite(write.promise, { isOnline: () => true, timeoutMs: 4000 });
    await vi.advanceTimersByTimeAsync(3999);
    let done = false;
    void result.then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('queued');
  });

  it('queued の後に失敗したら onLateError で知らせる', async () => {
    const write = deferred();
    const onLateError = vi.fn();
    await expect(settleWrite(write.promise, { isOnline: () => false, onLateError })).resolves.toBe('queued');
    write.reject(new Error('permission-denied'));
    await Promise.resolve();
    await Promise.resolve();
    expect(onLateError).toHaveBeenCalledWith(expect.objectContaining({ message: 'permission-denied' }));
  });

  it('queued の後に成功しても何もしない', async () => {
    const write = deferred();
    const onLateError = vi.fn();
    await settleWrite(write.promise, { isOnline: () => false, onLateError });
    write.resolve();
    await Promise.resolve();
    expect(onLateError).not.toHaveBeenCalled();
  });
});
