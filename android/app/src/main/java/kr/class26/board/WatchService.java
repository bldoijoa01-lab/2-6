package kr.class26.board;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Scanner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 앱 화면이 꺼져 있거나 다른 앱(유튜브 등)이 떠 있어도 서버를 계속 확인하다가, 새 긴급 방송이 오면 화면을 켜고 칠판 화면을 맨 앞으로 올림 */
public class WatchService extends Service {
    private volatile boolean run = false;
    private Thread th;

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public int onStartCommand(Intent i, int f, int id) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("watch", "방송 대기", NotificationManager.IMPORTANCE_LOW));
        Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "watch") : new Notification.Builder(this);
        nb.setContentTitle("2-6 전자칠판").setContentText("방송을 기다리는 중").setSmallIcon(android.R.drawable.ic_dialog_info);
        startForeground(1, nb.build());
        if (!run) {
            run = true;
            th = new Thread(this::loop, "watch"); th.start();
        }
        return START_STICKY;
    }

    @Override public void onDestroy() { run = false; if (th != null) th.interrupt(); super.onDestroy(); }

    private void loop() {
        while (run) {
            try { check(); } catch (Exception e) { /* 네트워크가 잠깐 끊겨도 계속 */ }
            try { Thread.sleep(5000); } catch (InterruptedException e) { return; }
        }
    }

    private void check() throws Exception {
        String tok = Cfg.token(this); if (tok.isEmpty()) return;
        HttpURLConnection c = (HttpURLConnection) new URL(Cfg.BASE + "/api/kiosk/poll").openConnection();
        c.setConnectTimeout(8000); c.setReadTimeout(8000); c.setRequestMethod("POST"); c.setDoOutput(true);
        c.setRequestProperty("authorization", "Bearer " + tok); c.setRequestProperty("content-type", "application/json");
        OutputStream os = c.getOutputStream(); os.write("{}".getBytes("UTF-8")); os.close();
        if (c.getResponseCode() != 200) return;
        InputStream is = c.getInputStream(); String body = new Scanner(is, "UTF-8").useDelimiter("\\A").next(); is.close();
        Matcher m = Pattern.compile("\"ann\"\\s*:\\s*\\{[^}]*?\"id\"\\s*:\\s*(\\d+)").matcher(body);
        if (!m.find()) return;
        long id = Long.parseLong(m.group(1));
        if (id <= Cfg.launched(this)) return;
        Cfg.setLaunched(this, id);
        wakeAndShow();
    }

    @SuppressWarnings("deprecation")
    private void wakeAndShow() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE, "class26:ann");
        wl.acquire(60000);
        Intent i = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try { startActivity(i); } catch (Exception e) { /* 백그라운드 실행이 막히면 아래 전체화면 알림으로 */ }
        // 보조: 전체 화면 알림 (잠금/대기 화면에서도 화면을 켜며 표시)
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("ann", "긴급 방송", NotificationManager.IMPORTANCE_HIGH));
        PendingIntent pi = PendingIntent.getActivity(this, 2, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "ann") : new Notification.Builder(this);
        nb.setContentTitle("📢 안내 방송").setContentText("전자칠판을 확인하세요").setSmallIcon(android.R.drawable.ic_dialog_alert).setContentIntent(pi).setFullScreenIntent(pi, true).setAutoCancel(true);
        nm.notify(2, nb.build());
    }
}
