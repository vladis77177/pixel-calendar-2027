package __PACKAGE__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

public class WidgetToggleReceiver extends BroadcastReceiver {
    static final String ACTION_TOGGLE = "ru.pixel.calendar2027.WIDGET_TOGGLE";
    static final String EXTRA_KEY = "key";
    static final String EXTRA_ISO = "iso";
    private static final String KEY_PENDING = "pending_toggles";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_TOGGLE.equals(intent.getAction())) return;
        String key = intent.getStringExtra(EXTRA_KEY);
        if (key == null || !key.startsWith("task:")) return;
        String iso = intent.getStringExtra(EXTRA_ISO);
        if (iso == null) iso = "";

        SharedPreferences prefs = context.getSharedPreferences(CalendarWidgetProvider.PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(CalendarWidgetProvider.KEY_PAYLOAD, "");
        JSONObject payload;
        try {
            payload = new JSONObject(raw);
        } catch (Exception error) {
            return;
        }

        JSONArray tasks = payload.optJSONArray("tasks");
        if (tasks == null) tasks = new JSONArray();
        JSONObject target = null;
        for (int index = 0; index < tasks.length(); index += 1) {
            JSONObject task = tasks.optJSONObject(index);
            if (task != null && key.equals(task.optString("key", ""))) {
                target = task;
                break;
            }
        }
        // Строка уже отмечена или день сменился: второй клик ничего не делает.
        if (target == null || target.optBoolean("done", false)) return;

        try {
            target.put("done", true);
            int done = payload.optInt("done", 0) + 1;
            int total = payload.optInt("total", 0);
            if (total > 0 && done > total) done = total;
            payload.put("done", done);

            JSONArray pending = new JSONArray(prefs.getString(KEY_PENDING, "[]"));
            boolean known = false;
            for (int index = 0; index < pending.length(); index += 1) {
                JSONObject item = pending.optJSONObject(index);
                if (item != null && key.equals(item.optString("key", ""))) {
                    known = true;
                    break;
                }
            }
            if (!known) {
                JSONObject item = new JSONObject();
                item.put("key", key);
                item.put("iso", iso);
                pending.put(item);
            }

            prefs.edit()
                    .putString(CalendarWidgetProvider.KEY_PAYLOAD, payload.toString())
                    .putString(KEY_PENDING, pending.toString())
                    .apply();
        } catch (Exception error) {
            return;
        }

        CalendarWidgetProvider.updateAll(context);
    }
}
