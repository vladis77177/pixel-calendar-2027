package __PACKAGE__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// Смена дня у значка: собственный будильник на полночь, системные рассылки
// (время, часовой пояс, загрузка) и обновление после установки новой версии.
// ACTION_DATE_CHANGED оставлен для старых Android: с 8 его манифесту не шлют.
public class DayIconReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? "" : intent.getAction();
        if (action == null) return;
        if (action.equals(DayIconSwitcher.tickAction(context))
                || Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            DayIconSwitcher.apply(context);
            DayIconSwitcher.scheduleNext(context);
        }
    }
}
