/**
 * claude-connect 機能の公開窓口（Claude 連携の同意画面。docs/claude-connector/仕様書.md 5.5）
 *
 * 機能の外（app や他の機能）からはここだけを import する。中のファイルを直接参照しない。
 */
export { ConsentError, ConsentScreen } from './ConsentScreen';
export { ClaudeConnectionSection } from './ClaudeConnectionSection';
