import './Loading.css';

interface LoadingProps {
  text?: string;
}

export default function Loading({ text = '加载中...' }: LoadingProps) {
  return (
    <div className="loading-container">
      <div className="loading-spinner">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <p className="loading-text">{text}</p>
    </div>
  );
}
