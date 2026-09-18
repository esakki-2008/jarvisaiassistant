import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash=(v)=>crypto.createHash('sha256').update(String(v||'')).digest('hex')
const admin=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    const token=String(req.headers['x-jarvis-memory-token']||'').trim()
    if(token.length<32) return res.status(401).json({error:'Missing memory token.'})
    const db=admin(), tokenHash=hash(token), mode=String(req.body?.mode||'list')
    if(mode==='save'){
      const content=String(req.body?.content||'').trim().slice(0,2000)
      if(!content) return res.status(400).json({error:'Memory content is required.'})
      const {data:item,error}=await db.from('web_memory').insert({client_token_hash:tokenHash,content}).select('id,content,created_at').single()
      if(error) throw error
      return res.status(200).json({item})
    }
    const {data:items,error}=await db.from('web_memory').select('id,content,created_at').eq('client_token_hash',tokenHash).order('created_at',{ascending:false}).limit(50)
    if(error) throw error
    return res.status(200).json({items:items||[]})
  }catch(error){console.error('Web memory error:',error);return res.status(500).json({error:'Cloud memory request failed.'})}
}
