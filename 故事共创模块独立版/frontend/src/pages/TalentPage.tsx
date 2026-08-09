import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import StoryReader from '../components/Gallery/StoryReader';
import Button from '../components/Shared/Button';
import Loading from '../components/Shared/Loading';
import Modal from '../components/Shared/Modal';
import PinyinText from '../components/Story/PinyinText';
import PngIcon from '../components/Shared/PngIcon';
import './TalentPage.css';

interface DimensionEvidence {
  turn_number: number;
  quote: string;
  analysis: string;
  turn_rating: number;
  max_turn_rating: number;
}

interface Dimension {
  key: string;
  label: string;
  score: number | null;
  max_score: number;
  score_reason?: string;
  evidence?: DimensionEvidence[];
  observation_status?: string;
  is_unscored?: boolean;
  is_imputed?: boolean;
}

interface ReportSection {
  score?: number;
  base_score?: number;
  progress_bonus?: number;
  final_score?: number;
  level: string;
  level_label: string;
  dimensions: Dimension[];
  is_valid?: boolean;
  invalid_reason?: string;
  confidence_score?: number;
  confidence_level?: string;
  score_status?: string;
  raw_ability_percent?: number;
  score_mapping?: string;
}

interface TalentProfile {
  story_id: number; story_title: string; total_turns: number;
  age_group: string; completed: boolean;
  language: ReportSection; empathy: ReportSection; imagination: ReportSection;
  growth_memory: { summary: string; };
  highlights: string[];
  total_words: number; avg_words_per_turn: number;
  strengths: string[]; suggestions: string[];
  measurability?: {
    is_measurable: boolean;
    effective_char_count: number;
    effective_turn_count: number;
    scorable_sentence_count: number;
    reasons: string[];
  };
}

function ScoreCard({ title, icon, section, language, onClick }: {
  title: string; icon: ReactNode; section: ReportSection; language?: boolean; onClick: () => void;
}) {
  const total = language ? section.final_score ?? 0 : section.score ?? 0;
  const invalid = section.is_valid === false;
  return (
    <button className={`talent-card-btn talent-card-${section.level} ${invalid ? 'talent-card-invalid' : ''}`} onClick={onClick}>
      <span className="talent-card-emoji">{icon}</span>
      <span className="talent-card-title">{title}</span>
      <span className="talent-card-score">
        <strong>{invalid ? '—' : total}</strong><small>{language ? '/115' : '/100'}</small>
      </span>
      <span className="talent-card-level">{section.level_label}</span>
      {section.confidence_score !== undefined && (
        <span className="talent-card-confidence">可信度 {section.confidence_score}%（{section.confidence_level}）</span>
      )}
      <span className="talent-card-hint">点击查看详细分析 →</span>
    </button>
  );
}

