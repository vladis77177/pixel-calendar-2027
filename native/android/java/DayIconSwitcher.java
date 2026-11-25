package __PACKAGE__;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

import java.util.Calendar;

// Живой значок ярлыка: у приложения 31 activity-alias (Day1…Day31), включён ровно
// один. Переключаем по системной дате, чтобы на иконке стояло число текущего дня.
//
// С Android 8 система не доставляет ACTION_DATE_CHANGED манифестным receiver'ам,
// поэтому одного receiver мало: в полночь значок менялся только при запуске.
// Будильник на ближайшую полночь — единственный тик, который нужен приложению;
// он взводится заново после каждого срабатывания, при загрузке и при запуске.
public final class DayIconSwitcher {
    private static final String PREFS = "pixel_day_icon";
    private static final String KEY_DAY = "day";
    // Час и минута тика: сразу после смены даты, чтобы не спорить с ней.
    private static final int TICK_HOUR = 0;
    private static final int TICK_MINUTE = 5;

    private DayIconSwitcher() {}

    static String tickAction(Context context) {
        return context.getPackageName() + ".DAY_ICON_TICK";
    }

    // Следующий тик — ближайшая полночь. setAndAllowWhileIdle доставляется и в Doze,
    // поэтому значок меняется в ту же ночь, а не при первом открытии приложения.
    public static void scheduleNext(Context context) {
        try {
            AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarms == null) return;
            Intent intent = new Intent(context, DayIconReceiver.class);
            intent.setAction(tickAction(context));
            PendingIntent pending = PendingIntent.getBroadcast(
                    context,
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTickAt(), pending);
        } catch (Exception error) {
            // Как и переключение: сбой будильника не повод ронять приложение.
        }
    }

    private static long nextTickAt() {
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, TICK_HOUR);
        next.set(Calendar.MINUTE, TICK_MINUTE);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) {
            next.add(Calendar.DAY_OF_MONTH, 1);
        }
        return next.getTimeInMillis();
    }

    public static void apply(Context context) {
        try {
            int day = Calendar.getInstance().get(Calendar.DAY_OF_MONTH);
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            // Манифест включает .Day1 по умолчанию, поэтому при первом запуске
            // «предыдущий» — это 1: иначе .Day1 остался бы включён вместе с текущим.
            int previous = prefs.getInt(KEY_DAY, 1);
            if (previous == day) return;

            PackageManager manager = context.getPackageManager();
            String packageName = context.getPackageName();
            setAlias(manager, packageName, day, PackageManager.COMPONENT_ENABLED_STATE_ENABLED);
            if (previous >= 1 && previous <= 31) {
                setAlias(manager, packageName, previous, PackageManager.COMPONENT_ENABLED_STATE_DISABLED);
            }
            prefs.edit().putInt(KEY_DAY, day).apply();
        } catch (Exception error) {
            // Значок не должен ронять приложение: любая ошибка переключения — не повод.
        }
    }

    private static void setAlias(PackageManager manager, String packageName, int day, int state) throws Exception {
        ComponentName alias = new ComponentName(packageName, packageName + ".Day" + day);
        manager.setComponentEnabledSetting(alias, state, PackageManager.DONT_KILL_APP);
    }
}
