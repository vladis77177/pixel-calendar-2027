package __PACKAGE__;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

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
    public void consumeLaunch(PluginCall call) {
        String mode = MainActivity.consumeQuickAdd();
        JSObject result = new JSObject();
        result.put("mode", mode == null ? "" : mode);
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

    @PluginMethod
    public void saveBackup(PluginCall call) {
        String filename = call.getString("filename", "pixel-calendar-2027-backup.json");
        String content = call.getString("content", "");

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ пишет в общие «Загрузки» через MediaStore — без разрешений.
                saveViaMediaStore(filename, content);
            } else {
                // Android 7–9: MediaStore.Downloads появился только в API 29,
                // поэтому пишем напрямую в публичную папку (нужно WRITE_EXTERNAL_STORAGE).
                saveViaPublicDirectory(filename, content);
            }
        } catch (Exception error) {
            // Текст уходит в тост, поэтому он понятен пользователю без логов.
            call.reject("Не удалось сохранить файл в «Загрузки»: " + error.getMessage());
            return;
        }

        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("path", "Download/" + filename);
        call.resolve(result);
    }

    private void saveViaMediaStore(String filename, String content) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            // insert вернул null — файл не создан; тихий успех скрыл бы это от пользователя.
            throw new IllegalStateException("система не создала запись в «Загрузках»");
        }

        try (OutputStream stream = resolver.openOutputStream(uri)) {
            if (stream == null) {
                throw new IllegalStateException("нет доступа к «Загрузкам»");
            }
            stream.write(content.getBytes(StandardCharsets.UTF_8));
        }
    }

    private void saveViaPublicDirectory(String filename, String content) throws Exception {
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("не удалось создать папку «Загрузки»");
        }
        File target = new File(dir, filename);
        try (FileOutputStream stream = new FileOutputStream(target)) {
            stream.write(content.getBytes(StandardCharsets.UTF_8));
        }
    }
}
