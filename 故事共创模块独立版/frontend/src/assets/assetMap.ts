/**
 * SVG Asset Map — Story Co-Create
 *
 * 使用方法：
 * 1. 把下载的 SVG 文件放到 public/assets/ 对应目录下
 * 2. 修改下方文件名即可全局生效
 *
 * 目录结构：
 *   public/assets/
 *   ├── avatars/      → 角色头像
 *   ├── icons/        → 小图标
 *   └── illustrations/ → 页面大插画
 */

export const ASSETS = {
  /* ── 角色头像 (48x48 ~ 64x64) ── */
  avatars: {
    /** 故事导演 — 聊天/打字指示器中的AI头像 */
    director:   '/assets/avatars/director.svg',
    /** 孩子探险家 — 聊天中的孩子头像 */
    child:      '/assets/avatars/child.svg',
    /** 故事精灵 — 悬浮小精灵（已有内置SVG，可选替换） */
    fairy:      '/assets/avatars/fairy.svg',
  },

  /* ── 小图标 (24x24 ~ 32x32) ── */
  icons: {
    star:       '/assets/icons/star.svg',
    book:       '/assets/icons/book.svg',
    sparkle:    '/assets/icons/sparkle.svg',
    castle:     '/assets/icons/castle.svg',
    wand:       '/assets/icons/wand.svg',
    rocket:     '/assets/icons/rocket.svg',
    heart:      '/assets/icons/heart.svg',
    crown:      '/assets/icons/crown.svg',
    music:      '/assets/icons/music.svg',
    shield:     '/assets/icons/shield.svg',
    quill:      '/assets/icons/quill.svg',
  },

  /* ── 页面插画 (200x160 ~ 400x400) ── */
  illustrations: {
    /** 首页 — 故事门户场景 */
    portal:       '/assets/illustrations/portal.svg',
    /** 画廊 — 空书架（没有故事时） */
    emptyGallery:  '/assets/illustrations/empty-gallery.svg',
    /** 角色 — 没有角色时 */
    emptyCharacters: '/assets/illustrations/empty-characters.svg',
    /** 登录页 — 星空背景 */
    stars:        '/assets/illustrations/stars.svg',
  },
} as const;
