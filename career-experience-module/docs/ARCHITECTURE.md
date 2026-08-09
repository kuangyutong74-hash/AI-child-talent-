# 模块分层说明

## 1. 表现层

`backend/templates/` 负责页面骨架，`backend/static/` 负责 CSS、JavaScript 与职业素材。前端只负责展示职业场景、提交用户行为和渲染接口返回的报告，不在页面中直接判断能力强弱。

## 2. 应用与服务层

`backend/main.py` 负责 FastAPI 路由、会话生命周期、页面渲染和请求组织；`backend/auth.py` 负责用户身份与会话认证；`backend/models.py` 负责数据库实体定义。

## 3. 领域规则层

`backend/career_data.py` 统一配置职业、情境、选项、任务主张和可观察维度；`backend/services.py` 统一处理 ECD 证据强度、年龄发展规则、异常检测、内容保护和报告汇总。

这种划分的重点是让“职业内容”“评价规则”和“页面交互”相互独立。新增职业时优先扩展职业配置；调整报告规则时优先修改服务层；页面视觉调整不应改变证据判断逻辑。
