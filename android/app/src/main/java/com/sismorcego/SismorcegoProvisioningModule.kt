package com.sismorcego

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

/** Team selects a short-lived provisioning file through Android's picker.
 * No exported credential receiver, deep link, clipboard or storage permission. */
class SismorcegoProvisioningModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var pending: Promise? = null
  private val requestCode = 7402
  private val listener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, code: Int, result: Int, data: Intent?) {
      if (code != requestCode) return
      val promise = pending ?: return
      pending = null
      val uri = data?.data
      if (result != Activity.RESULT_OK || uri == null) { promise.resolve(null); return }
      Thread {
        try {
          val stream = reactApplicationContext.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("Arquivo indisponível")
          val output = ByteArrayOutputStream()
          stream.use { input ->
            val buffer = ByteArray(4096)
            while (true) {
              val count = input.read(buffer)
              if (count < 0) break
              require(output.size() + count <= 65536) { "Arquivo muito grande" }
              output.write(buffer, 0, count)
            }
          }
          promise.resolve(output.toString("UTF-8"))
        } catch (_: Exception) {
          promise.reject("PROVISIONING_READ_FAILED", "Não foi possível ler o arquivo de configuração.")
        }
      }.start()
    }
  }
  init { context.addActivityEventListener(listener) }
  override fun getName() = "SismorcegoProvisioning"
  @ReactMethod fun selectConfiguration(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      if (pending != null) { promise.reject("PROVISIONING_BUSY", "Uma seleção já está aberta."); return@runOnUiThread }
      try {
        val activity = reactApplicationContext.currentActivity ?: throw IllegalStateException()
        pending = promise
        activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "application/json"
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }, requestCode)
      } catch (_: Exception) {
        pending = null
        promise.reject("PROVISIONING_UNAVAILABLE", "Não foi possível abrir a seleção de arquivo.")
      }
    }
  }
  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(listener)
    pending?.resolve(null); pending = null
    super.invalidate()
  }
}
