package __PACKAGE__;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void sync(PluginCall call) {
        String payload = call.getString("payload", "{}");
        Context context = getContext();

        SharedPreferences prefs = context.getSharedPreferences(CalendarWidgetProvider.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(CalendarWidgetProvider.KEY_PAYLOAD, payload).apply();

        CalendarWidgetProvider.updateAll(context);

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void consumeToggles(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(CalendarWidgetProvider.PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString("pending_toggles", "[]");
        prefs.edit().remove("pending_toggles").apply();

        JSArray items = new JSArray();
        try {
            JSONArray stored = new JSONArray(raw);
            for (int index = 0; index < stored.length(); index += 1) {
                JSONObject storedItem = stored.optJSONObject(index);
                if (storedItem == null) continue;
                JSObject item = new JSObject();
                item.put("key", storedItem.optString("key", ""));
                item.put("iso", storedItem.optString("iso", ""));
                items.put(item);
            }
        } catch (Exception error) {
            // Повреждённый буфер виджета: отдаём пустой список и не ломаем старт приложения.
        }

        JSObject result = new JSObject();
        result.put("items", items);
        call.resolve(result);
    }
}
