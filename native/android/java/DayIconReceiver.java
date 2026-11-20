package __PACKAGE__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// Системная рассылка о смене дня: тем же способом, каким виджет узнаёт о новом дне.
public class DayIconReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? "" : intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            DayIconSwitcher.apply(context);
        }
    }
}
