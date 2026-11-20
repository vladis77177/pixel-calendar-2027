package __PACKAGE__;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

import java.util.Calendar;

// Живой значок ярлыка: у приложения 31 activity-alias (Day1…Day31), включён ровно
// один. Переключаем по системной дате, чтобы на иконке стояло число текущего дня.
public final class DayIconSwitcher {
    private static final String PREFS = "pixel_day_icon";
    private static final String KEY_DAY = "day";

    private DayIconSwitcher() {}

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
