package kr.class26.board;

import android.content.Context;
import android.content.SharedPreferences;

/** 설정/공유 값 (서버 주소, 칠판 로그인 토큰, 마지막으로 띄운 방송 번호) */
final class Cfg {
    static final String BASE = "https://class-26.bldoijoa01.workers.dev";
    private static SharedPreferences p(Context c) { return c.getSharedPreferences("board", Context.MODE_PRIVATE); }
    static String token(Context c) { return p(c).getString("tok", ""); }
    static void setToken(Context c, String t) { p(c).edit().putString("tok", t == null ? "" : t).apply(); }
    static long launched(Context c) { return p(c).getLong("annLaunched", 0); }
    static void setLaunched(Context c, long id) { p(c).edit().putLong("annLaunched", id).apply(); }
}
