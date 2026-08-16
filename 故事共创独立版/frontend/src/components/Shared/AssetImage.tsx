/**
 * AssetImage — 统一的SVG素材展示组件
 *
 * 特性：
 * - 如果SVG文件存在 → 显示SVG
 * - 如果SVG文件不存在 → 显示fallback占位符
 * - 支持 width/height/className 自定义
 */

import { type ImgHTMLAttributes, useState } from 'react';

interface AssetImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** 素材路径，如 '/assets/avatars/director.svg' */
  src: string;
  /** 加载失败时的占位文字/emoji */
  fallback?: string;
  /** 占位背景色 */
  fallbackBg?: string;
}

export default function AssetImage({
  src,
  fallback = '?',
  fallbackBg = '#F0EDF8',
  alt = '',
  width = 48,
  height = 48,
  style,
  className,
  ...imgProps
}: AssetImageProps) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width,
          height,
          borderRadius: '50%',
          background: fallbackBg,
          color: '#9B8FD4',
          fontSize: typeof width === 'number' ? Math.max(width * 0.4, 12) : 16,
          fontWeight: 700,
          ...style,
        }}
        aria-label={alt}
      >
        {fallback}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ display: 'block', ...style }}
      onError={() => setError(true)}
      {...imgProps}
    />
  );
}
