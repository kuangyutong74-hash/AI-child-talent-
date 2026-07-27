"""
🐬 蔚蓝深海基地 · 全面数据测试脚本 v2（精简版）
直接调用 Python 量化评分 + 6维评估 API，无前端依赖
"""
import requests, json, sys, time
from datetime import datetime

NODE_API = "http://localhost:3000/api/assessment"
PYTHON_API = "http://localhost:8004/api/assessment"

# ======================= 测试数据 =======================

L1_PERFECT = {
    "block_drag_count": 8, "species_placement_attempts": 8,
    "block_gravity_fall_failures": 0, "check_attempts": 1,
    "removal_count": 0, "total_errors": 0, "successful_pairs": 4,
    "pair_details": [{"id":"p1","done":True},{"id":"p2","done":True},{"id":"p3","done":True},{"id":"p4","done":True}],
    "check_history": [{"all_done":True,"pairs":[{"id":"p1","done":True},{"id":"p2","done":True},{"id":"p3","done":True},{"id":"p4","done":True}]}],
    "meaningless_clicks": 0, "blank_clicks": 0, "random_drags": 0, "invalid_drops": 0, "total_operations": 8,
}

L1_AVERAGE = {
    "block_drag_count": 14, "species_placement_attempts": 14,
    "block_gravity_fall_failures": 5, "check_attempts": 3,
    "removal_count": 3, "total_errors": 0, "successful_pairs": 4,
    "pair_details": [{"id":"p1","done":True},{"id":"p2","done":True},{"id":"p3","done":True},{"id":"p4","done":True}],
    "check_history": [
        {"all_done":False,"pairs":[{"id":"p1","done":True},{"id":"p2","done":False},{"id":"p3","done":True},{"id":"p4","done":False}]},
        {"all_done":False,"pairs":[{"id":"p1","done":True},{"id":"p2","done":True},{"id":"p3","done":True},{"id":"p4","done":False}]},
        {"all_done":True,"pairs":[{"id":"p1","done":True},{"id":"p2","done":True},{"id":"p3","done":True},{"id":"p4","done":True}]},
    ],
    "meaningless_clicks": 5, "blank_clicks": 3, "random_drags": 2, "invalid_drops": 4, "total_operations": 28,
}

L1_BAD = {
    "block_drag_count": 20, "species_placement_attempts": 20,
    "block_gravity_fall_failures": 8, "check_attempts": 4,
    "removal_count": 6, "total_errors": 2, "successful_pairs": 2,
    "pair_details": [{"id":"p1","done":True},{"id":"p2","done":True},{"id":"p3","done":False},{"id":"p4","done":False}],
    "check_history": [
        {"all_done":False,"pairs":[{"id":"p1","done":True},{"id":"p2","done":False},{"id":"p3","done":False},{"id":"p4","done":False}]},
        {"all_done":False,"pairs":[{"id":"p1","done":True},{"id":"p2","done":True},{"id":"p3","done":False},{"id":"p4","done":False}]},
        {"all_done":False,"pairs":[{"id":"p1","done":True},{"id":"p2","done":True},{"id":"p3","done":False},{"id":"p4","done":False}]},
        {"all_done":False,"pairs":[{"id":"p1","done":True},{"id":"p2","done":True},{"id":"p3","done":False},{"id":"p4","done":False}]},
    ],
    "meaningless_clicks": 20, "blank_clicks": 10, "random_drags": 20, "invalid_drops": 10, "total_operations": 60,
}

L1_WILD = {
    "block_drag_count": 30, "species_placement_attempts": 30,
    "block_gravity_fall_failures": 15, "check_attempts": 7,
    "removal_count": 10, "total_errors": 4, "successful_pairs": 0,
    "pair_details": [{"id":"p1","done":False},{"id":"p2","done":False},{"id":"p3","done":False},{"id":"p4","done":False}],
    "check_history": [],
    "meaningless_clicks": 40, "blank_clicks": 20, "random_drags": 30, "invalid_drops": 20, "total_operations": 100,
}

L1_EMPTY = {}

