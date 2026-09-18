import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash=(v)=>crypto.createHash('sha256').update(String(v)).digest('hex')
const admin=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    const action=String(req.query?.action||'')
    const db=admin()

    if(action==='pair-start'){
      if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({error:'Supabase is not configured.'})
      const code=String(crypto.randomInt(100000,1000000))
      const clientToken=crypto.randomBytes(32).toString('hex')
      const expiresAt=new Date(Date.now()+10*60*1000).toISOString()
      const {data,error}=await db.from('mobile_pairing_requests').insert({code_hash:hash(code),client_token_hash:hash(clientToken),expires_at:expiresAt}).select('id').single()
      if(error) throw error
      return res.status(200).json({pairingId:data.id,code,clientToken,expiresAt})
    }

    if(action==='pair-complete'){
      const {code,deviceName='Android Phone'}=req.body||{}
      if(!/^\d{6}$/.test(String(code||''))) return res.status(400).json({error:'Pairing code must be exactly 6 digits.'})
      const {data:request,error}=await db.from('mobile_pairing_requests').select('id,expires_at,used').eq('code_hash',hash(code)).eq('used',false).gt('expires_at',new Date().toISOString()).maybeSingle()
      if(error) throw error
      if(!request) return res.status(400).json({error:'Invalid or expired pairing code.'})
      const deviceToken=crypto.randomBytes(32).toString('hex')
      const {data:device,error:deviceError}=await db.from('mobile_devices').insert({device_name:String(deviceName).slice(0,100),device_token_hash:hash(deviceToken),platform:'android'}).select('id,device_name').single()
      if(deviceError) throw deviceError
      const {error:updateError}=await db.from('mobile_pairing_requests').update({used:true,used_at:new Date().toISOString(),device_id:device.id}).eq('id',request.id).eq('used',false)
      if(updateError) throw updateError
      return res.status(200).json({deviceId:device.id,deviceToken,deviceName:device.device_name})
    }

    if(action==='pair-status'){
      const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
      if(!token) return res.status(401).json({error:'Missing pairing token.'})
      const {data:request,error}=await db.from('mobile_pairing_requests').select('id,expires_at,used,device_id').eq('client_token_hash',hash(token)).maybeSingle()
      if(error) throw error
      if(!request) return res.status(401).json({error:'Invalid pairing token.'})
      if(request.used&&request.device_id){
        const {data:device}=await db.from('mobile_devices').select('id,device_name,enabled').eq('id',request.device_id).maybeSingle()
        return res.status(200).json({paired:Boolean(device?.enabled),deviceName:device?.device_name||''})
      }
      if(new Date(request.expires_at).getTime()<Date.now()) return res.status(200).json({paired:false,expired:true})
      return res.status(200).json({paired:false,expired:false})
    }


    if(action==='assistant'){
      const token=req.headers.authorization?.replace(/^Bearer\\s+/i,'')
      if(!token) return res.status(401).json({error:'Missing phone authentication.'})
      const {data:device}=await db.from('mobile_devices').select('id,enabled').eq('device_token_hash',hash(token)).maybeSingle()
      if(!device?.enabled) return res.status(401).json({error:'Phone is not authorized.'})
      const {message='',history=[]}=req.body||{}
      if(!String(message).trim()) return res.status(400).json({error:'A message is required.'})
      const key=process.env.OPENROUTER_API_KEY
      const model=process.env.OPENROUTER_MODEL||'openrouter/free'
      if(!key) return res.status(503).json({error:'JARVIS AI is not configured on the server.'})
      const system='You are JARVIS. Return ONLY JSON: {"tool":"chat|mobile|pc","action":"...","value":"...","reply":"..."}. mobile actions: call_contact, call_number. pc actions: open_app, open_path, open_url, search_web, type_text, key_press, hotkey, mouse_click, mouse_move. For normal conversation use chat. Never claim an action happened before confirmation.'
      const messages=[{role:'system',content:system},...(Array.isArray(history)?history.filter(x=>x&&(x.role==='user'||x.role==='assistant')&&typeof x.content==='string').slice(-8):[]),{role:'user',content:String(message)}]
      const ai=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,'HTTP-Referer':'https://github.com/esakki-2008/jarvisaiassistant','X-Title':'JARVIS AI Assistant'},body:JSON.stringify({model,messages,temperature:0,max_tokens:350})})
      const data=await ai.json().catch(()=>({}))
      if(!ai.ok) return res.status(502).json({error:data?.error?.message||'AI provider error.'})
      const raw=data?.choices?.[0]?.message?.content||''
      const match=raw.match(/\{[\s\S]*\}/)
      if(!match) return res.status(502).json({error:'JARVIS returned an invalid response.'})
      let d
      try{d=JSON.parse(match[0])}catch{return res.status(502).json({error:'JARVIS returned invalid JSON.'})}
      if(d.tool==='mobile'&&['call_contact','call_number'].includes(d.action)){
        const value=String(d.value||'').trim()
        if(!value) return res.status(400).json({error:'No call target found.'})
        const {data:cmd,error}=await db.from('mobile_commands').insert({device_id:device.id,action:d.action,value:value.slice(0,200)}).select('id').single()
        if(error) throw error
        return res.status(200).json({reply:'Call request sent to your phone for confirmation.',action:d.action,commandId:cmd.id})
      }
      if(d.tool==='pc'){
        const allowed=['open_app','open_path','open_url','search_web','type_text','key_press','hotkey','mouse_click','mouse_move']
        if(!allowed.includes(d.action)) return res.status(400).json({error:'Unsupported PC action.'})
        const {data:pcs,error:pcError}=await db.from('pc_devices').select('id,enabled').eq('enabled',true).order('created_at',{ascending:false}).limit(1)
        if(pcError) throw pcError
        if(!pcs?.[0]) return res.status(409).json({error:'No paired PC is online/authorized.'})
        const {data:cmd,error}=await db.from('pc_commands').insert({device_id:pcs[0].id,action:d.action,value:String(d.value||'').slice(0,1000)}).select('id').single()
        if(error) throw error
        return res.status(200).json({reply:'PC command sent to your paired PC.',action:d.action,commandId:cmd.id})
      }
      return res.status(200).json({reply:String(d.reply||'How can I help you?')})
    }
    if(action==='command'){
      const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
      if(!token) return res.status(401).json({error:'Missing phone pairing token.'})
      const {action:commandAction,value}=req.body||{}
      if(!['call_contact','call_number'].includes(commandAction)) return res.status(400).json({error:'Unsupported phone action.'})

      // The browser holds the client pairing token, not the Android device token.
      // Resolve the client token to its paired, enabled device before queueing.
      const {data:pairing,error:pairingError}=await db.from('mobile_pairing_requests')
        .select('device_id,used')
        .eq('client_token_hash',hash(token))
        .eq('used',true)
        .maybeSingle()
      if(pairingError) throw pairingError
      if(!pairing?.device_id) return res.status(401).json({error:'Phone is not authorized.'})

      const {data:device,error:deviceError}=await db.from('mobile_devices')
        .select('id,enabled')
        .eq('id',pairing.device_id)
        .maybeSingle()
      if(deviceError) throw deviceError
      if(!device?.enabled) return res.status(401).json({error:'Phone is not authorized.'})

      const safeValue=String(value||'').trim()
      if(!safeValue||safeValue.length>200) return res.status(400).json({error:'Invalid call target.'})
      const {data:command,error}=await db.from('mobile_commands').insert({device_id:device.id,action:commandAction,value:safeValue}).select('id').single()
      if(error) throw error
      return res.status(200).json({ok:true,commandId:command.id,message:'Call request sent to your phone.'})
    }

    if(action==='poll'){
      const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
      if(!token) return res.status(401).json({error:'Missing phone authentication.'})
      const {data:device,error:deviceError}=await db.from('mobile_devices').select('id,device_name,enabled').eq('device_token_hash',hash(token)).maybeSingle()
      if(deviceError) throw deviceError
      if(!device?.enabled) return res.status(401).json({error:'Phone is not authorized.'})
      await db.from('mobile_devices').update({last_seen_at:new Date().toISOString()}).eq('id',device.id)
      const {data:command,error}=await db.from('mobile_commands').select('id,action,value').eq('device_id',device.id).eq('status','queued').order('created_at',{ascending:true}).limit(1).maybeSingle()
      if(error) throw error
      if(!command) return res.status(200).json({command:null})
      const {error:claimError}=await db.from('mobile_commands').update({status:'claimed',claimed_at:new Date().toISOString()}).eq('id',command.id).eq('status','queued')
      if(claimError) throw claimError
      return res.status(200).json({command})
    }

    if(action==='result'){
      const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
      if(!token) return res.status(401).json({error:'Missing phone authentication.'})
      const {commandId,ok,message,error:actionError}=req.body||{}
      if(!commandId) return res.status(400).json({error:'commandId is required.'})
      const {data:device}=await db.from('mobile_devices').select('id,enabled').eq('device_token_hash',hash(token)).maybeSingle()
      if(!device?.enabled) return res.status(401).json({error:'Phone is not authorized.'})
      const {error}=await db.from('mobile_commands').update({status:ok?'completed':'failed',result:String(ok?message||'Completed.':actionError||'Phone action failed.').slice(0,4000),completed_at:new Date().toISOString()}).eq('id',commandId).eq('device_id',device.id).eq('status','claimed')
      if(error) throw error
      return res.status(200).json({ok:true})
    }

    return res.status(404).json({error:'Unknown mobile action.'})
  }catch(error){
    console.error('Mobile bridge error:',error)
    return res.status(500).json({error:'Mobile bridge request failed.'})
  }
}