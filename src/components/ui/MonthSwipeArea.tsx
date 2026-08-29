'use client';

/**
 * 左右スワイプで月を移動する領域
 *
 * 画面全体を包んで使う。1つの画面に複数のスワイプ領域を入れ子にすると
 * 1回の操作で2回month が動くので、ページごとにこれを1つだけ置くこと。
 * （そのため MonthNav とカレンダーは、この中に入るときは自前のスワイプを持たない）
 *
 * touch-action は pan-y。none にすると縦スクロールまで止まる。
 */
import { motion } from 'framer-motion';

/** これ以上動かしたら月替わりとみなす距離(px) */
const SWIPE_THRESHOLD = 60;

interface MonthSwipeAreaProps {
  /** false のときは何もせず子をそのまま描画する（デスクトップ用） */
  enabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  children: React.ReactNode;
}

export const MonthSwipeArea: React.FC<MonthSwipeAreaProps> = ({
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
