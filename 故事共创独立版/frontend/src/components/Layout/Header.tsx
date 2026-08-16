import { Link, useNavigate } from 'react-router-dom';
import { useChannel } from '../../contexts/ChannelContext';
import './Header.css';
import PngIcon from '../Shared/PngIcon';

export default function Header() {
  const { ageGroup } = useChannel();
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div className="header-brand">
        <Link to="/story-create" className="header-logo">
          <span className="logo-icon"><PngIcon name="story-book" size={40} /></span>
          <svg className="logo-star logo-star-1" viewBox="0 0 18 18"><polygon points="9,1 10.5,6 16,6 11.5,9.5 13,15 9,11.5 5,15 6.5,9.5 2,6 7.5,6" fill="#FFD166" /></svg>
          <svg className="logo-star logo-star-2" viewBox="0 0 12 12"><polygon points="6,1 7,4.5 10.5,4.5 7.5,6.5 8.5,10.5 6,8 3.5,10.5 4.5,6.5 1.5,4.5 5,4.5" fill="#FFB3D0" /></svg>
          <span className="logo-text">AI 伯乐</span>
        </Link>
      </div>
      <div className="header-user">
        {ageGroup && (
          <button
            className="header-platform"
            onClick={() => navigate('/story-create/channel')}
            title="点击切换年龄段通道"
          >
            <PngIcon name="child-explorer" size={24} />
            {ageGroup === '4-7' ? '4-7 岁 · 幼儿通道' : '8-12 岁 · 学龄通道'}
          </button>
        )}
      </div>
    </header>
  );
}
