// A small adapter for post-generation agent workflows. It never starts a render.
const endpointDefault='https://voopa-render-check.onrender.com/mcp/usage';
async function invoke(name,args,{key,endpoint=endpointDefault,request=fetch}){
 const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error('Use a secure Render Check endpoint.');
 if(typeof key!=='string'||!key.trim())throw Error('A private Render Check key is required.');
 const response=await request(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(95_000),headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:`Bearer ${key}`},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});
 if(!response.ok)throw Error(`Render Check returned HTTP ${response.status}. Check operation status before retrying.`);
 const body=await response.text();const event=body.split('\n').find(line=>line.startsWith('data:')&&line.includes('"id"'));const message=JSON.parse(event?event.slice(5):body);const result=message.result;
 if(message.error||result?.isError||!result?.structuredContent)throw Error('Render Check could not complete the request. Check operation status before retrying.');
 return result;
}
export async function startMeteredVideoReview({falResult,renderVideoUrl,brief,operationId,...connection}){
 if(Boolean(falResult)===Boolean(renderVideoUrl))throw Error('Provide exactly one completed fal result or video URL.');
 const source=falResult?(falResult.data??falResult)?.video?.url:renderVideoUrl;
 if(typeof source!=='string'||!/^https:\/\//i.test(source))throw Error('A completed direct HTTPS video URL is required.');
 if(!/^[\w-]{8,100}$/.test(operationId??''))throw Error('Use a stable unique operation ID.');
 const result=await invoke('review_metered_video',{...brief,renderVideoUrl:source,operationId},connection);
 const report=result.structuredContent;
 // A repeated operation ID can return status without frames; never invent or re-run a review.
 return {report,frames:result.content?.filter(x=>x.type==='image')??[],operationId};
}
export async function decideMeteredVideoReview({review,observations,...connection}){
 const report=review?.report;const operationId=review?.operationId;
 if(report?.nextTool!=='decide_metered_retry'||!report.reviewContext||!Array.isArray(report.sampledTimes)||!operationId)throw Error('A completed review with its original evidence is required.');
 if(!Array.isArray(observations))throw Error('Supply one observation per requirement.');
 const byId=new Map(observations.map(x=>[x.id,x]));const expected=report.reviewContext.requirements;
 if(byId.size!==observations.length||byId.size!==expected.length)throw Error('Supply one observation per requirement.');
 const requirements=expected.map(item=>{
  const obs=byId.get(item.id);if(!obs?.observation||!report.sampledTimes.includes(obs.observation.fromSeconds)||(obs.observation.toSeconds!==undefined&&!report.sampledTimes.includes(obs.observation.toSeconds)))throw Error('Observations must cite returned sample timestamps.');
  if(obs.edit&&!(report.editableAssets??[]).includes(obs.edit.availableAsset))throw Error('Proposed edit must use a listed asset.');
  return {...obs,...item};
 });
 const result=await invoke('decide_metered_retry',{...report.reviewContext,requirements,operationId},connection);
 return result.structuredContent;
}
