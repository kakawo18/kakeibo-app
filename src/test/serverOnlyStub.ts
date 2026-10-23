// Vitest では 'server-only' を空のモジュールに置き換える（vitest.config.ts の alias）。
// 本物は React Server Components の外で読み込まれると例外を投げるため、テストから読めない。
export {};
