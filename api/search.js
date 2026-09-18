export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'})
    const q=String(req.body?.query||'').trim().slice(0,300)
    if(!q) return res.status(400).json({error:'A search query is required.'})
    const url='https://api.duckduckgo.com/?'+new URLSearchParams({q,format:'json',no_html:'1',skip_disambig:'0'})
    const r=await fetch(url,{headers:{'User-Agent':'JARVIS-AI-Assistant/1.0'}})
    if(!r.ok) return res.status(502).json({error:'Search provider unavailable.'})
    const d=await r.json()
    const results=[]
    if(d.AbstractText) results.push({title:d.Heading||q,url:d.AbstractURL||'',snippet:d.AbstractText})
    const walk=(items)=>{for(const x of Array.isArray(items)?items:[]){if(x?.Text)results.push({title:x.Text.split(' - ')[0],url:x.FirstURL||'',snippet:x.Text});walk(x.Topics)}}
    walk(d.RelatedTopics)
    return res.status(200).json({query:q,answer:d.AbstractText||'',source:d.AbstractSource||'',results:results.slice(0,8)})
  }catch(error){console.error('Search error:',error);return res.status(500).json({error:'JARVIS search failed.'})}
}
