import type { CSSProperties, ImgHTMLAttributes } from 'react';

export type StoryPngIconName =
  | 'theme-random'
  | 'theme-space'
  | 'theme-forest'
  | 'theme-ocean'
  | 'theme-dinosaur'
  | 'theme-castle'
  | 'theme-hero'
  | 'action-write'
  | 'story-book'
  | 'talent-brain'
  | 'action-delete'
  | 'action-microphone'
  | 'safety-shield'
  | 'story-director'
  | 'celebration'
  | 'child-explorer'
  | 'avatar-astronaut'
  | 'avatar-dragon'
  | 'avatar-fairy'
  | 'avatar-pirate'
  | 'avatar-robot'
  | 'avatar-explorer'
  | 'avatar-wizard'
  | 'avatar-mermaid';

interface PngIconProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  name: StoryPngIconName;
  size?: number;
}

export default function PngIcon({ name, size = 28, alt = '', style, ...props }: PngIconProps) {
  const imageStyle: CSSProperties = {
    width: size,
    height: size,
    objectFit: 'contain',
    flex: '0 0 auto',
    ...style,
  };

  return (
    <img
      src={`/story-create/icons/${name}.png`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      loading="lazy"
      style={imageStyle}
      {...props}
    />
  );
}
