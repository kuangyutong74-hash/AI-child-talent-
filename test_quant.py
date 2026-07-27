"""
🐬 蔚蓝深海基地 · 量化评分快速验证脚本
只测 quant-report API（纯客观，零AI依赖，毫秒级返回）
"""
import requests, json, time

PY = 'http://localhost:8005/api/assessment'

# ==================== 标准测试数据 ====================
L1_P = {'block_drag_count':8,'species_placement_attempts':8,'block_gravity_fall_failures':0,
    'check_attempts':1,'removal_count':0,'successful_pairs':4,
    'pair_details':[{'done':True}]*4,'check_history':[{'all_done':True,'pairs':[{'done':True}]*4}],
    'meaningless_clicks':0,'blank_clicks':0,'random_drags':0,'invalid_drops':0,'total_operations':8}

L1_A = {'block_drag_count':14,'species_placement_attempts':14,'block_gravity_fall_failures':5,
    'check_attempts':3,'removal_count':3,'successful_pairs':4,
    'pair_details':[{'done':True}]*4,
    'check_history':[{'all_done':False,'pairs':[{'done':True},{'done':False},{'done':True},{'done':False}]},
                     {'all_done':False,'pairs':[{'done':True},{'done':True},{'done':True},{'done':False}]},
                     {'all_done':True,'pairs':[{'done':True}]*4}],
    'meaningless_clicks':5,'blank_clicks':3,'random_drags':2,'invalid_drops':4,'total_operations':28}

L1_B = {'block_drag_count':20,'species_placement_attempts':20,'block_gravity_fall_failures':8,
    'check_attempts':4,'removal_count':6,'successful_pairs':2,
    'pair_details':[{'done':True},{'done':True},{'done':False},{'done':False}],
    'meaningless_clicks':20,'blank_clicks':10,'random_drags':20,'invalid_drops':10,'total_operations':60}

L1_W = {'block_drag_count':30,'species_placement_attempts':30,'block_gravity_fall_failures':15,
    'check_attempts':7,'removal_count':10,'successful_pairs':0,
    'pair_details':[{'done':False}]*4,'check_history':[],
    'meaningless_clicks':40,'blank_clicks':20,'random_drags':30,'invalid_drops':20,'total_operations':100}

L1_E = {}
L1_X = {'meaningless_clicks':20,'blank_clicks':10,'total_operations':30,
        'block_drag_count':30}

L2_P = {'block_drag_count':16,'species_placement_attempts':21,'block_gravity_fall_failures':5,
    'check_attempts':0,'removal_count':0,'successful_pairs':1,
    'pipe_count':16,'rotate_count':5,'grid_rows':8,'grid_cols':10,
    'meaningless_clicks':0,'blank_clicks':0,'random_drags':0,'invalid_drops':0,'total_operations':21}

L2_A = {'block_drag_count':22,'species_placement_attempts':34,'block_gravity_fall_failures':12,
    'check_attempts':0,'removal_count':0,'successful_pairs':1,
    'pipe_count':22,'rotate_count':12,'grid_rows':8,'grid_cols':10,
    'meaningless_clicks':5,'blank_clicks':3,'random_drags':2,'invalid_drops':5,'total_operations':34}

L2_F = {'block_drag_count':28,'species_placement_attempts':48,'block_gravity_fall_failures':20,
    'check_attempts':0,'removal_count':0,'successful_pairs':0,
    'pipe_count':28,'rotate_count':20,'grid_rows':8,'grid_cols':10,
    'meaningless_clicks':30,'blank_clicks':10,'random_drags':15,'invalid_drops':10,'total_operations':65}

L2_W = {'block_drag_count':35,'species_placement_attempts':65,'block_gravity_fall_failures':30,
    'check_attempts':0,'removal_count':0,'successful_pairs':0,
    'pipe_count':35,'rotate_count':30,'grid_rows':8,'grid_cols':10,
    'meaningless_clicks':50,'blank_clicks':20,'random_drags':30,'invalid_drops':20,'total_operations':100}

L2_E = {}

L3_P = {'harmony_final':100,'rounds_used':3,'emotion_correct':2,'evidence_correct':2,
    'needs_correct':4,'solution_quality':3,'successful_pairs':1,'total_operations':20}

L3_A = {'harmony_final':80,'rounds_used':3,'emotion_correct':1,'evidence_correct':1,
    'needs_correct':3,'solution_quality':2,'successful_pairs':1,'total_operations':18}

L3_B = {'harmony_final':30,'rounds_used':2,'emotion_correct':0,'evidence_correct':0,
    'needs_correct':1,'solution_quality':0,'successful_pairs':0,'total_operations':10}

L3_E = {}
L3_X = {'harmony_final':0,'rounds_used':0,'successful_pairs':0,'total_operations':0}

