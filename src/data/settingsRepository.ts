/**
 * ユーザー設定（users/{uid}/settings/app）の読み書き（#122）
 *
 * 考え方は transactionRepository.ts と同じ。書き込みは Firestore の Promise をそのまま返す。
 */
import {
  Firestore,
  Unsubscribe,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { UserSettings } from '@/types';
import {
  SettingsPatch,
  deserializeSettings,
  serializeSettings,
  toSettingsPatchData,
} from '@/data/settingsSerializer';
import { buildGenericDefaultSettings, buildLegacySettings } from '@/config/defaultSettings';
import { SubscriptionHandlers } from '@/data/transactionRepository';

const settingsDocRef = (db: Firestore, uid: string) => doc(db, 'users', uid, 'settings', 'app');

/** 設定を購読する。ドキュメントがまだ無ければ onChange(null) */
export const subscribeSettings = (
  db: Firestore,
  uid: string,
  { onChange, onError }: SubscriptionHandlers<UserSettings | null>
): Unsubscribe =>
  onSnapshot(
    settingsDocRef(db, uid),
    (snapshot) => onChange(snapshot.exists() ? deserializeSettings(snapshot.data()) : null),
    onError
  );

/**
 * 設定ドキュメントが無ければ初期設定を作る
 *
 * - 取引を持つ既存ユーザー → 旧ハードコード値（レガシー設定）
 * - 新規ユーザー → 汎用デフォルト設定
 *
 * 複数タブが同時に開いても二重に作らないよう、トランザクションの中で
 * 「まだ無いときだけ」書く。サーバーでの確認が要るので、オフラインでは失敗する。
 */
export const seedSettingsIfMissing = async (db: Firestore, uid: string): Promise<void> => {
  const transactions = await getDocs(
    query(collection(db, 'transactions'), where('userId', '==', uid), limit(1))
  );
  const seed = transactions.empty ? buildGenericDefaultSettings() : buildLegacySettings();
  const ref = settingsDocRef(db, uid);
  await runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists()) tx.set(ref, serializeSettings(seed));
  });
};

/**
 * 渡した項目だけを書く（#104）
 *
 * 手元の設定全体を書き戻すと、まだ届いていない他端末の変更を古い値で上書きしてしまう。
 */
export const patchSettings = (
  db: Firestore,
  uid: string,
  patch: SettingsPatch,
  now: Date = new Date()
): Promise<void> => updateDoc(settingsDocRef(db, uid), toSettingsPatchData(patch, now));
