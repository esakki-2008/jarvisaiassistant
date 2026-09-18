package com.esakki.jarvis

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.*
import android.content.pm.PackageManager
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.*
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.cos
import kotlin.math.sin

class MainActivity : Activity() {
    private val executor=Executors.newSingleThreadExecutor()
    private val prefs by lazy{getSharedPreferences("jarvis",MODE_PRIVATE)}
    private val cloudUrl="https://jarvis-ai-assistant-jet-ten.vercel.app"
    private val cyan=Color.rgb(0,229,255); private val bg=Color.rgb(2,8,12)
    private lateinit var status:TextView; private lateinit var reactor:ReactorView
    private lateinit var chat:LinearLayout; private lateinit var input:EditText; private lateinit var pairing:LinearLayout
    private var polling=false; private var tts:TextToSpeech?=null; private var recognizer:SpeechRecognizer?=null
    private val history=ArrayList<JSONObject>()

    override fun onCreate(b:Bundle?){super.onCreate(b); window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN)
        window.statusBarColor=bg;window.navigationBarColor=bg;buildUi();requestPermissionsIfNeeded()
        tts=TextToSpeech(this){tts?.language=Locale.US}
        if(prefs.getString("deviceToken",null)!=null){showPaired();startPolling()}else{pairing.visibility=View.VISIBLE;status.text="AWAITING PAIRING"}
    }

    private fun buildUi(){
        val root=FrameLayout(this).apply{setBackgroundColor(bg)}
        root.addView(HudBackgroundView(this),FrameLayout.LayoutParams(-1,-1))
        val all=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(18),dp(12),dp(18),dp(10))}
        val top=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL}
        top.addView(TextView(this).apply{text="J.A.R.V.I.S";textSize=18f;letterSpacing=.24f;setTextColor(cyan);typeface=Typeface.DEFAULT_BOLD},LinearLayout.LayoutParams(0,dp(44),1f))
        top.addView(TextView(this).apply{text="MOBILE CORE";textSize=9f;letterSpacing=.15f;setTextColor(Color.rgb(0,125,150))})
        all.addView(top)
        reactor=ReactorView(this);all.addView(reactor,LinearLayout.LayoutParams(-1,dp(230)))
        status=TextView(this).apply{text="SYSTEM STANDBY";gravity=Gravity.CENTER;textSize=11f;letterSpacing=.15f;setTextColor(cyan)}
        all.addView(status,LinearLayout.LayoutParams(-1,dp(28)))
        val scroll=ScrollView(this).apply{isFillViewport=true}
        chat=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(0,dp(5),0,dp(5))}
        scroll.addView(chat)
        all.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        val controls=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL}
        input=EditText(this).apply{hint="Ask JARVIS...";setHintTextColor(Color.rgb(55,95,105));setTextColor(Color.WHITE);setSingleLine(true);textSize=15f;background=inputBg();setPadding(dp(14),0,dp(14),0)}
        controls.addView(input,LinearLayout.LayoutParams(0,dp(52),1f))
        val mic=TextView(this).apply{text="◉";textSize=25f;gravity=Gravity.CENTER;setTextColor(cyan);setOnClickListener{listen()}}
        controls.addView(mic,LinearLayout.LayoutParams(dp(58),dp(52)))
        val send=TextView(this).apply{text="➤";textSize=22f;gravity=Gravity.CENTER;setTextColor(Color.BLACK);background=buttonBg();setOnClickListener{sendText()}}
        controls.addView(send,LinearLayout.LayoutParams(dp(58),dp(52)))
        all.addView(controls)
        pairing=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER;setPadding(dp(14),dp(14),dp(14),dp(14));background=panelBg();visibility=View.GONE}
        val pairInput=EditText(this).apply{hint="6-DIGIT CODE";setHintTextColor(Color.DKGRAY);gravity=Gravity.CENTER;inputType=2;setTextSize(18f)}
        val pairBtn=TextView(this).apply{text="PAIR PHONE";gravity=Gravity.CENTER;setTextColor(Color.BLACK);background=buttonBg();setOnClickListener{pairPhone(pairInput.text.toString())}}
        pairing.addView(TextView(this).apply{text="PAIR THIS PHONE";gravity=Gravity.CENTER;setTextColor(cyan);textSize=11f})
        pairing.addView(pairInput,LinearLayout.LayoutParams(-1,dp(45)).apply{topMargin=dp(8)})
        pairing.addView(pairBtn,LinearLayout.LayoutParams(-1,dp(42)).apply{topMargin=dp(8)})
        all.addView(pairing,LinearLayout.LayoutParams(-1,dp(150)))
        all.addView(TextView(this).apply{text="VOICE  •  AI CHAT  •  PHONE  •  PC";gravity=Gravity.CENTER;textSize=8f;letterSpacing=.12f;setTextColor(Color.rgb(45,80,90))},LinearLayout.LayoutParams(-1,dp(22)))
        root.addView(all,FrameLayout.LayoutParams(-1,-1));setContentView(root)
    }

    private fun sendText(){val text=input.text.toString().trim();if(text.isEmpty())return;input.setText("");addBubble("YOU",text,false);askJarvis(text)}
    private fun cloudMemory(mode:String,content:String?=null,callback:(String)->Unit){
        executor.execute{try{
            val token=prefs.getString("deviceToken",null)?:throw Exception("Phone is not paired.")
            val body=JSONObject().put("mode",mode);if(content!=null)body.put("content",content)
            val d=post("/api/mobile?action=memory",body.toString(),token)
            callback(if(mode=="save")"Memory saved to JARVIS cloud." else d.optJSONArray("items")?.toString()?:("[]"))
        }catch(e:Exception){callback("Memory error: "+(e.message?:"request failed"))}}
    }

    private fun askJarvis(message:String){
        status.text="JARVIS THINKING";reactor.mode=ReactorView.Mode.WORKING
        executor.execute{try{
            val historyArray=org.json.JSONArray();history.takeLast(8).forEach{historyArray.put(it)};val body=JSONObject().put("message",message).put("history",historyArray).toString()
            val d=post("/api/mobile?action=assistant",body,prefs.getString("deviceToken",null))
            val reply=d.optString("reply","How can I help?")
            history.add(JSONObject().put("role","user").put("content",message));history.add(JSONObject().put("role","assistant").put("content",reply))
            runOnUiThread{addBubble("JARVIS",reply,true);status.text="JARVIS ONLINE";reactor.mode=ReactorView.Mode.ONLINE;speak(reply)}
        }catch(e:Exception){runOnUiThread{addBubble("SYSTEM",e.message?:"Request failed",true);status.text="LINK ERROR";reactor.mode=ReactorView.Mode.ERROR}}}
    }

    private fun addBubble(who:String,text:String,speakable:Boolean){
        val b=TextView(this).apply{this.text=who+"\\n"+text;textSize=13f;setTextColor(if(who=="JARVIS")cyan else Color.LTGRAY);setPadding(dp(14),dp(10),dp(14),dp(10));background=panelBg()}
        chat.addView(b,LinearLayout.LayoutParams(-1,LinearLayout.LayoutParams.WRAP_CONTENT).apply{bottomMargin=dp(8)})
    }
    private fun speak(text:String){tts?.speak(text.take(1000),TextToSpeech.QUEUE_FLUSH,null,"jarvis")}
    private fun listen(){
        if(ContextCompat.checkSelfPermission(this,Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){ActivityCompat.requestPermissions(this,arrayOf(Manifest.permission.RECORD_AUDIO),43);return}
        if(!SpeechRecognizer.isRecognitionAvailable(this)){status.text="VOICE UNAVAILABLE";return}
        recognizer?.destroy();recognizer=SpeechRecognizer.createSpeechRecognizer(this)
        recognizer?.setRecognitionListener(object:RecognitionListener{
            override fun onReadyForSpeech(p:Bundle?){status.text="LISTENING";reactor.mode=ReactorView.Mode.WORKING}
            override fun onResults(r:Bundle?){val s=r?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?:"";if(s.isNotBlank()){input.setText(s);sendText()}}
            override fun onError(e:Int){status.text="JARVIS ONLINE";reactor.mode=ReactorView.Mode.ONLINE}
            override fun onBeginningOfSpeech(){};override fun onBufferReceived(b:ByteArray?){};override fun onEndOfSpeech(){};override fun onEvent(t:Int,p:Bundle?){};override fun onPartialResults(r:Bundle?){};override fun onRmsChanged(v:Float){}
        })
        val i=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply{putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);putExtra(RecognizerIntent.EXTRA_LANGUAGE,Locale.US)}
        recognizer?.startListening(i)
    }

    private fun requestPermissionsIfNeeded(){val miss=arrayOf(Manifest.permission.READ_CONTACTS,Manifest.permission.CALL_PHONE,Manifest.permission.RECORD_AUDIO).filter{ContextCompat.checkSelfPermission(this,it)!=PackageManager.PERMISSION_GRANTED};if(miss.isNotEmpty())ActivityCompat.requestPermissions(this,miss.toTypedArray(),42)}
    private fun pairPhone(code:String){if(!Regex("\\d{6}").matches(code)){status.text="ENTER 6-DIGIT CODE";return};status.text="PAIRING...";executor.execute{try{val d=post("/api/mobile?action=pair-complete",JSONObject().put("code",code).put("deviceName",android.os.Build.MODEL).toString(),null);prefs.edit().putString("deviceToken",d.getString("deviceToken")).apply();runOnUiThread{showPaired();startPolling()}}catch(e:Exception){runOnUiThread{status.text="PAIRING FAILED"}}}}
    private fun showPaired(){pairing.visibility=View.GONE;status.text="JARVIS ONLINE";reactor.mode=ReactorView.Mode.ONLINE}

    private fun startPolling(){if(polling)return;polling=true;executor.execute{while(!isFinishing){try{val token=prefs.getString("deviceToken",null)?:break;val d=post("/api/mobile?action=poll","{}",token);if(d.has("command")&&!d.isNull("command"))handleCommand(d.getJSONObject("command"),token)}catch(_:Exception){};try{Thread.sleep(3000)}catch(_:Exception){break}}}}
    private fun handleCommand(c:JSONObject,token:String){val id=c.getString("id");val a=c.getString("action");val v=c.optString("value","");if(a=="call_contact"||a=="call_number")runOnUiThread{confirmCall(id,a,v,token)}}
    private fun confirmCall(id:String,a:String,v:String,token:String){val n=if(a=="call_number")v else findContactNumber(v);if(n==null){sendResult(id,false,"Contact not found: "+v,token);return};AlertDialog.Builder(this).setTitle("JARVIS PHONE").setMessage("Call "+(if(a=="call_number")n else v)+"?").setNegativeButton("CANCEL"){_,_->sendResult(id,false,"Call cancelled.",token)}.setPositiveButton("CALL"){_,_->if(ContextCompat.checkSelfPermission(this,Manifest.permission.CALL_PHONE)==PackageManager.PERMISSION_GRANTED){startActivity(Intent(Intent.ACTION_CALL,Uri.parse("tel:"+Uri.encode(n))));sendResult(id,true,"Calling "+n+".",token)}}.show()}
    private fun findContactNumber(name:String):String?{if(ContextCompat.checkSelfPermission(this,Manifest.permission.READ_CONTACTS)!=PackageManager.PERMISSION_GRANTED)return null;val c=contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME+" LIKE ?",arrayOf("%"+name+"%"),null)?:return null;c.use{return if(it.moveToFirst())it.getString(0)else null}}
    private fun sendResult(id:String,ok:Boolean,msg:String,token:String){executor.execute{try{val b=JSONObject().put("commandId",id).put("ok",ok);if(ok)b.put("message",msg)else b.put("error",msg);post("/api/mobile?action=result",b.toString(),token)}catch(_:Exception){}}}
    private fun post(path:String,body:String,token:String?):JSONObject{val c=(URL(cloudUrl+path).openConnection()as HttpURLConnection).apply{requestMethod="POST";connectTimeout=8000;readTimeout=20000;doOutput=true;setRequestProperty("Content-Type","application/json");if(token!=null)setRequestProperty("Authorization","Bearer "+token)};c.outputStream.use{it.write(body.toByteArray(Charsets.UTF_8))};val code=c.responseCode;val s=if(code in 200..299)c.inputStream else c.errorStream;val raw=s.bufferedReader().readText();if(code !in 200..299)throw Exception(JSONObject(raw).optString("error","HTTP $code"));return JSONObject(raw)}
    private fun dp(v:Int)= (v*resources.displayMetrics.density).toInt()
    private fun panelBg()=GradientDrawable().apply{cornerRadius=dp(16).toFloat();setColor(Color.argb(85,0,35,45));setStroke(dp(1),Color.rgb(0,95,115))}
    private fun inputBg()=GradientDrawable().apply{cornerRadius=dp(14).toFloat();setColor(Color.argb(100,0,20,26));setStroke(dp(1),Color.rgb(0,100,120))}
    private fun buttonBg()=GradientDrawable().apply{cornerRadius=dp(14).toFloat();setColor(cyan)}
    override fun onDestroy(){recognizer?.destroy();tts?.shutdown();executor.shutdownNow();super.onDestroy()}

    class HudBackgroundView(c:Context):View(c){private val p=Paint(1);override fun onDraw(x:Canvas){p.style=Paint.Style.STROKE;p.strokeWidth=1f;p.color=Color.rgb(0,27,35);var a=0f;while(a<width){x.drawLine(a,0f,a,height.toFloat(),p);a+=42};a=0f;while(a<height){x.drawLine(0f,a,width.toFloat(),a,p);a+=42}}}
    class ReactorView(context: Context) : View(context) {
        enum class Mode { ONLINE, WORKING, ERROR }
        var mode = Mode.ONLINE
            set(value) { field = value; invalidate() }
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private var angle = 0f

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val cx = width / 2f
            val cy = height / 2f
            val radius = minOf(width, height) * 0.24f
            val glow = RadialGradient(
                cx, cy, radius * 2f,
                intArrayOf(Color.argb(110, 0, 229, 255), Color.argb(20, 0, 120, 160), Color.TRANSPARENT),
                floatArrayOf(0f, 0.45f, 1f),
                Shader.TileMode.CLAMP
            )
            paint.style = Paint.Style.FILL
            paint.shader = glow
            canvas.drawCircle(cx, cy, radius * 2f, paint)
            paint.shader = null

            paint.style = Paint.Style.STROKE
            for (i in 0..5) {
                paint.strokeWidth = if (i == 2) 3f else 1f
                paint.color = Color.argb(if (i == 2) 210 else 80, 0, 229, 255)
                val ring = radius * (1f + i * 0.18f)
                val start = angle * if (i % 2 == 0) 1f else -0.7f + i * 31f
                val sweep = if (mode == Mode.WORKING) 110f else 70f
                canvas.drawArc(cx - ring, cy - ring, cx + ring, cy + ring, start, sweep, false, paint)
            }

            paint.style = Paint.Style.FILL
            paint.color = Color.rgb(0, 229, 255)
            canvas.drawCircle(cx, cy, radius * 0.34f, paint)
            paint.color = Color.BLACK
            paint.textAlign = Paint.Align.CENTER
            paint.typeface = Typeface.DEFAULT_BOLD
            paint.textSize = radius * 0.16f
            canvas.drawText("JARVIS", cx, cy + radius * 0.05f, paint)

            paint.color = Color.rgb(0, 229, 255)
            paint.textSize = radius * 0.07f
            val label = when (mode) {
                Mode.WORKING -> "WORKING"
                Mode.ERROR -> "ALERT"
                Mode.ONLINE -> "ONLINE"
            }
            canvas.drawText(label, cx, cy + radius * 0.62f, paint)
            angle = (angle + 1.4f) % 360f
            postInvalidateOnAnimation()
        }
    }
}
