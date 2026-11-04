package com.sismorcego

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import java.io.File

/** Salva a ficha no local escolhido pelo usuário, sem permissão de armazenamento. */
class SismorcegoDocumentsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private data class SaveRequest(val source: File, val promise: Promise)
  private var pending: SaveRequest? = null
  private val requestCode = 7401
  private val listener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, code: Int, result: Int, data: Intent?) {
      if (code != requestCode) return
      val request = pending ?: return
      pending = null
      val uri = data?.data
      if (result != Activity.RESULT_OK || uri == null) {
        request.promise.resolve(null)
        return
      }
      Thread {
        try {
          val output = reactApplicationContext.contentResolver.openOutputStream(uri, "w")
            ?: throw IllegalStateException("Não foi possível abrir o destino.")
          output.use { target -> request.source.inputStream().use { it.copyTo(target) } }
          request.promise.resolve("saved")
        } catch (error: Exception) {
          request.promise.reject("PDF_SAVE_FAILED", "Não foi possível salvar a ficha em PDF.", error)
        }
      }.start()
    }
  }

  init { context.addActivityEventListener(listener) }
  override fun getName() = "SismorcegoDocuments"

  @ReactMethod
  fun savePdf(sourcePath: String, fileName: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      if (pending != null) {
        promise.reject("PDF_SAVE_BUSY", "Já existe uma seleção de destino aberta.")
        return@runOnUiThread
      }
      try {
        val activity = reactApplicationContext.currentActivity
          ?: throw IllegalStateException("Aplicativo sem tela ativa.")
        val source = File(sourcePath).canonicalFile
        val cache = reactApplicationContext.cacheDir.canonicalPath + File.separator
        require(source.path.startsWith(cache) && source.isFile && source.extension == "pdf") {
          "Arquivo PDF indisponível no cache do aplicativo."
        }
        pending = SaveRequest(source, promise)
        activity.startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "application/pdf"
          putExtra(Intent.EXTRA_TITLE, File(fileName).name)
        }, requestCode)
      } catch (error: Exception) {
        pending = null
        promise.reject("PDF_SAVE_FAILED", "Não foi possível abrir o seletor de arquivos.", error)
      }
    }
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(listener)
    pending?.promise?.resolve(null)
    pending = null
    super.invalidate()
  }
}
