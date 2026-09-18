package com.esakki.jarvis

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import android.widget.*
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private val prefs by lazy { getSharedPreferences("jarvis", MODE_PRIVATE) }
    private val cloudUrl = "https://jarvis-ai-assistant-jet-ten.vercel.app"
    private lateinit var status: TextView
    private lateinit var codeInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        requestPermissionsIfNeeded()
        if (prefs.getString("deviceToken", null) != null) startPolling()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(40, 50, 40, 40) }
        val title = TextView(this).apply { text = "J.A.R.V.I.S Companion"; textSize = 28f }
        status = TextView(this).apply { text = "Not paired"; textSize = 18f }
        codeInput = EditText(this).apply { hint = "6-digit pairing code"; inputType = 2 }
        val pair = Button(this).apply { text = "PAIR THIS PHONE" }
        pair.setOnClickListener { pairPhone() }
        root.addView(title); root.addView(status); root.addView(codeInput); root.addView(pair)
        setContentView(root)
    }

    private fun requestPermissionsIfNeeded() {
        val missing = arrayOf(Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE).filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) ActivityCompat.requestPermissions(this, missing.toTypedArray(), 42)
    }

    private fun pairPhone() {
        val code = codeInput.text.toString().trim()
        if (!Regex("\\d{6}").matches(code)) { status.text = "Enter the 6-digit code from JARVIS."; return }
        status.text = "Pairing..."
        executor.execute {
            try {
                val body = JSONObject().put("code", code).put("deviceName", android.os.Build.MODEL).toString()
                val result = post("/api/mobile?action=pair-complete", body, null)
                prefs.edit().putString("deviceToken", result.getString("deviceToken")).apply()
                runOnUiThread { status.text = "Paired: " + result.getString("deviceName"); startPolling() }
            } catch (e: Exception) { runOnUiThread { status.text = "Pairing failed: " + e.message } }
        }
    }

    private fun startPolling() {
        status.text = "JARVIS phone bridge online"
        executor.execute {
            while (!isFinishing) {
                try {
                    val token = prefs.getString("deviceToken", null) ?: break
                    val response = post("/api/mobile?action=poll", "{}", token)
                    if (response.has("command") && !response.isNull("command")) handleCommand(response.getJSONObject("command"), token)
                } catch (_: Exception) {}
                Thread.sleep(3000)
            }
        }
    }

    private fun handleCommand(command: JSONObject, token: String) {
        val id = command.getString("id")
        val action = command.getString("action")
        val value = command.optString("value", "")
        if (action == "call_contact" || action == "call_number") {
            runOnUiThread { confirmCall(id, action, value, token) }
        } else {
            executor.execute { post("/api/mobile?action=result", JSONObject().put("commandId", id).put("ok", false).put("error", "Unsupported mobile action: $action").toString(), token) }
        }
    }

    private fun confirmCall(id: String, action: String, value: String, token: String) {
        val number = if (action == "call_number") value else findContactNumber(value)
        if (number == null) {
            executor.execute { post("/api/mobile-result", JSONObject().put("commandId", id).put("ok", false).put("error", "Contact not found: $value").toString(), token) }
            return
        }
        AlertDialog.Builder(this).setTitle("JARVIS phone call")
            .setMessage("Call " + if (action == "call_number") number else value + " now?")
            .setNegativeButton("CANCEL") { _, _ -> executor.execute { post("/api/mobile-result", JSONObject().put("commandId", id).put("ok", false).put("error", "Call cancelled by user.").toString(), token) } }
            .setPositiveButton("CALL") { _, _ ->
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                    executor.execute { post("/api/mobile-result", JSONObject().put("commandId", id).put("ok", false).put("error", "CALL_PHONE permission is not granted.").toString(), token) }; return@setPositiveButton
                }
                startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(number))))
                executor.execute { post("/api/mobile-result", JSONObject().put("commandId", id).put("ok", true).put("message", "Calling $number.").toString(), token) }
            }.show()
    }

    private fun findContactNumber(name: String): String? {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return null
        val cursor = contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER), ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?", arrayOf("%$name%"), null) ?: return null
        cursor.use { return if (it.moveToFirst()) it.getString(0) else null }
    }

    private fun post(path: String, body: String, token: String?): JSONObject {
        val connection = (URL(cloudUrl + path).openConnection() as HttpURLConnection).apply { requestMethod = "POST"; connectTimeout = 8000; readTimeout = 10000; doOutput = true; setRequestProperty("Content-Type", "application/json"); if (token != null) setRequestProperty("Authorization", "Bearer $token") }
        connection.outputStream.use { it.write(body.toByteArray()) }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        return JSONObject(stream.bufferedReader().readText())
    }

    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }
}