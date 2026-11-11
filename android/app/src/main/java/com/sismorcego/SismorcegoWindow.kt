package com.sismorcego

import android.app.Activity
import android.graphics.Rect
import android.os.Build
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager
import java.util.concurrent.CopyOnWriteArraySet
import kotlin.math.abs
import kotlin.math.max

data class SismorcegoWindowSnapshot(
  val visible: Boolean = false, val transitioning: Boolean = false,
  val height: Double = 0.0, val keyboardTop: Double = 0.0,
  val viewportBottomPx: Int = 0, val sequence: Long = 0
) {
  fun values(): Map<String, Any> = mapOf(
    "visible" to visible, "transitioning" to transitioning, "height" to height,
    "keyboardTop" to keyboardTop, "sequence" to sequence.toDouble()
  )
}
object SismorcegoWindowState {
  @Volatile var snapshot = SismorcegoWindowSnapshot()
    private set
  private val listeners = CopyOnWriteArraySet<(SismorcegoWindowSnapshot) -> Unit>()
  fun subscribe(listener: (SismorcegoWindowSnapshot) -> Unit) { listeners.add(listener) }
  fun unsubscribe(listener: (SismorcegoWindowSnapshot) -> Unit) { listeners.remove(listener) }
  fun update(next: SismorcegoWindowSnapshot) {
    val previous = snapshot
    if (next.copy(sequence = 0) == previous.copy(sequence = 0)) return
    snapshot = next.copy(sequence = previous.sequence + 1)
    if (BuildConfig.DEBUG && (previous.visible != snapshot.visible || previous.transitioning != snapshot.transitioning || !snapshot.transitioning))
      Log.d("SismorcegoWindow", "ime=${snapshot.visible} moving=${snapshot.transitioning} height=${snapshot.height} bottom=${snapshot.viewportBottomPx}")
    listeners.forEach { it(snapshot) }
  }
}

// One owner of Android IME space. Modern edge-to-edge windows do not use a
// second JS KeyboardAvoidingView adjustment; older Android keeps adjustResize.
class SismorcegoWindowController(private val activity: Activity) {
  private val content = activity.findViewById<ViewGroup>(android.R.id.content)
  private val animations = mutableSetOf<WindowInsetsAnimationCompat>()
  private val density = activity.resources.displayMetrics.density.toDouble()
  private val initialBottomPadding = content.paddingBottom
  private var revision = 0
  private var pendingLegacyLayout: View.OnLayoutChangeListener? = null
  private var lastInsets: WindowInsetsCompat? = null
  private val globalLayout = ViewTreeObserver.OnGlobalLayoutListener {
    if (animations.isEmpty()) ViewCompat.getRootWindowInsets(content)?.let { apply(it, true) }
  }
  init {
    if (Build.VERSION.SDK_INT >= 30) {
      WindowCompat.setDecorFitsSystemWindows(activity.window, false)
      val mode = activity.window.attributes.softInputMode
      activity.window.setSoftInputMode((mode and WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST.inv()) or
        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING)
    }
    ViewCompat.setOnApplyWindowInsetsListener(content) { _, insets ->
      lastInsets = insets
      if (animations.isEmpty()) apply(insets, true)
      insets
    }
    ViewCompat.setWindowInsetsAnimationCallback(content, object :
      WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
      override fun onPrepare(animation: WindowInsetsAnimationCompat) {
        if (animation.typeMask and WindowInsetsCompat.Type.ime() == 0) return
        animations.add(animation); revision += 1
        SismorcegoWindowState.update(SismorcegoWindowState.snapshot.copy(transitioning = true))
      }
      override fun onProgress(insets: WindowInsetsCompat, runningAnimations: MutableList<WindowInsetsAnimationCompat>): WindowInsetsCompat {
        if (runningAnimations.any { it.typeMask and WindowInsetsCompat.Type.ime() != 0 }) apply(insets, false)
        return insets
      }
      override fun onEnd(animation: WindowInsetsAnimationCompat) {
        if (!animations.remove(animation) || animations.isNotEmpty()) return
        (ViewCompat.getRootWindowInsets(content) ?: lastInsets)?.let { apply(it, true) }
      }
    })
    content.viewTreeObserver.addOnGlobalLayoutListener(globalLayout)
    requestInsets()
  }
  private fun apply(insets: WindowInsetsCompat, settle: Boolean) {
    lastInsets = insets
    val ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
    val visible = insets.isVisible(WindowInsetsCompat.Type.ime()) || ime > 0
    if (Build.VERSION.SDK_INT >= 30 && content.paddingBottom != initialBottomPadding + ime) {
      content.setPadding(content.paddingLeft, content.paddingTop, content.paddingRight, initialBottomPadding + ime)
    }
    val position = IntArray(2).also { content.getLocationOnScreen(it) }
    val viewportBottom = position[1] + content.height - content.paddingBottom
    val keyboardTop = if (Build.VERSION.SDK_INT >= 30) (content.rootView.height - ime).toDouble()
      else Rect().also { content.getWindowVisibleDisplayFrame(it) }.bottom.toDouble()
    val next = SismorcegoWindowSnapshot(visible, !settle || animations.isNotEmpty(),
      ime / density, keyboardTop / density, viewportBottom)
    // Legacy adjustResize changes the window bounds themselves. Keep its
    // existing layout guard; modern adjustNothing owns stable window bounds.
    if (Build.VERSION.SDK_INT < 30 && settle) {
      pendingLegacyLayout?.let { content.removeOnLayoutChangeListener(it) }; pendingLegacyLayout = null
      if (content.isLayoutRequested) {
        val request = ++revision
        SismorcegoWindowState.update(next.copy(transitioning = true))
        val listener = object : View.OnLayoutChangeListener {
          override fun onLayoutChange(v: View, l: Int, t: Int, r: Int, b: Int, ol: Int, ot: Int, or: Int, ob: Int) {
            content.removeOnLayoutChangeListener(this); pendingLegacyLayout = null
            if (request == revision && animations.isEmpty()) {
              val xy = IntArray(2).also { content.getLocationOnScreen(it) }
              SismorcegoWindowState.update(next.copy(viewportBottomPx = xy[1] + content.height - content.paddingBottom))
            }
          }
        }
        pendingLegacyLayout = listener; content.addOnLayoutChangeListener(listener)
        return
      }
    }
    // The IME callback owns the transition's end. Waiting for an unrelated
    // layout pass here leaves the dock blank after the keyboard has gone.
    // The native dock reconciles its position before drawing, independently
    // of the asynchronous React/Yoga layout that may still be catching up.
    SismorcegoWindowState.update(next)
  }
  fun requestInsets() { ViewCompat.requestApplyInsets(content) }
  fun dispose() {
    revision += 1; pendingLegacyLayout?.let { content.removeOnLayoutChangeListener(it) }
    if (content.viewTreeObserver.isAlive) content.viewTreeObserver.removeOnGlobalLayoutListener(globalLayout)
    ViewCompat.setOnApplyWindowInsetsListener(content, null)
    ViewCompat.setWindowInsetsAnimationCallback(content, null)
  }
}

class SismorcegoWindowModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "SismorcegoWindow"
  private var last = SismorcegoWindowSnapshot(sequence = -1)
  private val listener: (SismorcegoWindowSnapshot) -> Unit = { next ->
    // Native layout/dock follows every frame; React receives semantic changes
    // and the settled geometry, not a 60 Hz stream of rerenders.
    if (next.visible != last.visible || next.transitioning != last.transitioning || !next.transitioning) {
      last = next
      if (context.hasActiveReactInstance()) context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("sismorcego:windowState", Arguments.makeNativeMap(next.values()))
    }
  }
  override fun initialize() { super.initialize(); SismorcegoWindowState.subscribe(listener) }
  @ReactMethod fun getSnapshot(promise: Promise) { promise.resolve(Arguments.makeNativeMap(SismorcegoWindowState.snapshot.values())) }
  override fun invalidate() { SismorcegoWindowState.unsubscribe(listener); super.invalidate() }
}

private class KeyboardDockView(context: ThemedReactContext) : ReactViewGroup(context) {
  private val position = IntArray(2)
  private val listener: (SismorcegoWindowSnapshot) -> Unit = { syncVisibility() }
  private val preDraw = ViewTreeObserver.OnPreDrawListener {
    // Parent bounds can catch up without this view receiving onLayout.
    // Reconcile visible docks too, so a temporary offset cannot move them.
    syncVisibility()
    true
  }
  private fun canShowDock(): Boolean {
    val state = SismorcegoWindowState.snapshot
    if (state.visible || state.transitioning || width <= 0 || height <= 0 || state.viewportBottomPx <= 0) return false
    getLocationOnScreen(position)
    if (Build.VERSION.SDK_INT < 30) return abs(position[1] + height - state.viewportBottomPx) <= max(2, resources.displayMetrics.density.toInt())
    // Restore at the window's actual bottom in the SAME UI frame as IME end,
    // even if Yoga still has the old keyboard-raised coordinates. Translation
    // does not trigger another layout; it returns to zero as React catches up.
    val layoutBottom = position[1] + height - translationY
    val offset = state.viewportBottomPx - layoutBottom
    if (abs(translationY - offset) > 0.5f) translationY = offset
    return true
  }
  // Fabric writes visibility AFTER view.layout(). Guard that write as well as
  // onLayout, otherwise any size/prop update can reveal the dock above the IME.
  override fun setVisibility(requested: Int) {
    super.setVisibility(if (requested == View.VISIBLE && isAttachedToWindow && !canShowDock()) View.INVISIBLE else requested)
  }
  private fun syncVisibility() {
    val state = SismorcegoWindowState.snapshot
    val next = if (canShowDock()) View.VISIBLE else View.INVISIBLE
    if (BuildConfig.DEBUG && visibility != next) Log.d("SismorcegoDock", "visible=${next == View.VISIBLE} ime=${state.visible} moving=${state.transitioning} y=${position[1]} h=$height bottom=${state.viewportBottomPx}")
    visibility = next
  }
  override fun onAttachedToWindow() {
    super.onAttachedToWindow(); SismorcegoWindowState.subscribe(listener)
    viewTreeObserver.addOnPreDrawListener(preDraw); syncVisibility()
  }
  override fun onDetachedFromWindow() {
    SismorcegoWindowState.unsubscribe(listener)
    if (viewTreeObserver.isAlive) viewTreeObserver.removeOnPreDrawListener(preDraw)
    super.onDetachedFromWindow()
  }
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom); syncVisibility()
  }
}
class SismorcegoKeyboardDockManager : ReactViewManager() {
  override fun getName() = "SismorcegoKeyboardDock"
  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = KeyboardDockView(context)
}
