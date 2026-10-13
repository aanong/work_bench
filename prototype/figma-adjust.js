
await Promise.all(['Regular','Medium','Bold'].map(style=>figma.loadFontAsync({family:'Noto Sans SC',style})));
const updated=[],created=[],p=figma.currentPage;
const home=await figma.getNodeByIdAsync('3:18');
for(const r of home.findAllWithCriteria({types:['FRAME']}).filter(f=>/^应用行/.test(f.name))){r.resize(r.width,112);updated.push(r.id);}
const pager=await figma.getNodeByIdAsync('4:597');pager.resize(960,36);updated.push(pager.id);
for(const id of ['4:647','4:691','4:733']){const n=await figma.getNodeByIdAsync(id);n.resize(632,36);updated.push(id);}
for(const id of ['4:646','4:690','4:732']){const n=await figma.getNodeByIdAsync(id);n.resize(680,id==='4:732'?380:516);updated.push(id);}
const content=await figma.getNodeByIdAsync('4:772');content.itemSpacing=4;content.paddingTop=content.paddingBottom=20;updated.push(content.id);
for(const n of content.children){if(n.type==='FRAME'&&['Launchpad 快捷键','Spotlight 快捷键','开机启动','失焦后隐藏','智能排序'].includes(n.name)){n.resize(n.width,48);for(const c of n.children)if(c.type==='FRAME'&&c.name==='说明'){c.resize(c.width,42);updated.push(c.id);}updated.push(n.id);}}
const modes=await figma.getNodeByIdAsync('4:776');modes.resize(724,80);updated.push(modes.id);for(const c of modes.children){c.resize(c.width,80);c.paddingTop=c.paddingBottom=12;updated.push(c.id);}
const scan=await figma.getNodeByIdAsync('4:815');scan.resize(724,36);updated.push(scan.id);
for(const t of p.findAllWithCriteria({types:['TEXT']}).filter(t=>t.parent?.type==='FRAME'&&t.parent.name.startsWith('应用图标'))){t.fills=[{type:'SOLID',color:t.characters==='N'?{r:.06,g:.08,b:.12}:{r:1,g:1,b:1}}];updated.push(t.id);}
for(const i of p.findAllWithCriteria({types:['INSTANCE']}).filter(n=>n.name==='Search')){for(const n of i.findAll(x=>'strokes' in x)){if(Array.isArray(n.strokes)&&n.strokes.length){n.strokes=[{type:'SOLID',color:{r:.65,g:.71,b:.8}}];updated.push(n.id);}}}
const next=home.clone();p.appendChild(next);next.name='Launchpad · 应用第二页';next.x=5320;next.y=0;
const rows=next.findAllWithCriteria({types:['FRAME']}).filter(f=>/^应用行/.test(f.name));rows[1].remove();rows[2].remove();
const last=[['设置','⚙','#718398'],['画图','◈','#54AAB1'],['截图工具','✂','#B57267'],['腾讯会议','V','#397FC7'],['QQ','Q','#49546B'],['Spotify','≋','#339866']];
for(let k=0;k<6;k++){const i=rows[0].children[k];i.name='应用 · '+last[k][0];const ts=i.findAllWithCriteria({types:['TEXT']});ts[0].characters=last[k][1];ts[1].characters=last[k][0];ts[0].fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];const f=i.findOne(n=>n.type==='FRAME');const h=last[k][2];f.fills=[{type:'SOLID',color:{r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255}}];}
const route=dest=>[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:dest,navigation:'NAVIGATE',transition:{type:'DISSOLVE',easing:{type:'EASE_OUT'},duration:.16}}]}];
await (await figma.getNodeByIdAsync('4:600')).setReactionsAsync(route(next.id));updated.push('4:600');
const buttons=next.findOne(n=>n.type==='FRAME'&&n.name==='分页').children;await buttons[0].setReactionsAsync(route(home.id));await buttons[1].setReactionsAsync([]);
const vars=await figma.variables.getLocalVariablesAsync();const selected=vars.find(v=>v.name==='color/selected'),raised=vars.find(v=>v.name==='color/raised');
buttons[0].fills=[figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',raised)];buttons[1].fills=[figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',selected)];
const desktop=await figma.getNodeByIdAsync('3:24');const toast=desktop.findOne(n=>n.type==='TEXT'&&n.characters==='已发送微信启动请求');toast.characters='已发送应用启动请求';updated.push(toast.id);
created.push(next.id,...next.findAll(()=>true).map(n=>n.id));
return {createdNodeIds:created,mutatedNodeIds:updated,secondPageId:next.id,settingsBottom:content.children.map(n=>({name:n.name,y:n.y,height:n.height}))};