L2_PERFECT = {
    "block_drag_count": 16, "species_placement_attempts": 21,
    "block_gravity_fall_failures": 5, "check_attempts": 0, "removal_count": 0,
    "total_errors": 0, "successful_pairs": 1,
    "pipe_count": 16, "rotate_count": 5, "grid_rows": 8, "grid_cols": 10,
    "meaningless_clicks": 0, "blank_clicks": 0, "random_drags": 0, "invalid_drops": 0, "total_operations": 21,
}

L2_AVERAGE = {
    "block_drag_count": 22, "species_placement_attempts": 34,
    "block_gravity_fall_failures": 12, "check_attempts": 0, "removal_count": 0,
    "total_errors": 0, "successful_pairs": 1,
    "pipe_count": 22, "rotate_count": 12, "grid_rows": 8, "grid_cols": 10,
    "meaningless_clicks": 5, "blank_clicks": 3, "random_drags": 2, "invalid_drops": 5, "total_operations": 34,
}

L2_FAILED = {
    "block_drag_count": 28, "species_placement_attempts": 48,
    "block_gravity_fall_failures": 20, "check_attempts": 0, "removal_count": 0,
    "total_errors": 0, "successful_pairs": 0,
    "pipe_count": 28, "rotate_count": 20, "grid_rows": 8, "grid_cols": 10,
    "meaningless_clicks": 30, "blank_clicks": 10, "random_drags": 15, "invalid_drops": 10, "total_operations": 65,
}

L2_WILD = {
    "block_drag_count": 35, "species_placement_attempts": 65,
    "block_gravity_fall_failures": 30, "check_attempts": 0, "removal_count": 0,
    "total_errors": 0, "successful_pairs": 0,
    "pipe_count": 35, "rotate_count": 30, "grid_rows": 8, "grid_cols": 10,
    "meaningless_clicks": 50, "blank_clicks": 20, "random_drags": 30, "invalid_drops": 20, "total_operations": 100,
}

L2_EMPTY = {}

L3_PERFECT = {
    "harmony_final": 100, "rounds_used": 3,
    "emotion_correct": 2, "evidence_correct": 2,
    "emotion_attempts": 2, "evidence_attempts": 2,
    "needs_correct": 4, "needs_attempts": 4,
    "solution_quality": 3, "solution_attempts": 1,
    "total_errors": 0, "successful_pairs": 1,
    "block_drag_count": 15, "species_placement_attempts": 3,
    "card_selected": "time", "sentence_blocks_used": 8,
}

L3_AVERAGE = {
    "harmony_final": 80, "rounds_used": 3,
    "emotion_correct": 1, "evidence_correct": 1,
    "emotion_attempts": 3, "evidence_attempts": 3,
    "needs_correct": 3, "needs_attempts": 4,
    "solution_quality": 2, "solution_attempts": 2,
    "total_errors": 1, "successful_pairs": 1,
    "block_drag_count": 12, "species_placement_attempts": 3,
    "card_selected": "time", "sentence_blocks_used": 6,
}

L3_BAD = {
    "harmony_final": 30, "rounds_used": 2,
    "emotion_correct": 0, "evidence_correct": 0,
    "emotion_attempts": 4, "evidence_attempts": 3,
    "needs_correct": 1, "needs_attempts": 2,
    "solution_quality": 0, "solution_attempts": 1,
    "total_errors": 3, "successful_pairs": 0,
    "block_drag_count": 5, "species_placement_attempts": 2,
    "card_selected": "unfair", "sentence_blocks_used": 2,
}

L3_EXTREME = {
    "harmony_final": 0, "rounds_used": 0,
    "emotion_correct": 0, "evidence_correct": 0,
    "emotion_attempts": 0, "evidence_attempts": 0,
    "needs_correct": 0, "needs_attempts": 0,
    "solution_quality": 0, "solution_attempts": 0,
    "total_errors": 0, "successful_pairs": 0,
    "block_drag_count": 0, "species_placement_attempts": 0,
    "card_selected": "", "sentence_blocks_used": 0,
}

L3_EMPTY = {}

