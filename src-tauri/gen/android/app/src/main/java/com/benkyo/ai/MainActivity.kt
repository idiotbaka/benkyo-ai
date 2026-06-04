package com.benkyo.ai

import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

class MainActivity : TauriActivity() {
  private var launchOverlay: View? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)

    val contentView = findViewById<View>(android.R.id.content)

    ViewCompat.setOnApplyWindowInsetsListener(contentView) { view, windowInsets ->
      val types = WindowInsetsCompat.Type.systemBars() or
        WindowInsetsCompat.Type.displayCutout()
      val insets = windowInsets.getInsets(types)

      view.updatePadding(
        left = insets.left,
        top = insets.top,
        right = insets.right,
        bottom = insets.bottom,
      )

      // The native container handles the system bars. Forward zeroed values so
      // WebView does not apply the same safe-area inset again inside the page.
      WindowInsetsCompat.Builder(windowInsets)
        .setInsets(types, Insets.NONE)
        .build()
    }

    contentView.requestApplyInsetsWhenAttached()
    showLaunchOverlay(webView)
  }

  private fun showLaunchOverlay(webView: WebView) {
    val decorView = window.decorView as? ViewGroup ?: return
    if (launchOverlay != null) return

    val overlay = FrameLayout(this).apply {
      setBackgroundColor(getColor(R.color.splash_background))
      isClickable = true
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
      elevation = 1000f
    }

    val launchImage = ImageView(this).apply {
      setImageResource(R.drawable.launcher)
      scaleType = ImageView.ScaleType.FIT_CENTER
      adjustViewBounds = false
      contentDescription = null
    }

    overlay.addView(
      launchImage,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ).apply {
        gravity = Gravity.CENTER
      },
    )

    decorView.addView(
      overlay,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      ),
    )

    launchOverlay = overlay
    waitForWebViewContent(webView)
  }

  private fun waitForWebViewContent(webView: WebView, attempt: Int = 0) {
    if (launchOverlay == null) return

    val isReady = webView.progress >= 100 && webView.contentHeight > 0
    if (isReady || attempt >= MAX_SPLASH_CHECKS) {
      webView.postDelayed({ hideLaunchOverlay() }, SPLASH_HIDE_DELAY_MS)
      return
    }

    webView.postDelayed(
      { waitForWebViewContent(webView, attempt + 1) },
      SPLASH_CHECK_INTERVAL_MS,
    )
  }

  private fun hideLaunchOverlay() {
    val overlay = launchOverlay ?: return
    window.setBackgroundDrawable(ColorDrawable(getColor(R.color.splash_background)))

    overlay.animate()
      .alpha(0f)
      .setDuration(SPLASH_FADE_MS)
      .withEndAction {
        (overlay.parent as? ViewGroup)?.removeView(overlay)
        if (launchOverlay === overlay) {
          launchOverlay = null
        }
      }
      .start()
  }

  private fun View.requestApplyInsetsWhenAttached() {
    if (isAttachedToWindow) {
      ViewCompat.requestApplyInsets(this)
      return
    }

    addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
      override fun onViewAttachedToWindow(view: View) {
        view.removeOnAttachStateChangeListener(this)
        ViewCompat.requestApplyInsets(view)
      }

      override fun onViewDetachedFromWindow(view: View) = Unit
    })
  }

  companion object {
    private const val SPLASH_CHECK_INTERVAL_MS = 100L
    private const val SPLASH_HIDE_DELAY_MS = 80L
    private const val SPLASH_FADE_MS = 180L
    private const val MAX_SPLASH_CHECKS = 80
  }
}