function DetailPanel({ title, section, language, onClose }: {
  title: string; section: ReportSection; language?: boolean; onClose: () => void;
}) {
  const [openDimension, setOpenDimension] = useState<string | null>(null);
  return (
    <div className="talent-detail">
      <div className="talent-detail-header">
        <h2>{title}</h2>
        <span className={`talent-detail-level talent-detail-${section.level}`}>{section.level_label}</span>
      </div>

      {language && (
        <div className="talent-detail-breakdown">
          <span>子维度原始表现 <b>{section.raw_ability_percent}/100</b></span>
          <span>→</span>
          <span>基础评分 <b>{section.base_score}</b></span>
          <span>+</span>
          <span>成长加分 <b>{section.progress_bonus}</b></span>
        </div>
      )}
      {!language && section.is_valid !== false && (
        <div className="talent-detail-breakdown">
          <span>子维度原始表现 <b>{section.raw_ability_percent}/100</b></span>
          <span>→</span>
          <span>二次映射 <b>{section.score}/100</b></span>
        </div>
      )}

      {section.is_valid === false && section.invalid_reason && (
        <p className="talent-invalid-notice">{section.invalid_reason}</p>
      )}
      {section.is_valid !== false && <div className="talent-detail-dims">
        {section.dimensions.map((dim) => (
          <div className={`talent-detail-dim ${openDimension === dim.key ? 'talent-detail-dim-open' : ''}`} key={dim.key}>
            <button
              type="button"
              className="talent-detail-dim-trigger"
              onClick={() => setOpenDimension((current) => current === dim.key ? null : dim.key)}
              aria-expanded={openDimension === dim.key}
            >
              <span className="talent-detail-dim-head">
                <span className="talent-detail-dim-label">{dim.label}</span>
                <b className="talent-detail-dim-score">
                  {dim.score === null ? '未观察' : `${dim.score}/${dim.max_score}`}
                </b>
              </span>
              <span className="talent-detail-track">
                <span style={{ width: `${dim.score === null ? 0 : Math.min(100, dim.score / dim.max_score * 100)}%` }} />
              </span>
              {dim.observation_status && <span className="talent-detail-status">{dim.observation_status}</span>}
              <span className="talent-detail-evidence-hint">
                {openDimension === dim.key ? '收起评分证据' : '查看评分证据'}
                <i aria-hidden="true">⌄</i>
              </span>
            </button>

            {openDimension === dim.key && (
              <div className="talent-detail-evidence">
                {dim.score_reason && <p className="talent-detail-reason">{dim.score_reason}</p>}
                {dim.evidence && dim.evidence.length > 0 && dim.evidence.map((item, index) => (
                  <article className="talent-evidence-item" key={`${item.turn_number}-${index}`}>
                    <div className="talent-evidence-meta">
                      <span>第 {item.turn_number} 次创作</span>
                      <span>本轮表现 {item.turn_rating}/{item.max_turn_rating}</span>
                    </div>
                    <blockquote>“{item.quote}”</blockquote>
                    <div className="talent-evidence-analysis">
                      <b>评分分析</b>
                      <p>{item.analysis}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>}

      <button className="talent-detail-close" onClick={onClose}>关闭</button>
    </div>
  );
}

export default function TalentPage({ parentView = false }: { parentView?: boolean }) {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStory, setShowStory] = useState(false);
  const [detail, setDetail] = useState<{ title: string; section: ReportSection; language?: boolean } | null>(null);
  const [kidsPanel, setKidsPanel] = useState<'strengths' | 'suggestions'>('strengths');

  useEffect(() => {
    if (!storyId) return;
    const endpoint = parentView
      ? `/talents/${storyId}?report_version=quality-gates-v1`
      : `/talents/${storyId}/feedback`;
    apiFetch<TalentProfile>(endpoint, {
      cache: 'no-store',
    })
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? err.message : '报告加载失败'))
      .finally(() => setLoading(false));
  }, [storyId, parentView]);

  if (loading) return <Loading text={parentView ? '正在生成家长报告...' : '正在整理你的创作回顾...'} />;
  if (error) return <div className="page talent-error">{error}</div>;
  if (!profile) return <div className="page talent-error">暂时没有可用的天赋数据</div>;

  return (
    <div className="page talent-page">
      <Button variant="ghost" size="sm" onClick={() => navigate(parentView ? '/story-create/parent' : '/story-create/gallery')} style={{ alignSelf: 'flex-start' }}>
        {parentView ? '返回家长故事书架' : '返回我的故事书架'}
      </Button>

      <header className="talent-hero">
        <h1>{profile.story_title}</h1>
        {parentView ? (
          <div className="talent-meta">
            <span>{profile.age_group} 岁通道</span>
            <span>{profile.total_turns} 次有效表达</span>
            <span>{profile.total_words} 字</span>
          </div>
        ) : <p className="talent-child-intro">太棒了！这是属于你的故事创作回顾。</p>}
      </header>

      {parentView && (
        <div className="talent-cards">
          <ScoreCard title="语言智能" icon={<PngIcon name="story-book" size={70} />} section={profile.language} language onClick={() => setDetail({ title: '语言智能', section: profile.language, language: true })} />
          <ScoreCard title="共情力（人际智能）" icon={<PngIcon name="safety-shield" size={70} />} section={profile.empathy} onClick={() => setDetail({ title: '共情力（人际智能）', section: profile.empathy })} />
          <ScoreCard title="想象力（空间智能）" icon={<PngIcon name="talent-brain" size={70} />} section={profile.imagination} onClick={() => setDetail({ title: '想象力（空间智能）', section: profile.imagination })} />
        </div>
      )}

      {!parentView && profile.highlights.length > 0 && (
        <section className="talent-card talent-kids-card talent-moments-card">
          <h2>精彩瞬间</h2>
          <div className="talent-quotes">
            {profile.highlights.map((quote, index) => (
              <blockquote key={index}>“<PinyinText text={quote} enabled />”</blockquote>
            ))}
          </div>
        </section>
      )}

      {!parentView && <section className="talent-kids-feedback">
        {profile.strengths.length > 0 ? (
          <>
            <div className="talent-kids-tabs" role="tablist" aria-label="选择查看的儿童反馈">
              <button
                type="button"
                role="tab"
                aria-selected={kidsPanel === 'strengths'}
                className={kidsPanel === 'strengths' ? 'active' : ''}
                onClick={() => setKidsPanel('strengths')}
              >
                我的亮点
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={kidsPanel === 'suggestions'}
                className={kidsPanel === 'suggestions' ? 'active' : ''}
                onClick={() => setKidsPanel('suggestions')}
              >
                下一步建议
              </button>
            </div>

            {kidsPanel === 'strengths' ? (
              <section className="talent-card talent-kids-card talent-strength-card" role="tabpanel">
                <h2>我的亮点</h2>
                <ul>{profile.strengths.map((item, index) => (
                  <li key={index}><PinyinText text={item} enabled /></li>
                ))}</ul>
              </section>
            ) : (
              <section className="talent-card talent-kids-card talent-challenge-card" role="tabpanel">
                <h2>下一步建议</h2>
                <ul>{profile.suggestions.map((item, index) => (
                  <li key={index}><PinyinText text={item} enabled /></li>
                ))}</ul>
              </section>
            )}
          </>
        ) : (
          <section className="talent-card talent-kids-card talent-challenge-card">
            <h2>下一步建议</h2>
            <ul>{profile.suggestions.map((item, index) => (
              <li key={index}><PinyinText text={item} enabled /></li>
            ))}</ul>
          </section>
        )}
      </section>}

      <div className="talent-actions">
        <Button variant="secondary" onClick={() => setShowStory(true)}>阅读完整故事</Button>
        {!parentView && (
          <Button variant="primary" onClick={() => navigate('/story-create/characters')}>继续创作</Button>
        )}
      </div>

      <Modal open={showStory} onClose={() => setShowStory(false)} title={profile.story_title}>
        <StoryReader storyId={profile.story_id} />
      </Modal>

      <Modal open={parentView && !!detail} onClose={() => setDetail(null)} title="">
        {detail && <DetailPanel title={detail.title} section={detail.section} language={detail.language} onClose={() => setDetail(null)} />}
      </Modal>
    </div>
  );
}