DIALOGUE_POSITIVE = [
    {"role":"player","text":"壳壳别难过，我们一起来想想办法吧"},
    {"role":"keke","text":"哼！彩彩总是抢我的地方！"},
    {"role":"player","text":"我知道你委屈，但你也可以让彩彩分享呀"},
    {"role":"caicai","text":"呜呜呜壳壳好凶"},
    {"role":"player","text":"彩彩别哭，壳壳其实也很关心你的"},
    {"role":"keke","text":"才、才没有！"},
    {"role":"player","text":"我们可以一起商量一个公平的办法"},
    {"role":"caicai","text":"好吧……我想要多一些游泳的空间"},
    {"role":"keke","text":"我要那个安静的角落看漫画"},
    {"role":"player","text":"那早上彩彩用空间游泳，下午壳壳看书，轮流来行吗？"},
    {"role":"keke","text":"……行吧"},
    {"role":"caicai","text":"嗯嗯我同意！"},
]

DIALOGUE_NEGATIVE = [
    {"role":"player","text":"不要吵了烦死了"},
    {"role":"keke","text":"哼！"},
    {"role":"player","text":"你们都是笨蛋"},
    {"role":"caicai","text":"呜……"},
    {"role":"player","text":"走开走开我不想管了"},
]

DIALOGUE_NEUTRAL = [
    {"role":"player","text":"你们别吵了"},
    {"role":"keke","text":"她先惹我的！"},
    {"role":"player","text":"好吧我知道了"},
    {"role":"caicai","text":"那你说怎么办"},
    {"role":"player","text":"我觉得你们可以轮流"},
    {"role":"keke","text":"……考虑一下"},
]

# ======================= 测试用例定义 =======================

TEST_CASES = []

def add(name, age, skip, l1_dur, l1, l2_dur, l2, l3_dur, l3, dia=None, tags=None):
    TEST_CASES.append({
        "name": name, "age": age, "skip_count": skip,
        "durations": {"level1": l1_dur, "level2": l2_dur, "level3": l3_dur},
        "metrics": {"level1": l1, "level2": l2, "level3": l3},
        "dialogue": dia or [], "tags": tags or [],
    })

# === A. 6个典型角色 ===
add("小优-学霸型", "8", 0,  90, L1_PERFECT, 150, L2_PERFECT, 180, L3_PERFECT, DIALOGUE_POSITIVE, ["P0"])
add("小茫-迷糊型", "8", 0,  240, L1_AVERAGE, 320, L2_AVERAGE, 280, L3_AVERAGE, DIALOGUE_NEUTRAL, ["P0"])
add("小躁-冲动型", "7", 2,  180, L1_BAD, 250, L2_FAILED, 120, L3_BAD, DIALOGUE_NEGATIVE, ["P0"])
add("小佛-佛系型", "9", 0,  350, L1_PERFECT, 420, L2_PERFECT, 300, L3_PERFECT, DIALOGUE_POSITIVE, ["P0"])
add("小皮-捣蛋型", "6", 3,  150, L1_WILD, 200, L2_WILD, 90, L3_BAD, DIALOGUE_NEGATIVE, ["P0"])
add("小飞-跳关型", "10", 3, 0, L1_EMPTY, 0, L2_EMPTY, 0, L3_EMPTY, [], [])

# === B. 边界条件 ===
add("BC-超快通关", "8", 0,  30, L1_PERFECT, 45, L2_PERFECT, 60, L3_PERFECT, DIALOGUE_POSITIVE, ["边界"])
add("BC-极限慢", "8", 0,  7200, L1_PERFECT, 3600, L2_PERFECT, 1800, L3_PERFECT, DIALOGUE_POSITIVE, ["边界"])
L1_INVALID = {**dict.fromkeys([k for k in L1_PERFECT], 0), "meaningless_clicks": 20, "blank_clicks": 10, "total_operations": 30}
add("BC-极限无效操作", "8", 0,  120, L1_INVALID, 0, L2_EMPTY, 0, L3_EMPTY, [], ["边界"])
add("BC-和解度0", "8", 0,  100, L1_PERFECT, 160, L2_PERFECT, 60, L3_EXTREME, DIALOGUE_NEGATIVE, ["边界"])
L1_MIN = {**dict.fromkeys([k for k in L1_PERFECT if k not in ["pair_details","check_history"]], 0), "successful_pairs": 1, "total_operations": 3}
add("BC-最小数据", "8", 0,  30, L1_MIN, 0, L2_EMPTY, 0, L3_EMPTY, [], ["边界"])
L1_MASSIVE = {**L1_WILD, "block_drag_count": 300, "species_placement_attempts": 300, "block_gravity_fall_failures": 100, "total_operations": 350}
add("BC-极端大量操作", "8", 0, 600, L1_MASSIVE, 500, L2_WILD, 200, L3_EXTREME, [], ["边界"])