# ==================== 17个测试用例 ====================
cases = [
    ('小优-学霸型', '8', 0, 90, L1_P, 150, L2_P, 180, L3_P, ['P0','高分']),
    ('小茫-迷糊型', '8', 0, 240, L1_A, 320, L2_A, 280, L3_A, ['P0','中等']),
    ('小躁-冲动型', '7', 2, 180, L1_B, 250, L2_F, 120, L3_B, ['P0','低分']),
    ('小佛-佛系型', '9', 0, 350, L1_P, 420, L2_P, 300, L3_P, ['P0','慢但准']),
    ('小皮-捣蛋型', '6', 3, 150, L1_W, 200, L2_W, 90, L3_B, ['P0','捣蛋']),
    ('小飞-跳关型', '10', 3, 0, L1_E, 0, L2_E, 0, L3_E, ['跳关']),
    ('BC-超快通关', '8', 0, 30, L1_P, 45, L2_P, 60, L3_P, ['边界']),
    ('BC-极限慢', '8', 0, 7200, L1_P, 3600, L2_P, 1800, L3_P, ['边界']),
    ('BC-极限无效', '8', 0, 120, L1_X, 0, L2_E, 0, L3_E, ['边界']),
    ('BC-和解度0', '8', 0, 100, L1_P, 160, L2_P, 60, L3_X, ['边界']),
    ('BC-最小数据', '8', 0, 30, L1_X, 0, L2_E, 0, L3_E, ['边界']),
    ('BC-极端操作', '8', 0, 600, L1_W, 500, L2_W, 200, L3_X, ['边界']),
    ('EC-半完成跳', '8', 1, 180, L1_B, 0, L2_E, 0, L3_E, ['异常']),
    ('EC-全跳关', '8', 3, 0, L1_E, 0, L2_E, 0, L3_E, ['异常']),
    ('EC-字段缺失', '8', 0, 200, {'block_drag_count':10,'successful_pairs':3,'total_operations':10}, 0, L2_E, 0, L3_E, ['异常']),
    ('D-小优x6岁', '6', 0, 90, L1_P, 150, L2_P, 180, L3_P, ['常模']),
    ('D-小优x10岁', '10', 0, 90, L1_P, 150, L2_P, 180, L3_P, ['常模']),
]

# ==================== 执行 ====================
print('='*100)
print('量化评分测试结果')
print('='*100)
print(f'{"测试用例":<12} {"综合":>5} {"等级":>6} {"S1":>4} {"S2":>4} {"S3":>4} {"标签"}')
print('-'*100)

results = []
for name, age, skip, l1d, l1, l2d, l2, l3d, l3, tags in cases:
    try:
        r = requests.post(f'{PY}/quantitative-report', json={
            'student_id':'stu','age':age,'total_skip_count':skip,
            'level1_metrics':{**l1, 'duration_seconds':l1d},
            'level2_metrics':{**l2, 'duration_seconds':l2d},
            'level3_metrics':{**l3, 'duration_seconds':l3d},
        }, timeout=5)
        d = r.json().get('data',{})
        s = d.get('scores',{})
        sc = d.get('comprehensive_score','?')
        lv = d.get('level','?')
        s1 = s.get('S1_logical_spatial','?')
        s2 = s.get('S2_focus_self_control','?')
        s3 = s.get('S3_persistence','?')
        print(f'{name:<12} {str(sc):>5} {lv:>6} {str(s1):>4} {str(s2):>4} {str(s3):>4} {" ".join(tags)}')
        results.append({'name':name,'comp':sc,'S1':s1,'S2':s2,'S3':s3,'age':age})
    except Exception as e:
        print(f'{name:<12} ERROR: {str(e)[:50]}')
    time.sleep(0.05)

print('='*100)

# ==================== 分化性分析 ====================
print('\n' + '='*60)
print('分化性验证分析')
print('='*60)

def g(n,k):
    r = [x for x in results if x['name']==n]
    return r[0].get(k,0) if r else 0

def fval(v):
    try: return float(v)
    except: return 0.0

pairs = [
    ('小优-学霸型','小茫-迷糊型','总分分化'),
    ('小优-学霸型','小躁-冲动型','S2专注分化'),
    ('小优-学霸型','小飞-跳关型','S3坚持分化'),
    ('小茫-迷糊型','小佛-佛系型','同分不同维'),
    ('小皮-捣蛋型','小飞-跳关型','低分组分化'),
]
for a,b,desc in pairs:
    ca, cb = fval(g(a,'comp')), fval(g(b,'comp'))
    s2a, s2b = fval(g(a,'S2')), fval(g(b,'S2'))
    s3a, s3b = fval(g(a,'S3')), fval(g(b,'S3'))
    diff = abs(ca-cb)
    ok = 'OK' if diff>=1.0 else ('~' if diff>=0.5 else '!!')
    print(f'  [{ok}] {a} vs {b} (diff={diff:.1f})')
    print(f'       综合={ca:.1f}/{cb:.1f} | S2={s2a:.0f}/{s2b:.0f} | S3={s3a:.0f}/{s3b:.0f}')
    if desc == '同分不同维':
        # 小茫S1与小佛S1应不同
        s1a = fval(g(a,'S1'))
        s1b = fval(g(b,'S1'))
        print(f'       -> S1={s1a:.0f}/{s1b:.0f} (小茫S1应更低,小佛S1应高)')

# ==================== 年龄常模 ====================
print('\n' + '='*60)
print('年龄常模分析')
print('='*60)
for n in ['D-小优x6岁','小优-学霸型','D-小优x10岁']:
    v = g(n,'comp')
    print(f'  {n}: {v}分')
u6,u8,u10 = g('D-小优x6岁','comp'),g('小优-学霸型','comp'),g('D-小优x10岁','comp')
trend_ok = u6 >= u8 >= u10
print(f'  趋势: 6岁={u6}  8岁={u8}  10岁={u10}')
print(f'  结论: {"年龄调节正常" if trend_ok else "年龄调节异常"}')

# ==================== 统计 ====================
print('\n' + '='*60)
scores = [fval(x['comp']) for x in results]
print(f'  测试总数: {len(cases)}')
print(f'  分数范围: {min(scores):.1f} ~ {max(scores):.1f}')
print(f'  平均分: {sum(scores)/len(scores):.1f}')
print(f'  OK')
print('='*60)
