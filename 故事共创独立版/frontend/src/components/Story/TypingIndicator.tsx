import PngIcon from '../Shared/PngIcon';
import './TypingIndicator.css';

export default function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <div className="typing-avatar"><PngIcon name="story-director" size={44} /></div>
      <div className="typing-bubble">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-text">故事导演正在创作...</span>
    </div>
  );
}
