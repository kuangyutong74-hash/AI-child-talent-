import { pinyin } from 'pinyin-pro';

interface PinyinTextProps {
  text: string;
  enabled: boolean;
}

export default function PinyinText({ text, enabled }: PinyinTextProps) {
  if (!enabled || !text) return <>{text}</>;

  return (
    <>
      {Array.from(text).map((character, index) => {
        if (!/[\u3400-\u9fff]/.test(character)) {
          return <span key={index}>{character}</span>;
        }
        const pronunciation = pinyin(character);
        return (
          <ruby key={index}>
            {character}
            <rt>{pronunciation}</rt>
          </ruby>
        );
      })}
    </>
  );
}
