type Branch={parents:string[];children:string[]};
type Row={level:number;ids:string[]};
const CROSSING_WEIGHT=1e7;

// Reorder whole couple groups before assigning pixels. A downward-only sort
// cannot see when a later union needs its two lines of ancestry side by side.
export function orderFamilyRows(rows:Row[],branches:Branch[],groupOf:(id:string)=>string){
 const ranks=new Map<string,number>(),groupRanks=new Map<string,number>(),levels=new Map<string,number>();
 const groups=rows.map(row=>{
  const blocks:string[][]=[];
  for(const id of row.ids){levels.set(id,row.level);const previous=blocks.at(-1);if(previous&&groupOf(previous[0])===groupOf(id))previous.push(id);else blocks.push([id]);}
  return blocks;
 });
 const reversed=new Set<string[]>();
 function orient(block:string[],reverse:boolean){if(reverse)reversed.add(block);else reversed.delete(block);}
 function rank(blocks:string[][]){let index=0;blocks.forEach((block,i)=>{for(let j=0;j<block.length;j++){const id=block[reversed.has(block)?block.length-1-j:j];ranks.set(id,index++);groupRanks.set(id,i);}});}
 groups.forEach(rank);
 const bands=new Map<string,{above:number;below:number;branches:Branch[]}>();
 for(const branch of branches){
  const above=levels.get(branch.parents[0])!,below=levels.get(branch.children[0])!,key=`${above}:${below}`;
  const band=bands.get(key)??{above,below,branches:[]};band.branches.push(branch);bands.set(key,band);
 }
 const rowSizes=new Map(rows.map(row=>[row.level,row.ids.length]));
 const touched=rows.map(row=>[...bands.values()].filter(b=>b.above===row.level||b.below===row.level));
 function score(bands:typeof touched[number]){
  let crossings=0,gaps=0;
  for(const band of bands){
   const ordered=band.branches.map(branch=>{
    const parents=branch.parents.map(id=>ranks.get(id)!);
    const childGroups=[...new Set(branch.children.map(id=>groupRanks.get(id)!))];
    gaps+=Math.max(...childGroups)-Math.min(...childGroups)+1-childGroups.length;
    return {origin:Math.min(...parents)+Math.max(...parents),destinations:branch.children.map(id=>ranks.get(id)!)};
   }).sort((a,b)=>a.origin-b.origin);
   // Count reversed parent/child orders between different families. A small
   // prefix-sum tree keeps each candidate evaluation linearithmic.
   const counts=new Int32Array(rowSizes.get(band.below)!+1);
   let seen=0;
   for(let start=0;start<ordered.length;){
    let end=start+1;while(end<ordered.length&&ordered[end].origin===ordered[start].origin)end++;
    for(let i=start;i<end;i++)for(const index of ordered[i].destinations){let before=0;for(let k=index+1;k>0;k-=k&-k)before+=counts[k];crossings+=seen-before;}
    for(let i=start;i<end;i++)for(const index of ordered[i].destinations){for(let k=index+1;k<counts.length;k+=k&-k)counts[k]++;seen++;}
    start=end;
   }
  }
  return crossings*CROSSING_WEIGHT+gaps;
 }
 function improve(){for(let sweep=0;sweep<8;sweep++){
  let changed=false;
  for(let step=0;step<rows.length;step++){
   const i=sweep%2?step:rows.length-1-step,blocks=groups[i],bands=touched[i];
   let current=score(bands);if(!current)continue;
   for(const block of [...blocks]){
    const from=blocks.indexOf(block),wasReversed=reversed.has(block);let best=from,bestScore=current,bestReversed=wasReversed;
    blocks.splice(from,1);
    const radius=blocks.length<=40?blocks.length:3;
    // Reverse the entire couple block so the partners remain adjacent.
    for(const reverse of block.length>1?[wasReversed,!wasReversed]:[wasReversed]){
     orient(block,reverse);
     for(let to=Math.max(0,from-radius);to<=Math.min(blocks.length,from+radius);to++){
      if(to===from&&reverse===wasReversed)continue;
      blocks.splice(to,0,block);rank(blocks);const candidate=score(bands);blocks.splice(to,1);
      if(candidate<bestScore){best=to;bestScore=candidate;bestReversed=reverse;}
     }
    }
    blocks.splice(best,0,block);orient(block,bestReversed);rank(blocks);
    if(bestScore<current){changed=true;current=bestScore;if(!current)break;}
   }
  }
  if(!changed)break;
 }}
 const allBands=[...bands.values()],initial=groups.map(blocks=>[...blocks]);
 improve();
 let best=groups.map(blocks=>[...blocks]),bestScore=score(allBands),bestReversed=new Set(reversed);
 // A marriage between two branches may require several rows to move at
 // once. Try placing its ancestral groups beside each other, in the same
 // order as the couple, then propagate that order to the rows below.
 const branchOf=new Map(branches.flatMap(branch=>branch.children.map(id=>[id,branch] as const)));
 const rowIndex=new Map(rows.map((row,i)=>[row.level,i]));
 const blocksById=new Map(initial.flat().flatMap(block=>block.map(id=>[id,block] as const)));
 const parentOrigins=new Map(initial.flat().map(block=>{
  const parents=block.flatMap(id=>branchOf.get(id)?.parents??[]);
  return [block,[...new Set(parents.map(id=>blocksById.get(id)!))]] as const;
 }));
 type Sides={left:string[];right:string[];above:number};
 function ancestralSides(left:string[],right:string[]){
  const sides:Sides[]=[];
  while(left!==right){
   const level=levels.get(left[0])!;
   if(level!==levels.get(right[0]))break;
   sides.push({left,right,above:rowIndex.get(level)!});
   const l=parentOrigins.get(left)!,r=parentOrigins.get(right)!;
   if(l.length!==1||r.length!==1||levels.get(l[0][0])!>=level||levels.get(r[0][0])!>=level)break;
   left=l[0];right=r[0];
  }
  return sides;
 }
 const bridges=initial.slice(1).flat().flatMap(block=>{
  const first=branchOf.get(block[0]),last=branchOf.get(block.at(-1)!);
  if(!first||!last||first===last)return [];
  const sides=ancestralSides(blocksById.get(first.parents[0])!,blocksById.get(last.parents[0])!);
  return sides.length?[{block,sides}]:[];
 });
 const searchBudget=rows.reduce((size,row)=>size+row.ids.length,0)>300?12:36;
 for(let sweep=0,attempts=0;sweep<3&&attempts<searchBudget&&bestScore>=CROSSING_WEIGHT;sweep++){
  const before=bestScore;
  for(const {block,sides:originalSides} of bridges){
   if(attempts>=searchBudget||bestScore<CROSSING_WEIGHT)break;
   // Start from the best order so later unions keep the earlier improvements.
   const start=best,startReversed=bestReversed,wasReversed=startReversed.has(block);
   for(const reverse of [wasReversed,!wasReversed])for(const depth of new Set([originalSides.length-1,Math.min(1,originalSides.length-1),0])){
    if(attempts++>=searchBudget||bestScore<CROSSING_WEIGHT)break;
    const sides=reverse?originalSides.map(({left,right,above})=>({left:right,right:left,above})):originalSides;
    const {left,right,above}=sides[depth],facing=new Map(sides.slice(0,depth).map(side=>[side.above,side]));
    for(const moveLeft of [true,false]){
     reversed.clear();for(const item of startReversed)reversed.add(item);orient(block,reverse);
     start.forEach((blocks,j)=>{groups[j]=[...blocks];rank(groups[j]);});
     const upper=groups[above];
     if(moveLeft){upper.splice(upper.indexOf(left),1);upper.splice(upper.indexOf(right),0,left);}
     else{upper.splice(upper.indexOf(right),1);upper.splice(upper.indexOf(left)+1,0,right);}
     rank(upper);
     for(let j=above+1;j<groups.length;j++){
      const preference=(block:string[])=>{const parents=block.flatMap(id=>branchOf.get(id)?.parents??[]);return parents.length?parents.reduce((sum,id)=>sum+ranks.get(id)!,0)/parents.length:Infinity;};
      const side=facing.get(j);
      // Move the two joining branches to the facing edges of their sibling
      // groups, without inserting a different family between those siblings.
      const edge=(block:string[])=>block===side?.left?1:block===side?.right?-1:0;
      groups[j].sort((a,b)=>preference(a)-preference(b)||edge(a)-edge(b));rank(groups[j]);
     }
     improve();const candidate=score(allBands);
     if(candidate<bestScore){best=groups.map(blocks=>[...blocks]);bestScore=candidate;bestReversed=new Set(reversed);}
     if(bestScore<CROSSING_WEIGHT)break;
    }
   }
  }
  if(bestScore===before)break;
 }
 best.forEach((blocks,i)=>{rows[i].ids=blocks.flatMap(block=>bestReversed.has(block)?[...block].reverse():block);});
}
