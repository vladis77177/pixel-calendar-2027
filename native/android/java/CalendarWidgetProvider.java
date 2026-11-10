package __PACKAGE__;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class CalendarWidgetProvider extends AppWidgetProvider {

    public static final String PREFS = "pixel_widget";
    public static final String KEY_PAYLOAD = "payload";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildViews(context));
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

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, CalendarWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.calendar_widget);

        Locale locale = new Locale("ru", "RU");
        String weekday = new SimpleDateFormat("EEEE", locale).format(new Date());
        String label = new SimpleDateFormat("d MMMM yyyy", locale).format(new Date());
        String holiday = "";
        int total = 0;
        int done = 0;
        String tasksText = "";

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String payload = prefs.getString(KEY_PAYLOAD, "");

        try {
            if (payload != null && payload.length() > 0) {
                JSONObject root = new JSONObject(payload);
                weekday = root.optString("weekday", weekday);
                label = root.optString("label", label);
                holiday = root.optString("holiday", "");
                total = root.optInt("total", 0);
                done = root.optInt("done", 0);

                JSONArray tasks = root.optJSONArray("tasks");
                StringBuilder builder = new StringBuilder();
                int shown = 0;
                int available = tasks == null ? 0 : tasks.length();
                for (int index = 0; index < available && shown < 5; index += 1) {
                    JSONObject task = tasks.optJSONObject(index);
                    if (task == null) continue;
                    String text = task.optString("text", "").trim();
                    if (text.isEmpty()) continue;
                    if (builder.length() > 0) builder.append('\n');
                    builder.append(task.optBoolean("done", false) ? "✓ " : "○ ").append(text);
                    shown += 1;
                }
                if (available > shown) {
                    if (builder.length() > 0) builder.append('\n');
                    builder.append("… ещё ").append(available - shown);
                }
                tasksText = builder.toString();
            }
        } catch (Exception ignored) {
            tasksText = "";
        }

        if (weekday != null && weekday.length() > 0) {
            weekday = weekday.substring(0, 1).toUpperCase(locale) + weekday.substring(1);
        }

        views.setTextViewText(R.id.widget_weekday, weekday == null ? "" : weekday);
        views.setTextViewText(R.id.widget_date, label == null ? "" : label);
        views.setTextViewText(R.id.widget_progress, done + " / " + total);
        views.setProgressBar(R.id.widget_bar, Math.max(total, 1), done, total == 0);

        if (tasksText.isEmpty()) {
            views.setViewVisibility(R.id.widget_tasks, View.GONE);
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_tasks, View.VISIBLE);
            views.setViewVisibility(R.id.widget_empty, View.GONE);
            views.setTextViewText(R.id.widget_tasks, tasksText);
        }

        if (holiday.isEmpty()) {
            views.setViewVisibility(R.id.widget_holiday, View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_holiday, View.VISIBLE);
            views.setTextViewText(R.id.widget_holiday, "★ " + holiday);
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

        return views;
    }
}
