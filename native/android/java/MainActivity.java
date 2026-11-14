package __PACKAGE__;

import android.content.res.Configuration;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        paintWebViewBackground();
    }

    // Между запуском окна и первой отрисовкой CSS виден фон WebView: белый прямоугольник
    // и есть та вспышка при запуске и при возврате из виджета. Красим его в цвет неба темы.
    private void paintWebViewBackground() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        webView.setBackgroundColor(night ? 0xFF101A33 : 0xFF8BD8FF);
    }
}
