#!/usr/bin/env python3
"""충청남도교육청 진학정보(jinhakai.pen.go.kr)의 5등급제→9등급제 내신 변환 규칙표를 받아 public/conv9.js 를 다시 만든다.
기준연도가 바뀌면(예: 2027) 'python3 tools/update-conv9.py 2027' 로 실행. 사이트 API 에 접속할 수 있는 환경에서 실행해야 함."""
import json, sys, urllib.request
year = sys.argv[1] if len(sys.argv) > 1 else '2026'
req = urllib.request.Request('https://jinhakai.pen.go.kr/api/v1/grade-conversions/rules', data=json.dumps({'baseYear': year}).encode(), headers={'content-type': 'application/json'})
d = json.load(urllib.request.urlopen(req, timeout=30))
rows = sorted([r for r in d['rules'] if r.get('useYn') == 'Y' and r['sourceScale'] == 5 and r['targetScale'] == 9], key=lambda r: r['sourceGrade'])
assert [round(r['sourceGrade'] * 100) for r in rows] == list(range(100, 501)), '0.01 단위 401개 행이 아님'
out = [[round(r['sourceGrade'], 2), round(r['targetRangeMin'], 2), round(r['targetRangeMax'], 2)] for r in rows]
open('public/conv9.js', 'w', encoding='utf-8').write(
    "// 5등급제 내신 평균(1.00~5.00) → 9등급제 환산 범위 [5등급제, 9등급제 하한, 9등급제 상한]\n// 출처: jinhakai.pen.go.kr/entrance/gradeConversion (내신 변환 규칙표, 기준연도 %s)\nwindow.CONV9 = {baseYear:'%s', rows:%s};\n" % (d['baseYear'], d['baseYear'], json.dumps(out, separators=(',', ':'))))
print('conv9.js 갱신:', d['baseYear'], len(out), '행')
