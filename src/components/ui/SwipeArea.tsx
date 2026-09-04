'use client';

/**
 * 左右スワイプで「前へ / 次へ」を発火する領域
 *
 * ホームと履歴では月の移動に、取引フォームでは支出／収入の切り替えに使う。
 * 画面（またはフォーム）全体を包んで使うこと。
 *
 * 入れ子にすると1回の操作で2回動いてしまうので、1つの画面にこれを1つだけ置く。
 * （そのため MonthNav とカレンダーは、この中に入るときは自前のスワイプを持たない）
 *
 * touch-action は pan-y。none にすると縦スクロールまで止まる。
 */
import { motion } from 'framer-motion';

/** これ以上動かしたらスワイプとみなす距離(px) */
const SWIPE_THRESHOLD = 60;

interface SwipeAreaProps {
  /** false のときは何もせず子をそのまま描画する（デスクトップ用） */
  enabled?: boolean;
  /** 右へスワイプ（＝左のものへ戻る） */
  onPrevious: () => void;
  /** 左へスワイプ（＝右のものへ進む） */
  onNext: () => void;
  children: React.ReactNode;
}

export const SwipeArea: React.FC<SwipeAreaProps> = ({
  enabled = true,
  onPrevious,
  onNext,
  children,
}) => {
  if (!enabled) return <>{children}</>;

  return (
    <motion.div
      drag="x"
      // 縦に動かし始めたときは横ドラッグとして扱わない（スクロールを優先する）
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      dragMomentum={false}
      onDragEnd={(event, info) => {
        if (info.offset.x > SWIPE_THRESHOLD) onPrevious();
        else if (info.offset.x < -SWIPE_THRESHOLD) onNext();
      }}
      style={{ touchAction: 'pan-y' }}
    >
      {children}
    </motion.div>
  );
};
