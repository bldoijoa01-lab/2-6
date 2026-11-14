import json
d=json.load(open('data.json'))
ex=d['exam']
base={
 'periods':ex['periods'],'morning':ex['morning'],
 'cells':[[dict(c) for c in day['cells']] for day in ex['days']],
 'weekly':{'days':d['weekly']['days'],'note':d['weekly'].get('note',''),'rows':[{'n':r['n'],'time':r['time'],'cells':[({k:v for k,v in c.items() if k!='who'} if c else c) for c in r['cells']]} for r in d['weekly']['rows']]},
 'move':d['move'],'cautions':d['cautions'],'specialNote':d['specialNote'],'electiveNote':'선택과목 수행평가도 진행 중! 내 분반 일정은 교과 선생님 공지 확인',
 'about':{'title':'2-6 알림장','people':[{'role':'기획·운영','name':'2학년 6반'}],'notes':['지금은 둘러보기(체험) 화면이에요. 일정·시간표·성적은 모두 샘플이에요.','로그인하면 우리 반 진짜 일정과 내 시간표가 나와요.']},
 'ddays':d['ddays']
}
js="// 게스트 둘러보기용 샘플 데이터 (가상의 내용 — 실제 학생·일정 정보 없음)\n(function(){var B="+json.dumps(base,ensure_ascii=False)+";\n"+r'''
function iso(ms){return new Date(ms).toISOString().slice(0,10)}
var DOW=['일','월','화','수','목','금','토'];
window.makeDemo=function(today){
  var D=86400000, add=function(n){return iso(today+n*D)};
  var wd=new Date(today).getUTCDay(), toMon=(8-wd)%7||7, start=today+(toMon+14)*D;
  var days=B.cells.map(function(cells,i){var t=start+i*D, dt=new Date(t);return {date:iso(t),label:(dt.getUTCMonth()+1)+'/'+dt.getUTCDate()+'('+DOW[dt.getUTCDay()]+')',cells:cells};});
  return {
    updated:add(0), className:'2학년 6반',
    me:{n:15,name:'게스트',role:'student',admin:false,dorm:'302'},
    today:{date:add(0),meals:[{name:'조식',dishes:['친환경흰쌀밥','미역국','계란말이','배추김치'],kcal:'650'},{name:'중식',dishes:['잡곡밥','김치찌개','제육볶음','시금치나물','깍두기'],kcal:'890'},{name:'석식',dishes:['흑미밥','된장국','치킨너겟','오이무침','배추김치'],kcal:'820'}]},
    events:[
      {title:'과학 탐구 실험',date:add(1),note:'실험복 지참',short:'과학실험'},
      {title:'수학 수행평가',date:add(4),note:'교과서 3단원 · 계산기 불가',short:'수학수행'},
      {title:'영어 말하기 수행',date:add(9),note:'2분 발표',short:'영어수행'},
      {title:'학급 체육 행사',date:add(12),end:add(13),note:'체육복 착용'},
      {title:'동아리 발표회',date:add(18),note:'5~6교시 강당'},
      {title:'2학기 기말고사',date:days[0].date,end:days[days.length-1].date,note:'시간표는 기말고사 탭에서'}
    ],
    electiveNote:B.electiveNote,
    exam:{periods:B.periods,morning:B.morning,noLunchDate:days[days.length-1].date,days:days},
    move:B.move, special:[], specialNote:B.specialNote, cautions:B.cautions, about:B.about,
    updates:[{date:add(0),kind:'new',title:'게스트 둘러보기',detail:'로그인 없이 앱을 미리 볼 수 있어요. 모든 내용은 샘플이에요.'}],
    notices:[{title:'샘플 공지',text:'공지가 올라오면 홈과 일정 탭에 이렇게 보여요.'}],
    weekly:B.weekly, ddays:B.ddays,
    daily:(function(){var o={};o[add(0)]={items:[{k:'notice',t:'내일 과학실에서 수업해요 (실험복 지참)'},{k:'hw',t:'수학 수행평가 준비 — 3단원 복습'},{k:'prep',t:'체육복, 단어장'}],by:'샘플',at:add(-1)+'T22:30'};return o;})(),
    prep:{'전체':{range:'',tips:['시험 2주 전부터 교과서 개념 먼저 훑기','수행평가 일정은 일정 탭에서 확인'],by:'샘플',at:add(0)}}
  };
};
window.DEMO_PREFS={el2:['세포와 물질대사','기하','경제','윤리와 사상','일본어 회화'],blocks:{'세포와 물질대사':'A','기하':'B','경제':'C','윤리와 사상':'D','일본어 회화':'E'}};
})();
'''
open('public/demo.js','w',encoding='utf-8').write(js)
p='public/index.html'
a=open(p,encoding='utf-8').read()
if 'demo.js' not in a: a=a.replace('<script src="conv9.js"></script>','<script src="conv9.js"></script>\n<script src="demo.js"></script>',1)
open(p,'w',encoding='utf-8').write(a)
p='public/app.js'
a=open(p,encoding='utf-8').read()
def rep(o,n):
    global a
    assert a.count(o)==1,(a.count(o),o); a=a.replace(o,n)
rep("  function exitPreview() {\n","""  function enterGuest() {   // 게스트 둘러보기: 서버·계정 없이 샘플 데이터로 앱을 읽기 전용으로 체험
    if (!window.makeDemo) return;
    PREVIEW = { guest: true, n: 0, name: '게스트', scores: {}, prefs: JSON.parse(JSON.stringify(window.DEMO_PREFS)) };
    var sems = {};   // 샘플 내신 (1-1, 1-2, 2-1)
    ['1-1', '1-2', '2-1'].forEach(function (k, ki) { var gs = [[1, 2, 1, 2, 2, 1], [2, 2, 3, 2, 2, 3], [2, 3, 2, 3, 3, 2]][ki]; sems[k] = nsDefault(k).map(function (r, i) { r.g = r.x ? 0 : gs[i % gs.length]; return r; }); });
    PREVIEW.prefs.naesin = { sems: sems };
    init(window.makeDemo(TODAY));
    document.body.classList.add('preview');
    document.getElementById('previewBar').hidden = false;
    document.getElementById('previewWho').textContent = '👀 게스트 둘러보기 · 샘플 데이터 · 읽기 전용';
    document.getElementById('previewExit').textContent = '로그인하러 가기';
    document.getElementById('who').textContent = '게스트';
  }
  function exitPreview() {
    if (PREVIEW && PREVIEW.guest) { location.hash = ''; location.reload(); return; }
""")
rep("    card([h('div', { class: 'login-brand' }, [logoSvg(), h('b', { text: '2-6 알림장' })]), h('div', { class: 'login-sub', text: '우리 반 전용이에요.","    var guestBtn = h('button', { class: 'btn out guest-btn', type: 'button', text: '👀 게스트로 둘러보기' });\n    guestBtn.addEventListener('click', enterGuest);\n    card([h('div', { class: 'login-brand' }, [logoSvg(), h('b', { text: '2-6 알림장' })]), h('div', { class: 'login-sub', text: '우리 반 전용이에요.")
open(p,'w',encoding='utf-8').write(a)
