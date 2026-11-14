// 게스트 둘러보기용 샘플 데이터 (가상의 내용 — 실제 학생·일정 정보 없음)
(function(){var B={"periods": [{"name": "1교시", "time": "08:50~09:40"}, {"name": "2교시", "time": "10:05~10:55"}, {"name": "3교시", "time": "11:20~12:10"}], "morning": [{"name": "조회", "time": "08:20~08:30"}, {"name": "학생 이동", "time": "08:30~08:40"}], "cells": [[{"t": "화법과 언어", "k": "common"}, {"t": "자습", "k": "self"}, {"t": "세계시민과 지리 / 세포와 물질대사", "k": "elective"}], [{"t": "미적분Ⅰ", "k": "common"}, {"t": "자습", "k": "self"}, {"t": "영어 발표와 토론 / 물질과 에너지", "k": "elective"}], [{"t": "역학과 에너지", "k": "elective"}, {"t": "일본어 회화 / 중국어", "k": "elective"}, {"t": "기하 / 경제 수학", "k": "elective"}], [{"t": "윤리와 사상 / 로봇과 공학세계", "k": "elective"}, {"t": "인공지능 기초", "k": "elective"}, {"t": "주제 탐구 독서 / 인공지능 수학", "k": "elective"}], [{"t": "영어Ⅱ", "k": "common"}, {"t": "일본어", "k": "elective"}, {"t": "경제 / 지구시스템과학", "k": "elective"}]], "weekly": {"days": ["월", "화", "수", "목", "금"], "note": "A~E는 선택과목 시간대예요. 내 정보에서 내 선택과목이 몇 반(A~E)인지 정하면 과목 이름으로 바뀌어요.", "rows": [{"n": 1, "time": "08:30", "cells": [{"b": "B", "k": "block"}, {"b": "D", "k": "block"}, {"t": "스과 · 체육C", "k": "common"}, {"t": "영Ⅱ", "k": "common"}, {"b": "A", "k": "block"}]}, {"n": 2, "time": "09:30", "cells": [{"t": "화언", "k": "common"}, {"t": "영Ⅱ", "k": "common"}, {"b": "A", "k": "block"}, {"b": "D", "k": "block"}, {"t": "미적", "k": "common"}]}, {"n": 3, "time": "10:30", "cells": [{"t": "미적", "k": "common"}, {"t": "화언", "k": "common"}, {"t": "미적", "k": "common"}, {"t": "화언", "k": "common"}, {"t": "공강", "k": "self"}]}, {"n": 4, "time": "11:30", "cells": [null, {"b": "D", "k": "block"}, {"b": "E", "k": "block"}, {"t": "영Ⅱ", "k": "common"}, {"b": "C", "k": "block"}]}, {"n": 5, "time": "13:20", "cells": [{"t": "화언", "k": "common"}, {"t": "미적", "k": "common"}, {"t": "창체", "k": "common"}, {"b": "A", "k": "block"}, {"t": "연창", "k": "common"}]}, {"n": 6, "time": "14:20", "cells": [{"t": "영Ⅱ", "k": "common"}, {"t": "연창", "k": "common"}, {"t": "창체", "k": "common"}, {"b": "E", "k": "block"}, {"b": "C", "k": "block"}]}, {"n": 7, "time": "15:20", "cells": [{"b": "C", "k": "block"}, {"b": "B", "k": "block"}, null, {"b": "B", "k": "block"}, {"b": "E", "k": "block"}]}]}, "move": {"ownRoom": "2-6", "otherRoom": "1학년 6반", "frontCount": 13, "moveTime": "08:30~08:40", "rules": ["시험 당일 지정된 시간(1교시 시작 10분 전)에 해당 교실로 무조건 13명씩 이동", "앞번호 13명은 타 교실(1학년 6반)로 이동, 뒷번호는 우리 교실(2-6)에서 응시", "우리 교실에는 1학년 6반 앞번호 13명이 와서 같이 시험 (학년 간 혼합학급)", "자퇴·전출·위탁 등으로 번호가 비면 다음 번호를 채워 13명을 맞춤", "좌석은 번호순: 빠른 번호가 운동장(실외)쪽 창가 열 맨 앞부터 (4열)"], "seats": {"cols": [6, 6, 6, 7, 6]}}, "cautions": [{"t": "답안지는 컴퓨터용 수성사인펜", "s": "다른 펜으로 써서 채점 오류가 나면 점수 인정 X · 한 문항에 2개 이상 표기하면 오답"}, {"t": "서술형은 지워지거나 번지지 않는 필기구", "s": "수정은 답안지 교체 또는 수정테이프 / 볼펜은 두 줄 긋고 정정"}, {"t": "휴대폰·스마트워치·에어팟·계산기·전자사전·스마트안경 등 반입 불가", "s": "필요하면 사전에 담임쌤께 제출"}, {"t": "종 친 뒤에도 계속 쓰면 부정행위", "s": "적발 시 해당 과목 0점 + 징계 (협조자도 같이)"}, {"t": "결시하면 증빙서류 제출", "s": "인정점 받으려면 필수"}], "specialNote": "쉬는 시간에 필기도구 들고 4층 해당 시험실로 이동 (4층 교무실 맞은편 통로). 입구·칠판 좌석표 확인하고 지정 자리에 착석!", "electiveNote": "선택과목 수행평가도 진행 중! 내 분반 일정은 교과 선생님 공지 확인", "about": {"title": "2-6 알림장", "people": [{"role": "기획·운영", "name": "2학년 6반"}], "notes": ["지금은 둘러보기(체험) 화면이에요. 일정·시간표·성적은 모두 샘플이에요.", "로그인하면 우리 반 진짜 일정과 내 시간표가 나와요."]}, "ddays": [{"title": "2028학년도 수능", "date": "2027-11-18"}]};

function iso(ms){return new Date(ms).toISOString().slice(0,10)}
var DOW=['일','월','화','수','목','금','토'];
window.makeDemo=function(today){
  var D=86400000, add=function(n){return iso(today+n*D)};
  var wd=new Date(today).getUTCDay(), toMon=(8-wd)%7||7, start=today+(toMon+14)*D;
  var days=B.cells.map(function(cells,i){var t=start+i*D, dt=new Date(t);return {date:iso(t),label:(dt.getUTCMonth()+1)+'/'+dt.getUTCDate()+'('+DOW[dt.getUTCDay()]+')',cells:cells};});
  return {
    updated:add(0), className:'2학년 6반',
    me:{n:15,name:'게스트',role:'student',admin:false},
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
    daily:(function(){var o={};o[add(0)]={items:[{k:'notice',t:'내일 과학실에서 수업해요 (실험복 지참)'},{k:'hw',t:'수학 수행평가 준비 — 3단원 복습'},{k:'prep',t:'체육복, 단어장'}],by:'샘플',at:add(0)+'T08:00'};return o;})(),
    prep:{'전체':{range:'',tips:['시험 2주 전부터 교과서 개념 먼저 훑기','수행평가 일정은 일정 탭에서 확인'],by:'샘플',at:add(0)}}
  };
};
window.DEMO_PREFS={el2:['세포와 물질대사','기하','경제','윤리와 사상','일본어 회화'],blocks:{'세포와 물질대사':'A','기하':'B','경제':'C','윤리와 사상':'D','일본어 회화':'E'}};
})();
