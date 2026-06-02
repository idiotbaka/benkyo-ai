package com.benkyo.ai

import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

class MainActivity : TauriActivity() {
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
}