# === C. 异常流程 ===
add("EC-半完成跳关", "8", 1,  180, L1_BAD, 0, L2_EMPTY, 0, L3_EMPTY, [], ["异常"])
add("EC-全跳关", "8", 3,  0, L1_EMPTY, 0, L2_EMPTY, 0, L3_EMPTY, [], ["异常"])
add("EC-字段缺失", "8", 0, 200, {"block_drag_count": 10, "successful_pairs": 3, "total_operations": 10}, 0, L2_EMPTY, 0, L3_EMPTY, [], ["异常"])

# === D. 年龄常模 ===
add("D-小优×6岁", "6", 0,  90, L1_PERFECT, 150, L2_PERFECT, 180, L3_PERFECT, DIALOGUE_POSITIVE, ["常模"])
add("D-小优×10岁", "10", 0, 90, L1_PERFECT, 150, L2_PERFECT, 180, L3_PERFECT, DIALOGUE_POSITIVE, ["常模"])

# ======================= 测试执行 =======================

def api_post(url, data, timeout=10):
    try:
        r = requests.post(url, json=data, timeout=timeout)
        return r.json() if r.status_code == 200 else {"error": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"error": str(e)}

def run_one(tc):
    """执行单个测试用例，返回量化评分 + 6维报告"""
    m = tc["metrics"]
    d = tc["durations"]
    l1, l2, l3 = {**m["level1"], "duration_seconds": d["level1"]}, {**m["level2"], "duration_seconds": d["level2"]}, {**m["level3"], "duration_seconds": d["level3"]}

    # 量化评分
    quant = api_post(f"{PYTHON_API}/quantitative-report", {
        "student_id": "test_stu", "age": tc["age"],
        "total_skip_count": tc["skip_count"],
        "level1_metrics": l1, "level2_metrics": l2, "level3_metrics": l3,
    }, timeout=10)

    # 6维报告（含AI调用可能较慢，给更长超时）
    report = api_post(f"{PYTHON_API}/report", {
        "session_id": f"test_{int(time.time()*1000)}", "student_id": "test_stu",
        "level1_metrics": l1, "level2_metrics": l2, "level3_metrics": l3,
        "level3_dialogue": tc["dialogue"],
    }, timeout=30)

    qdata = quant.get("data", {}) if "data" in quant else quant
    rdata = report.get("data", {}) if report and report.get("success") else None
    return qdata, rdata

