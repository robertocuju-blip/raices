// A fit may be much smaller than a useful reading scale for a large family.
export const MIN_TREE_ZOOM=.0001;
export function fitTreeZoom(width:number,height:number,availableWidth:number,availableHeight:number){
 return Math.max(MIN_TREE_ZOOM,Math.min(1,Math.max(1,availableWidth)/Math.max(1,width),Math.max(1,availableHeight)/Math.max(1,height)));
}
