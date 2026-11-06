package com.sismorcego

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import java.io.File
import java.util.concurrent.Executors

class SismorcegoDeviceModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "SismorcegoDeviceProfile").apply { isDaemon = true }
  }
  private var capabilities: Map<String, Any>? = null
  override fun getName() = "SismorcegoDevice"

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    worker.execute {
      try {
        if (capabilities == null) {
          val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
          val memory = ActivityManager.MemoryInfo().also { manager.getMemoryInfo(it) }
          // Optional kernel information. Missing/restricted sysfs is normal;
          // never benchmark the processor or require additional permissions.
          val mhz = try {
            File("/sys/devices/system/cpu/cpufreq").listFiles()?.take(12)
              ?.mapNotNull { policy ->
                try {
                  File(policy, "cpuinfo_max_freq").readText().trim().toDoubleOrNull()?.div(1000)
                    ?.takeIf { it in 100.0..10000.0 }
                }
                catch (_: Exception) { null }
              }?.maxOrNull() ?: 0.0
          } catch (_: Exception) { 0.0 }
          capabilities = mapOf(
            "totalMemoryMb" to (memory.totalMem / 1048576.0),
            "availableMemoryMb" to (memory.availMem / 1048576.0),
            "lowMemory" to memory.lowMemory, "lowRamDevice" to manager.isLowRamDevice,
            "cpuCores" to Runtime.getRuntime().availableProcessors(),
            "cpuMaxMhz" to mhz, "androidSdk" to Build.VERSION.SDK_INT
          )
          if (BuildConfig.DEBUG) Log.d("SismorcegoDevice", capabilities.toString())
        }
        promise.resolve(Arguments.makeNativeMap(capabilities))
      } catch (error: Exception) {
        promise.reject("DEVICE_PROFILE_UNAVAILABLE", "Não foi possível consultar a capacidade do aparelho.", error)
      }
    }
  }
  override fun invalidate() { worker.shutdownNow(); super.invalidate() }
}
