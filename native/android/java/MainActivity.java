package __PACKAGE__;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long FIRST_FRAME_TIMEOUT_MS = 2000L;
    // Ярлык долгого нажатия на иконку передаёт режим быстрого добавления.
    private static final String QUICK_ADD_EXTRA = "quick_add";
    private static String pendingQuickAdd = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        captureQuickAdd(getIntent());
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        WebView webView = bridgeWebView();
        if (webView == null) return;
        paintWebViewBackground(webView);
        showAtFirstFrame(webView);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // BridgeActivity не вызывает setIntent, поэтому забираем ярлык здесь.
        captureQuickAdd(intent);
    }

    static String consumeQuickAdd() {
        String mode = pendingQuickAdd;
        pendingQuickAdd = null;
        return mode;
    }

    private static void captureQuickAdd(Intent intent) {
        if (intent == null) return;
        String mode = intent.getStringExtra(QUICK_ADD_EXTRA);
        if (mode == null || mode.isEmpty()) return;
        intent.removeExtra(QUICK_ADD_EXTRA);
        pendingQuickAdd = mode;
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
        // Без анимации: плавное проявление — это и есть видимая «белая затухающая» вспышка.
        webView.setAlpha(1f);
    }
}
