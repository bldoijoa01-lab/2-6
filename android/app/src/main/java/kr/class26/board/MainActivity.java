package kr.class26.board;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** 전자칠판 화면(웹)을 전체 화면으로 보여 주는 앱. 방송이 오면 WatchService가 이 화면을 맨 앞으로 올림 */
public class MainActivity extends Activity {
    private WebView web;
    private final Handler h = new Handler();
    private final Runnable syncTok = new Runnable() {
        @Override public void run() {
            if (web != null) web.evaluateJavascript("(function(){try{return localStorage.getItem('tok26')||''}catch(e){return ''}})()", v -> {
                if (v != null) { String t = v.replace("\"", ""); if (t.length() > 8) Cfg.setToken(MainActivity.this, t); }
            });
            h.postDelayed(this, 60000);
        }
    };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web);
        web.loadUrl(Cfg.BASE + "/");
        h.postDelayed(syncTok, 8000);
        h.postDelayed(new Runnable() { @Override public void run() { Updater.check(MainActivity.this); h.postDelayed(this, 6 * 3600 * 1000L); } }, 20000);   // 켜진 뒤 20초 후, 이후 6시간마다 새 버전 확인
        askPermissions();
        startWatch();
    }

    private void startWatch() {
        Intent i = new Intent(this, WatchService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
    }

    /** 처음 한 번: 다른 앱 위에 표시 · 배터리 절전 예외를 허용하도록 설정 화면으로 보냄 */
    private void askPermissions() {
        try {
            if (!Settings.canDrawOverlays(this)) { startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()))); return; }
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (Build.VERSION.SDK_INT >= 23 && !pm.isIgnoringBatteryOptimizations(getPackageName())) startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
            if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
        } catch (Exception e) { /* 설정 화면이 없는 기기는 건너뜀 */ }
    }

    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); if (web != null) web.evaluateJavascript("try{window.dispatchEvent(new Event('focus'))}catch(e){}", null); }
    @Override protected void onResume() { super.onResume(); immersive(); askPermissions(); }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }
    private void immersive() { getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); }
    @Override protected void onDestroy() { h.removeCallbacksAndMessages(null); if (web != null) web.destroy(); super.onDestroy(); }
}
