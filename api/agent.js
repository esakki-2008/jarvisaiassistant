import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash=v=>crypto.createHash('sha256').update(String(v||'')).digest('hex')
const db=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

function safeStep(step){
  const allowed=['search','chat','open_url','open_app','reminder','memory']
  return step && allowed.includes(step.tool) && typeof step.input==='string' && step.input.length<=500
}

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    const {goal, maxSteps=5}=req.body||{}
    if(!String(goal||'').trim()) return res.status(400).json({error:'A goal is required.'})
    const key=process.env.OPENROUTER_API_KEY
    const models=[process.env.OPENROUTER_MODEL,'openrouter/free'].filter(Boolean)
    if(!key) return res.status(503).json({error:'JARVIS AI is not configured on the server.'})
    const system=`You are JARVIS Agent Planner. Turn a user's goal into a short executable plan.
Return ONLY JSON: {"plan":[{"tool":"search|chat|open_url|open_app|reminder|memory","input":"..."}],"summary":"..."}.
Never include destructive, financial, credential, security-bypass, or irreversible actions. Keep plans <= 5 steps. Prefer search/chat for information tasks. For PC actions, only use open_url or open_app. Do not claim execution.`
    let response,data
    for(const model of [...new Set(models)]){response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:String(goal).slice(0,1000)}],temperature:0,max_tokens:500})})
    const data=await response.json().catch(()=>({}))
    if(!response.ok) return res.status(502).json({error:data?.error?.message||'Agent planner unavailable.'})
    const raw=data?.choices?.[0]?.message?.content||''
    const match=raw.match(/\{[\s\S]*\}/)
    if(!match) return res.status(502).json({error:'Agent planner returned invalid JSON.'})
    const plan=JSON.parse(match[0])
    const steps=Array.isArray(plan.plan)?plan.plan.slice(0,Math.min(5,Number(maxSteps)||5)).filter(safeStep):[]
    return res.status(200).json({goal:String(goal).slice(0,1000),steps,summary:String(plan.summary||'Plan created.'),status:'planned'})
  }catch(error){console.error('Agent error:',error);return res.status(500).json({error:'JARVIS agent planning failed.'})}
}
