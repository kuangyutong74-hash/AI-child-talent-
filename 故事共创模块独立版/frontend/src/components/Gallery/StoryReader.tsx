import { useEffect, useState } from 'react';
import { getStoryMessages, type StoryMessage } from '../../api/endpoints';
import Loading from '../Shared/Loading';
import { useModalHeaderActions } from '../Shared/Modal';
import PinyinText from '../Story/PinyinText';
import './StoryReader.css';
import PngIcon from '../Shared/PngIcon';

interface StoryReaderProps {
  storyId: number;
}

export default function StoryReader({ storyId }: StoryReaderProps) {
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPinyin, setShowPinyin] = useState(false);
  const [fontSize, setFontSize] = useState<'s' | 'm' | 'l'>('m');
  const setModalHeaderActions = useModalHeaderActions();

  useEffect(() => {
    if (!setModalHeaderActions) return;
    setModalHeaderActions(
      <div className="reader-toolbar">
        <span className="reader-toolbar-label">字号</span>
        <div className="fontsize-toggle">
          <button className={`fs-btn ${fontSize==='s'?'fs-active':''}`} onClick={()=>setFontSize('s')}>小</button>
          <button className={`fs-btn ${fontSize==='m'?'fs-active':''}`} onClick={()=>setFontSize('m')}>中</button>
          <button className={`fs-btn ${fontSize==='l'?'fs-active':''}`} onClick={()=>setFontSize('l')}>大</button>
        </div>
        <span className="reader-toolbar-label">拼音</span>
        <button type="button" className={`reader-pinyin-toggle ${showPinyin?'active':''}`} onClick={()=>setShowPinyin(c=>!c)} aria-pressed={showPinyin}>{showPinyin?'关闭':'开启'}</button>
      </div>
    );
    return () => setModalHeaderActions(null);
  }, [fontSize, setModalHeaderActions, showPinyin]);

  useEffect(() => {
    setLoading(true);
    getStoryMessages(storyId)
      .then(setMessages)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [storyId]);

  if (loading) return <Loading text="加载故事中..." />;
  if (error) return <p className="reader-error">{error}</p>;

  return (
    <div className={`story-reader ${showPinyin ? 'story-reader-pinyin' : ''} reader-fs-${fontSize}`}>
      <div className="reader-message-list">
        {messages.map((msg) => (
            <div key={msg.id} className={`reader-message reader-message-${msg.role}`}>
              <div className="reader-role-icon">
                {msg.role === 'ai' ? <PngIcon name="story-director" size={34} /> : <PngIcon name="child-explorer" size={34} />}
              </div>
              <div className="reader-content">
                <p>
                  <PinyinText text={msg.content} enabled={showPinyin && msg.role === 'ai'} />
                </p>
              </div>
            </div>
        ))}
      </div>
    </div>
  );
}
