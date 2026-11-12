package __PACKAGE__;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

public class CalendarWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "pixel_widget";
    static final String KEY_PAYLOAD = "payload";
    private static final int MAX_TASKS = 5;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent == null ? "" : intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            updateAll(context);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
                new android.content.ComponentName(context, CalendarWidgetProvider.class));
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static boolean isNight(String sky, String phase) {
        if (sky == null || sky.isEmpty() || "auto".equals(sky)) {
            Calendar now = Calendar.getInstance();
            int hour = now.get(Calendar.HOUR_OF_DAY);
            return hour >= 21 || hour < 5;
        }
        return "night".equals(phase);
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_PAYLOAD, "");
        String weekday = "";
        String label = "";
        String holiday = "";
        String phase = "day";
        String sky = "auto";
        int done = 0;
        int total = 0;
        JSONArray tasks = new JSONArray();

        try {
            JSONObject payload = new JSONObject(raw);
            weekday = payload.optString("weekday", "");
            label = payload.optString("label", "");
            holiday = payload.optString("holiday", "");
            phase = payload.optString("phase", "day");
            sky = payload.optString("sky", "auto");
            done = payload.optInt("done", 0);
            total = payload.optInt("total", 0);
            tasks = payload.optJSONArray("tasks");
            if (tasks == null) tasks = new JSONArray();
        } catch (Exception error) {
            // Пустой или повреждённый payload: показываем спокойное пустое состояние.
        }

        boolean night = isNight(sky, phase);
        String packageName = context.getPackageName();
        RemoteViews views = new RemoteViews(packageName,
                night ? R.layout.calendar_widget_night : R.layout.calendar_widget);

        views.setTextViewText(R.id.widget_weekday, weekday.toUpperCase(new Locale("ru")));
        views.setTextViewText(R.id.widget_date, label);
        views.setTextViewText(R.id.widget_progress, done + " / " + total);

        if (holiday.isEmpty()) {
            views.setViewVisibility(R.id.widget_holiday, View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_holiday, View.VISIBLE);
            views.setTextViewText(R.id.widget_holiday, holiday);
        }

        int maximum = Math.max(total, 1);
        views.setProgressBar(R.id.widget_bar, maximum, Math.min(done, maximum), total == 0);

        int shown = Math.min(tasks.length(), MAX_TASKS);
        views.removeAllViews(R.id.widget_tasks_list);
        for (int index = 0; index < shown; index += 1) {
            JSONObject task = tasks.optJSONObject(index);
            if (task == null) continue;
            boolean isDone = task.optBoolean("done", false);
            String text = task.optString("text", "");
            if (task.optBoolean("series", false)) text = "↻ " + text;

            RemoteViews row = new RemoteViews(packageName,
                    night ? R.layout.widget_task_row_night : R.layout.widget_task_row);
            row.setTextViewText(R.id.widget_task_mark, isDone ? "✓" : "□");
            row.setTextViewText(R.id.widget_task_text, text);
            if (isDone) {
                row.setTextColor(R.id.widget_task_mark, night ? 0xFF6D7C99 : 0xFF9A8B74);
                row.setTextColor(R.id.widget_task_text, night ? 0xFF8E9AB5 : 0xFF8E7F6A);
            }
            views.addView(R.id.widget_tasks_list, row);
        }

        views.setViewVisibility(R.id.widget_empty, shown == 0 ? View.VISIBLE : View.GONE);
        if (tasks.length() > shown) {
            views.setViewVisibility(R.id.widget_more, View.VISIBLE);
            views.setTextViewText(R.id.widget_more, "ещё " + (tasks.length() - shown));
        } else {
            views.setViewVisibility(R.id.widget_more, View.GONE);
        }

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        manager.updateAppWidget(widgetId, views);
    }
}
