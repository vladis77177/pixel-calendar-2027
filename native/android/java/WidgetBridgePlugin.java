package __PACKAGE__;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
}
