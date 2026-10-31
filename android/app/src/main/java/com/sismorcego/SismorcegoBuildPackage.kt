package com.sismorcego

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.uimanager.ViewManager

class SismorcegoBuildModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "SismorcegoBuild"
  override fun getConstants(): MutableMap<String, Any> = mutableMapOf(
    "realFirebase" to BuildConfig.SISMORCEGO_REAL_FIREBASE,
    "firebaseEmulator" to (BuildConfig.DEBUG && BuildConfig.SISMORCEGO_USE_EMULATORS)
  )
}

class SismorcegoBuildPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(SismorcegoBuildModule(context), SismorcegoDocumentsModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
