package __PACKAGE__;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long FIRST_FRAME_TIMEOUT_MS = 2000L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        WebView webView = bridgeWebView();
        if (webView == null) return;
        paintWebViewBackground(webView);
        showAtFirstFrame(webView);
    }

    private WebView bridgeWebView() {
        if (getBridge() == null) return null;
        return getBridge().getWebView();
    }

    // Между стартовым окном и первой отрисовкой CSS виден фон WebView: белый прямоугольник
    // и есть та вспышка при запуске и при возврате из виджета. Красим его в цвет неба темы.
    private void paintWebViewBackground(WebView webView) {
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        webView.setBackgroundColor(night ? 0xFF101A33 : 0xFF8BD8FF);
    }

    // Пока страница не отрисовала первый кадр, показываем фон окна (цвет неба из темы),
    // затем проявляем WebView. Таймаут на случай, если кадр так и не придёт.
    private void showAtFirstFrame(final WebView webView) {
        if (Build.VERSION.SDK_INT < 23) return;
        webView.setAlpha(0f);
        webView.postVisualStateCallback(0L, new WebView.VisualStateCallback() {
            @Override
            public void onComplete(long requestId) {
                reveal(webView);
            }
        });
        webView.postDelayed(new Runnable() {
            @Override
            public void run() {
                reveal(webView);
            }
        }, FIRST_FRAME_TIMEOUT_MS);
    }

    private void reveal(WebView webView) {
        if (webView.getAlpha() >= 1f) return;
        webView.animate().alpha(1f).setDuration(120L).start();
    }
}
