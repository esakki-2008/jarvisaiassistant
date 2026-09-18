package com.esakki.jarvis

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import android.view.Gravity
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.widget.*
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.cos
import kotlin.math.sin

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private val prefs by lazy { getSharedPreferences("jarvis", MODE_PRIVATE) }
    private val cloudUrl = "https://jarvis-ai-assistant-jet-ten.vercel.app"
    private lateinit var status: TextView
    private lateinit var pairingPanel: LinearLayout
    private lateinit var codeInput: EditText
    private lateinit var reactor: ReactorView
    private var pollingStarted = false

    private val cyan = Color.rgb(0, 229, 255)
    private val dimCyan = Color.rgb(0, 120, 145)
    private val bg = Color.rgb(2, 8, 12)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        buildUi()
        requestPermissionsIfNeeded()
        if (prefs.getString("deviceToken", null) != null) {
            showPairedState()
            startPolling()
        } else {
            showPairingState()
        }
    }

    private fun buildUi() {
        val root = FrameLayout(this).apply { setBackgroundColor(bg) }
        root.addView(HudBackgroundView(this), FrameLayout.LayoutParams(-1, -1))

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(22), dp(18), dp(22), dp(18))
        }

        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val brand = TextView(this).apply {
            text = "J.A.R.V.I.S"
            textSize = 15f
            letterSpacing = 0.28f
            setTextColor(cyan)
            typeface = Typeface.DEFAULT_BOLD
        }
        val core = TextView(this).apply {
            text = "MOBILE CORE"
            textSize = 9f
            letterSpacing = 0.16f
            gravity = Gravity.CENTER_VERTICAL
            setTextColor(dimCyan)
        }
        top.addView(brand, LinearLayout.LayoutParams(0, dp(42), 1f))
        top.addView(core)

        val title = TextView(this).apply {
            text = "PERSONAL AI ASSISTANT"
            textSize = 9f
            letterSpacing = 0.22f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(105, 175, 190))
        }

        reactor = ReactorView(this)
        content.addView(top)
        content.addView(title, LinearLayout.LayoutParams(-1, dp(28)))
        content.addView(reactor, LinearLayout.LayoutParams(dp(310), dp(310)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            topMargin = dp(6)
        })

        status = TextView(this).apply {
            text = "SYSTEM STANDBY"
            textSize = 12f
            letterSpacing = 0.18f
            gravity = Gravity.CENTER
            setTextColor(cyan)
            typeface = Typeface.DEFAULT_BOLD
        }
        content.addView(status, LinearLayout.LayoutParams(-1, dp(30)))

        val sub = TextView(this).apply {
            text = "PHONE BRIDGE  •  SECURE CLOUD LINK"
            textSize = 8f
            letterSpacing = 0.12f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(65, 120, 135))
        }
        content.addView(sub, LinearLayout.LayoutParams(-1, dp(22)))

        pairingPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = panelDrawable()
        }

        val pairLabel = TextView(this).apply {
            text = "PAIR THIS PHONE"
            textSize = 10f
            letterSpacing = 0.16f
            gravity = Gravity.CENTER
            setTextColor(cyan)
        }
        codeInput = EditText(this).apply {
            hint = "6-DIGIT CODE"
            setHintTextColor(Color.rgb(65, 105, 115))
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            inputType = 2
            maxLines = 1
            letterSpacing = 0.12f
            background = inputDrawable()
        }
        val pair = TextView(this).apply {
            text = "PAIR PHONE"
            textSize = 10f
            letterSpacing = 0.15f
            gravity = Gravity.CENTER
            setTextColor(Color.BLACK)
            background = buttonDrawable()
            setOnClickListener { pairPhone() }
        }
        pairingPanel.addView(pairLabel, LinearLayout.LayoutParams(-1, dp(24)))
        pairingPanel.addView(codeInput, LinearLayout.LayoutParams(-1, dp(46)).apply { topMargin = dp(5) })
        pairingPanel.addView(pair, LinearLayout.LayoutParams(-1, dp(42)).apply { topMargin = dp(7) })
        content.addView(pairingPanel, LinearLayout.LayoutParams(-1, dp(145)).apply { topMargin = dp(10) })

        val footer = TextView(this).apply {
            text = "CALLS  •  COMMANDS  •  JARVIS CLOUD"
            textSize = 7f
            letterSpacing = 0.12f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(48, 88, 98))
        }
        content.addView(footer, LinearLayout.LayoutParams(-1, dp(24)))

        root.addView(content, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
    }

    private fun showPairingState() {
        pairingPanel.visibility = View.VISIBLE
        status.text = "AWAITING PAIRING"
        reactor.mode = ReactorView.Mode.PAIRING
    }

    private fun showPairedState() {
        pairingPanel.visibility = View.GONE
        status.text = "JARVIS ONLINE"
        reactor.mode = ReactorView.Mode.ONLINE
    }

    private fun requestPermissionsIfNeeded() {
        val missing = arrayOf(Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE)
            .filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) ActivityCompat.requestPermissions(this, missing.toTypedArray(), 42)
    }

    private fun pairPhone() {
        val code = codeInput.text.toString().trim()
        if (!Regex("\\d{6}").matches(code)) {
            status.text = "ENTER 6-DIGIT PAIRING CODE"
            reactor.mode = ReactorView.Mode.ERROR
            return
        }
        status.text = "PAIRING WITH JARVIS..."
        reactor.mode = ReactorView.Mode.WORKING
        executor.execute {
            try {
                val body = JSONObject().put("code", code).put("deviceName", android.os.Build.MODEL).toString()
                val result = post("/api/mobile?action=pair-complete", body, null)
                prefs.edit().putString("deviceToken", result.getString("deviceToken")).apply()
                runOnUiThread {
                    showPairedState()
                    startPolling()
                }
            } catch (_: Exception) {
                runOnUiThread {
                    status.text = "PAIRING FAILED"
                    reactor.mode = ReactorView.Mode.ERROR
                }
            }
        }
    }

    private fun startPolling() {
        if (pollingStarted) return
        pollingStarted = true
        executor.execute {
            while (!isFinishing) {
                try {
                    val token = prefs.getString("deviceToken", null) ?: break
                    val response = post("/api/mobile?action=poll", "{}", token)
                    if (response.has("command") && !response.isNull("command")) {
                        handleCommand(response.getJSONObject("command"), token)
                    }
                    runOnUiThread {
                        if (reactor.mode != ReactorView.Mode.WORKING) {
                            status.text = "JARVIS ONLINE"
                            reactor.mode = ReactorView.Mode.ONLINE
                        }
                    }
                } catch (_: Exception) {
                    runOnUiThread {
                        status.text = "CLOUD LINK RETRYING"
                        reactor.mode = ReactorView.Mode.WORKING
                    }
                }
                try { Thread.sleep(3000) } catch (_: InterruptedException) { break }
            }
        }
    }

    private fun handleCommand(command: JSONObject, token: String) {
        val id = command.getString("id")
        val action = command.getString("action")
        val value = command.optString("value", "")
        runOnUiThread {
            status.text = "COMMAND: " + action.uppercase()
            reactor.mode = ReactorView.Mode.WORKING
        }
        if (action == "call_contact" || action == "call_number") {
            runOnUiThread { confirmCall(id, action, value, token) }
        } else {
            sendResult(id, false, "Unsupported mobile action: " + action, token)
        }
    }

    private fun confirmCall(id: String, action: String, value: String, token: String) {
        val number = if (action == "call_number") value else findContactNumber(value)
        if (number == null) {
            sendResult(id, false, "Contact not found: " + value, token)
            status.text = "CONTACT NOT FOUND"
            reactor.mode = ReactorView.Mode.ERROR
            return
        }

        AlertDialog.Builder(this)
            .setTitle("JARVIS PHONE")
            .setMessage("Call " + if (action == "call_number") number else value + " now?")
            .setNegativeButton("CANCEL") { _, _ ->
                sendResult(id, false, "Call cancelled by user.", token)
                status.text = "CALL CANCELLED"
                reactor.mode = ReactorView.Mode.ONLINE
            }
            .setPositiveButton("CALL") { _, _ ->
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                    sendResult(id, false, "CALL_PHONE permission is not granted.", token)
                    status.text = "CALL PERMISSION REQUIRED"
                    reactor.mode = ReactorView.Mode.ERROR
                    return@setPositiveButton
                }
                startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(number))))
                sendResult(id, true, "Calling " + number + ".", token)
                status.text = "CALLING " + number
                reactor.mode = ReactorView.Mode.ONLINE
            }.show()
    }

    private fun sendResult(id: String, ok: Boolean, message: String, token: String) {
        executor.execute {
            try {
                val body = JSONObject().put("commandId", id).put("ok", ok)
                if (ok) body.put("message", message) else body.put("error", message)
                post("/api/mobile?action=result", body.toString(), token)
            } catch (_: Exception) {}
        }
    }

    private fun findContactNumber(name: String): String? {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return null
        val cursor = contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?",
            arrayOf("%" + name + "%"),
            null
        ) ?: return null
        cursor.use { return if (it.moveToFirst()) it.getString(0) else null }
    }

    private fun post(path: String, body: String, token: String?): JSONObject {
        val connection = (URL(cloudUrl + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8000
            readTimeout = 10000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            if (token != null) setRequestProperty("Authorization", "Bearer " + token)
        }
        connection.outputStream.use { it.write(body.toByteArray()) }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        return JSONObject(stream.bufferedReader().readText())
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun panelDrawable() = GradientDrawable().apply {
        cornerRadius = dp(18).toFloat()
        setColor(Color.argb(90, 0, 35, 45))
        setStroke(dp(1), Color.rgb(0, 105, 125))
    }

    private fun inputDrawable() = GradientDrawable().apply {
        cornerRadius = dp(12).toFloat()
        setColor(Color.argb(110, 0, 20, 26))
        setStroke(dp(1), Color.rgb(0, 100, 120))
    }

    private fun buttonDrawable() = GradientDrawable().apply {
        cornerRadius = dp(12).toFloat()
        setColor(cyan)
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    class HudBackgroundView(context: Context) : View(context) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        override fun onDraw(canvas: Canvas) {
            val w = width.toFloat()
            val h = height.toFloat()
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 1f
            paint.color = Color.rgb(0, 27, 35)
            var x = 0f
            while (x < w) { canvas.drawLine(x, 0f, x, h, paint); x += 42f }
            var y = 0f
            while (y < h) { canvas.drawLine(0f, y, w, y, paint); y += 42f }
            paint.style = Paint.Style.FILL
            paint.color = Color.rgb(0, 75, 90)
            for (i in 0 until 20) {
                val px = ((i * 97) % w.toInt()).toFloat()
                val py = ((i * 173) % h.toInt()).toFloat()
                canvas.drawCircle(px, py, 1.2f, paint)
            }
        }
    }

    class ReactorView(context: Context) : View(context) {
        enum class Mode { PAIRING, ONLINE, WORKING, ERROR }
        var mode = Mode.PAIRING
            set(value) { field = value; invalidate() }
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private var angle = 0f

        override fun onDraw(canvas: Canvas) {
            val cx = width / 2f
            val cy = height / 2f
            val r = minOf(width, height) * 0.32f

            paint.style = Paint.Style.FILL
            paint.shader = RadialGradient(
                cx, cy, r * 1.65f,
                intArrayOf(Color.argb(105, 0, 229, 255), Color.argb(30, 0, 140, 180), Color.TRANSPARENT),
                floatArrayOf(0f, 0.42f, 1f), Shader.TileMode.CLAMP
            )
            canvas.drawCircle(cx, cy, r * 1.65f, paint)
            paint.shader = null

            paint.style = Paint.Style.STROKE
            paint.strokeCap = Paint.Cap.ROUND
            for (i in 0 until 6) {
                paint.strokeWidth = if (i == 2) 2.5f else 1.1f
                paint.color = if (i == 2) Color.argb(200, 0, 229, 255) else Color.argb(65 + i * 13, 0, 150, 180)
                val rr = r * (0.82f + i * 0.15f)
                val speed = if (i % 2 == 0) 1f else -0.65f
                val start = angle * speed + i * 37f
                val sweep = if (mode == Mode.WORKING) 105f else 68f
                canvas.drawArc(cx - rr, cy - rr, cx + rr, cy + rr, start, sweep, false, paint)
                canvas.drawArc(cx - rr, cy - rr, cx + rr, cy + rr, start + 180f, sweep * 0.55f, false, paint)
            }

            paint.color = Color.argb(100, 0, 229, 255)
            paint.strokeWidth = 1f
            for (i in 0 until 12) {
                val a = Math.toRadians(i * 30.0 + angle * 0.25)
                val inner = r * 1.18f
                val outer = r * 1.27f
                canvas.drawLine(
                    cx + cos(a).toFloat() * inner, cy + sin(a).toFloat() * inner,
                    cx + cos(a).toFloat() * outer, cy + sin(a).toFloat() * outer, paint
                )
            }

            paint.style = Paint.Style.FILL
            paint.color = Color.rgb(0, 229, 255)
            canvas.drawCircle(cx, cy, r * 0.34f, paint)
            paint.color = Color.argb(50, 255, 255, 255)
            canvas.drawCircle(cx - r * 0.10f, cy - r * 0.12f, r * 0.15f, paint)

            paint.color = Color.BLACK
            paint.textAlign = Paint.Align.CENTER
            paint.typeface = Typeface.DEFAULT_BOLD
            paint.textSize = r * 0.14f
            canvas.drawText("JARVIS", cx, cy + r * 0.05f, paint)

            paint.color = Color.rgb(0, 229, 255)
            paint.textSize = r * 0.07f
            val label = when (mode) {
                Mode.PAIRING -> "PAIR"
                Mode.ONLINE -> "ONLINE"
                Mode.WORKING -> "WORKING"
                Mode.ERROR -> "ALERT"
            }
            canvas.drawText(label, cx, cy + r * 0.62f, paint)

            angle = (angle + if (mode == Mode.WORKING) 2.8f else 0.9f) % 360f
            postInvalidateOnAnimation()
        }
    }
}