def main():
    print("=" * 60)
    print(" 蔚蓝深海基地 · 全面数据测试 v2")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   用例数: {len(TEST_CASES)}")
    print("=" * 60)

    # 健康检查
    for name, url in [("Node.js", "http://localhost:3000/api/health"), ("Python", "http://localhost:8004/api/health")]:
        try:
            r = requests.get(url, timeout=3)
            print(f"   {name}: {'OK' if r.status_code==200 else 'FAIL'}")
        except:
            print(f"   {name}: DOWN!")

    # 执行测试
    q_all = []
    r_all = []
    errors = []

    for i, tc in enumerate(TEST_CASES, 1):
        name = tc["name"]
        sys.stdout.write(f"  [{i:02d}/{len(TEST_CASES)}] {name}...")
        sys.stdout.flush()

        qdata, rdata = run_one(tc)

        if "error" in qdata:
            print(f" ERR: {qdata['error'][:60]}")
            errors.append(name)
        else:
            score = qdata.get("comprehensive_score", "?")
            level = qdata.get("level", "?")
            print(f" {score}分/{level}")
            q_all.append({"name": name, "data": qdata, "tags": tc["tags"]})
            if rdata:
                r_all.append({"name": name, "data": rdata})

        time.sleep(0.1)  # 防止请求过快

    # 汇总表格
    print("\n" + "=" * 110)
    h = f"{'测试用例':<14} {'综合':>5} {'等级':>6} {'S1':>4} {'S2':>4} {'S3':>4}"
    h += f" {'空间':>4} {'自然':>4} {'逻辑':>4} {'人际':>4} {'语言':>4}"
    h += f" {'CHEXI':>6} {'标签'}"
    print(h)
    print("-" * 110)

    for q in q_all:
        d = q["data"]
        s = d.get("scores", {})
        rd = next((x["data"] for x in r_all if x["name"] == q["name"]), {})
        dims = rd.get("dimension_scores", {}) if rd else {}
        chx = rd.get("chexi", {}) if rd else {}
        tags = " ".join(q["tags"][:2])
        print(
            f"{q['name']:<12} "
            f"{str(d.get('comprehensive_score', '?')):>5} "
            f"{d.get('level', '?'):>6} "
            f"{str(s.get('S1_logical_spatial', '?')):>4} "
            f"{str(s.get('S2_focus_self_control', '?')):>4} "
            f"{str(s.get('S3_persistence', '?')):>4} "
            f"{str(dims.get('spatial', dims.get('空间视觉智能','?'))):>4} "
            f"{str(dims.get('naturalist', dims.get('自然观察智能','?'))):>4} "
            f"{str(dims.get('logical', dims.get('逻辑数理智能','?'))):>4} "
            f"{str(dims.get('interpersonal', dims.get('人际社交智能','?'))):>4} "
            f"{str(dims.get('linguistic', dims.get('语言表达智能','?'))):>4} "
            f"{str(chx.get('task_persistence', '?')):>6} "
            f"{tags}"
        )

    # 分化性分析
    print("\n" + "=" * 60)
    print(" 分化性验证分析")
    print("=" * 60)

    def g(name, key):
        q = next((x["data"] for x in q_all if x["name"] == name), {})
        if key == "comp": return q.get("comprehensive_score", 0)
        elif key == "S2": return q.get("scores", {}).get("S2_focus_self_control", 0)
        elif key == "S3": return q.get("scores", {}).get("S3_persistence", 0)
        elif key == "S1": return q.get("scores", {}).get("S1_logical_spatial", 0)
        return 0

    pairs = [
        ("小优-学霸型", "小茫-迷糊型", "总分分化"),
        ("小优-学霸型", "小躁-冲动型", "S2专注分化"),
        ("小优-学霸型", "小飞-跳关型", "S3坚持分化"),
        ("小茫-迷糊型", "小佛-佛系型", "同分不同维"),
        ("小皮-捣蛋型", "小飞-跳关型", "低分组分化"),
    ]
    for a, b, desc in pairs:
        ca, cb = g(a, "comp"), g(b, "comp")
        s2a, s2b = g(a, "S2"), g(b, "S2")
        s3a, s3b = g(a, "S3"), g(b, "S3")
        diff = abs(ca - cb)
        emoji = "OK" if diff >= 1.0 else ("~" if diff >= 0.5 else "!!")
        print(f"  [{emoji}] {a} vs {b}")
        print(f"       综合: {ca} vs {cb} (差={diff:.1f}) | S2: {s2a}/{s2b} | S3: {s3a}/{s3b}")

    # 年龄常模
    print("\n" + "=" * 60)
    print(" 年龄常模分析")
    print("=" * 60)
    for ak in ["D-小优×6岁", "小优-学霸型", "D-小优×10岁"]:
        sc = g(ak, "comp")
        print(f"  {ak}: {sc}分")
    u6, u8, u10 = g("D-小优×6岁","comp"), g("小优-学霸型","comp"), g("D-小优×10岁","comp")
    print(f"  趋势: 6岁={u6}  8岁={u8}  10岁={u10}")
    print(f"  结论: {'年龄调节正常' if u6>=u8>=u10 else '年龄调节异常'}")

    # 总结
    print("\n" + "=" * 60)
    print(f" 完成! 总用例={len(TEST_CASES)}, 通过={len(TEST_CASES)-len(errors)}, 失败={len(errors)}")
    if errors: print(f"  失败: {', '.join(errors)}")
    print("=" * 60)

if __name__ == "__main__":
    main()
