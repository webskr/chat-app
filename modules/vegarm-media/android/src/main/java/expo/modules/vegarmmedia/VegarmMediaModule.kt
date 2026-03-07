package expo.modules.vegarmmedia

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class VegarmMediaModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VegarmMedia")

    Function("getPublicMediaDirectory") {
      val context: Context = appContext.reactContext ?: return@Function ""
      
      // Get the primary external media directory (Android/media/com.skr.vegarm/)
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isNotEmpty() && mediaDirs[0] != null) {
          val mediaDir = mediaDirs[0]
          
          // Create the app-specific subfolder inside Android/media/com.skr.vegarm/
          val vegarmDir = File(mediaDir, "Vegarm")
          if (!vegarmDir.exists()) {
              vegarmDir.mkdirs()
          }
          
          // Pre-create all subdirectories natively to avoid Expo FileSystem Scoped Storage errors
          val subFolders = listOf("images", "videos", "documents", "thumbnails", "backups", "cache")
          for (folder in subFolders) {
              val subDir = File(vegarmDir, folder)
              if (!subDir.exists()) {
                  subDir.mkdirs()
              }
          }
          
          // Return absolute URI with file:// scheme and trailing slash
          return@Function "file://${vegarmDir.absolutePath}/"
      }
      
      // Fallback: native path not available
      return@Function ""
    }

    /**
     * Downloads a file from a URL using native Java HTTP, writing directly into
     * Android/media/com.skr.vegarm/Vegarm/<subfolder>/<filename>
     * This bypasses Expo FileSystem which lacks WRITE access to Android/media.
     *
     * @param url       The full HTTP/HTTPS URL to download from.
     * @param filename  The target filename (e.g., "msg_535.jpg").
     * @param subfolder The subfolder category: "images", "videos", "documents", etc.
     * @return The absolute file:// URI of the saved file, or empty string on failure.
     */
    AsyncFunction("downloadMedia") { url: String, filename: String, subfolder: String ->
      val context: Context = appContext.reactContext ?: return@AsyncFunction ""
      
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
          return@AsyncFunction ""
      }
      
      val mediaDir = mediaDirs[0]
      val destDir = File(File(mediaDir, "Vegarm"), subfolder)
      if (!destDir.exists()) {
          destDir.mkdirs()
      }
      
      val destFile = File(destDir, filename)
      
      // If already downloaded, return cached path
      if (destFile.exists() && destFile.length() > 0) {
          return@AsyncFunction "file://${destFile.absolutePath}"
      }
      
      // Native HTTP download using Java APIs — no Expo FileSystem permission restrictions
      val connection = URL(url).openConnection() as HttpURLConnection
      connection.connectTimeout = 30_000
      connection.readTimeout = 60_000
      connection.requestMethod = "GET"
      connection.connect()
      
      if (connection.responseCode != HttpURLConnection.HTTP_OK) {
          connection.disconnect()
          throw Exception("Server returned HTTP ${connection.responseCode} for $url")
      }
      
      connection.inputStream.use { input ->
          FileOutputStream(destFile).use { output ->
              input.copyTo(output)
          }
      }
      connection.disconnect()
      
      return@AsyncFunction "file://${destFile.absolutePath}"
    }
  }
}
