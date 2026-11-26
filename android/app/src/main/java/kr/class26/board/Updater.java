package kr.class26.board;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Scanner;

/** 앱 자체 업데이트: GitHub 릴리스의 version.txt 번호가 지금 설치된 것보다 크면 "업데이트" 버튼을 보여 주고, 누르면 새 APK를 내려받아 설치 화면을 열어 줌 */
final class Updater {
    static final String REL = "https://github.com/bldoijoa01-lab/2-6/releases/download/board-apk/";
    private static boolean busy = false;

    static int installed(Context c) {
        try { return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionCode; } catch (Exception e) { return 0; }
    }

    private static String get(String u) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection(); c.setConnectTimeout(10000); c.setReadTimeout(15000); c.setInstanceFollowRedirects(true);
        if (c.getResponseCode() != 200) return null;
        InputStream is = c.getInputStream(); String s = new Scanner(is, "UTF-8").useDelimiter("\\A").next(); is.close(); return s.trim();
    }

    /** 새 버전이 있으면 대화상자를 띄움 (백그라운드 스레드에서 확인) */
    static void check(final Activity a) {
        if (busy) return;
        new Thread(new Runnable() { @Override public void run() {
            try {
                String v = get(REL + "version.txt"); if (v == null) return;
                final int latest = Integer.parseInt(v.replaceAll("[^0-9]", ""));
                if (latest <= installed(a)) return;
                a.runOnUiThread(new Runnable() { @Override public void run() { ask(a, latest); } });
            } catch (Exception e) { /* 인터넷이 없으면 다음에 다시 */ }
        } }, "upd-check").start();
    }

    private static void ask(final Activity a, final int latest) {
        if (a.isFinishing()) return;
        new AlertDialog.Builder(a).setTitle("새 버전이 있어요").setMessage("전자칠판 앱을 새 버전(" + latest + ")으로 업데이트할까요?")
            .setPositiveButton("업데이트", new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) { download(a); } })
            .setNegativeButton("나중에", null).show();
    }

    private static void download(final Activity a) {
        if (android.os.Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) {   // 처음 한 번: 이 앱에 설치 허용
            Toast.makeText(a, "이 앱의 '앱 설치 허용'을 켠 뒤 다시 눌러 주세요", Toast.LENGTH_LONG).show();
            a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName()))); return;
        }
        busy = true; Toast.makeText(a, "새 버전을 내려받는 중이에요…", Toast.LENGTH_LONG).show();
        new Thread(new Runnable() { @Override public void run() {
            try {
                File dir = new File(a.getCacheDir(), "upd"); dir.mkdirs(); File f = new File(dir, "update.apk");
                HttpURLConnection c = (HttpURLConnection) new URL(REL + "class26-board.apk").openConnection(); c.setConnectTimeout(10000); c.setReadTimeout(30000); c.setInstanceFollowRedirects(true);
                if (c.getResponseCode() != 200) throw new Exception("http " + c.getResponseCode());
                InputStream is = c.getInputStream(); FileOutputStream os = new FileOutputStream(f); byte[] buf = new byte[16384]; int n; while ((n = is.read(buf)) > 0) os.write(buf, 0, n); os.close(); is.close();
                final Uri u = FileProvider.getUriForFile(a, "kr.class26.board.files", f);
                a.runOnUiThread(new Runnable() { @Override public void run() {
                    Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(u, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    a.startActivity(i);
                } });
            } catch (Exception e) {
                a.runOnUiThread(new Runnable() { @Override public void run() { Toast.makeText(a, "업데이트를 내려받지 못했어요. 잠시 뒤 다시 시도해 주세요", Toast.LENGTH_LONG).show(); } });
            } finally { busy = false; }
        } }, "upd-dl").start();
    }
}
