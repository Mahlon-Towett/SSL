package org.smart.signbridgeai;



import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private TextView statusText;
    private SwipeRefreshLayout swipeRefreshLayout;

    // Your laptop's IP address - change this to your laptop's actual IP
    private static final String BASE_URL = "http://192.168.1.100:3000"; // Change this IP!
    private static final String FALLBACK_URL = "http://10.0.0.2:3000"; // Alternative IP

    private static final int PERMISSION_REQUEST_CODE = 1001;
    private boolean isConnected = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Set full screen and modern UI
        setupModernUI();

        setContentView(R.layout.activity_main);

        // Initialize views
        initializeViews();

        // Request necessary permissions
        requestPermissions();

        // Setup WebView
        setupWebView();

        // Check connection and load app
        checkConnectionAndLoad();
    }

    private void setupModernUI() {
        // Hide status bar and make app full screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#0f172a")); // Dark theme
            window.setNavigationBarColor(Color.parseColor("#0f172a"));
        }

        // Hide action bar for modern look
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }
    }

    private void initializeViews() {
        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progressBar);
        statusText = findViewById(R.id.statusText);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);

        // Setup swipe to refresh
        swipeRefreshLayout.setOnRefreshListener(() -> {
            refreshApp();
        });

        // Modern color scheme
        swipeRefreshLayout.setColorSchemeColors(
                Color.parseColor("#8b5cf6"),
                Color.parseColor("#06b6d4"),
                Color.parseColor("#10b981")
        );
    }

    private void requestPermissions() {
        List<String> permissions = new ArrayList<>();

        // Check for camera permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA);
        }

        // Check for microphone permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }

        // Check for internet permission (usually granted automatically)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.INTERNET)
                != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.INTERNET);
        }

        // Request permissions if needed
        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(this,
                    permissions.toArray(new String[0]),
                    PERMISSION_REQUEST_CODE);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings webSettings = webView.getSettings();

        // Enable JavaScript and modern web features
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);

        // Modern caching (replaces deprecated setAppCacheEnabled)
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Enable media features for sign language app
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);

        // Security settings for local development
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            webSettings.setAllowFileAccessFromFileURLs(true);
            webSettings.setAllowUniversalAccessFromFileURLs(true);
        }

        // Modern browser features
        webSettings.setBuiltInZoomControls(false);
        webSettings.setDisplayZoomControls(false);
        webSettings.setSupportZoom(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);

        // Hardware acceleration for better performance
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            webSettings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);
        }

        // Geolocation and other permissions
        webSettings.setGeolocationEnabled(true);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);

        // Set user agent to make it look like a modern browser
        webSettings.setUserAgentString(webSettings.getUserAgentString() +
                " SignLanguageApp/1.0");

        // Setup WebView client for navigation handling
        webView.setWebViewClient(new SignLanguageWebViewClient());

        // Setup Chrome client for advanced features
        webView.setWebChromeClient(new SignLanguageWebChromeClient());
    }

    private void checkConnectionAndLoad() {
        if (isNetworkAvailable()) {
            showStatus("Connecting to Sign Language Translator...", true);
            loadSignLanguageApp();
        } else {
            showConnectionError();
        }
    }

    private void loadSignLanguageApp() {
        // Try primary URL first
        webView.loadUrl(BASE_URL);

        // FIXED: Add timeout to force loading screen to hide after 10 seconds
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (statusText.getVisibility() == View.VISIBLE) {
                // Force hide loading screen if still showing after 10 seconds
                hideStatus();
                Toast.makeText(MainActivity.this,
                        "App loaded - WebSocket connecting in background",
                        Toast.LENGTH_LONG).show();
            }
        }, 10000); // 10 second timeout

        // If primary fails, we'll try fallback in WebViewClient
    }

    private void refreshApp() {
        if (isNetworkAvailable()) {
            webView.reload();
        } else {
            swipeRefreshLayout.setRefreshing(false);
            showConnectionError();
        }
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager connectivityManager =
                (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
        return activeNetworkInfo != null && activeNetworkInfo.isConnected();
    }

    private String getWifiIPAddress() {
        WifiManager wifiManager = (WifiManager) getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
        WifiInfo wifiInfo = wifiManager.getConnectionInfo();
        int ip = wifiInfo.getIpAddress();

        return String.format("%d.%d.%d.%d",
                (ip & 0xff),
                (ip >> 8 & 0xff),
                (ip >> 16 & 0xff),
                (ip >> 24 & 0xff));
    }

    private void showStatus(String message, boolean showProgress) {
        statusText.setText(message);
        statusText.setVisibility(View.VISIBLE);
        progressBar.setVisibility(showProgress ? View.VISIBLE : View.GONE);
        webView.setVisibility(View.GONE);
    }

    private void hideStatus() {
        statusText.setVisibility(View.GONE);
        progressBar.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void showConnectionError() {
        showStatus("Unable to connect to Sign Language Translator", false);

        new AlertDialog.Builder(this)
                .setTitle("Connection Error")
                .setMessage("Cannot connect to the Sign Language Translator.\n\n" +
                        "Please ensure:\n" +
                        "• Your laptop and phone are on the same WiFi\n" +
                        "• The React app is running on your laptop\n" +
                        "• The IP address in the app is correct\n\n" +
                        "Current WiFi IP: " + getWifiIPAddress())
                .setPositiveButton("Retry", (dialog, which) -> {
                    checkConnectionAndLoad();
                })
                .setNegativeButton("Settings", (dialog, which) -> {
                    showIPSettingsDialog();
                })
                .setNeutralButton("Exit", (dialog, which) -> {
                    finish();
                })
                .setCancelable(false)
                .show();
    }

    private void showIPSettingsDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Network Configuration")
                .setMessage("To connect to your Sign Language Translator:\n\n" +
                        "1. Find your laptop's IP address:\n" +
                        "   • Windows: ipconfig\n" +
                        "   • Mac/Linux: ifconfig\n\n" +
                        "2. Update the IP address in MainActivity.java:\n" +
                        "   BASE_URL = \"http://YOUR_IP:3000\"\n\n" +
                        "3. Make sure React app is running:\n" +
                        "   npm start\n\n" +
                        "Current target: " + BASE_URL)
                .setPositiveButton("OK", null)
                .show();
    }

    // Custom WebViewClient for better navigation and error handling
    private class SignLanguageWebViewClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();

            // Keep navigation within our app
            if (url.startsWith("http://") || url.startsWith("https://")) {
                if (url.contains("localhost") || url.contains("192.168.") ||
                        url.contains("10.0.0.") || url.contains("3000")) {
                    return false; // Let WebView handle it
                }
            }

            // Open external links in browser
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            showStatus("Loading Sign Language Translator...", true);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            swipeRefreshLayout.setRefreshing(false);

            // FIXED: Hide loading screen immediately when page finishes loading
            hideStatus();

            if (!isConnected) {
                isConnected = true;
                Toast.makeText(MainActivity.this,
                        "✅ Connected to Sign Language Translator!",
                        Toast.LENGTH_SHORT).show();
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request,
                                    WebResourceError error) {
            super.onReceivedError(view, request, error);

            if (request.isForMainFrame()) {
                // Try fallback URL
                if (!BASE_URL.equals(FALLBACK_URL)) {
                    showStatus("Trying alternative connection...", true);
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        webView.loadUrl(FALLBACK_URL);
                    }, 1000);
                } else {
                    showConnectionError();
                }
            }
        }
    }

    // Custom WebChromeClient for permissions and progress
    private class SignLanguageWebChromeClient extends WebChromeClient {

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            // Grant camera and microphone permissions for the web app
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                String[] requestedResources = request.getResources();
                for (String resource : requestedResources) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) ||
                            PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {

                        // Check if we have native permissions
                        if (ContextCompat.checkSelfPermission(MainActivity.this,
                                Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
                                ContextCompat.checkSelfPermission(MainActivity.this,
                                        Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {

                            request.grant(requestedResources);
                            return;
                        }
                    }
                }
                request.deny();
            }
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin,
                                                       GeolocationPermissions.Callback callback) {
            // Grant geolocation if needed
            callback.invoke(origin, true, false);
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
            // Log web console messages for debugging
            android.util.Log.d("WebConsole",
                    consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() +
                            " - " + consoleMessage.message());
            return true;
        }

        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            super.onProgressChanged(view, newProgress);
            // You could update a progress bar here if needed
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions,
                                           int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean allPermissionsGranted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allPermissionsGranted = false;
                    break;
                }
            }

            if (allPermissionsGranted) {
                Toast.makeText(this,
                        "✅ Permissions granted! Camera and microphone ready.",
                        Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this,
                        "⚠️ Some permissions denied. App may not work fully.",
                        Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            // Show exit confirmation
            new AlertDialog.Builder(this)
                    .setTitle("Exit App")
                    .setMessage("Are you sure you want to exit the Sign Language Translator?")
                    .setPositiveButton("Exit", (dialog, which) -> {
                        super.onBackPressed();
                    })
                    .setNegativeButton("Cancel", null)
                    .show();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}