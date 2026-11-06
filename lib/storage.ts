import { validateFamily, type Family } from './family.ts';
export const STORAGE_KEY = 'raices.family.v1';
export type SavedFamily = { format:'raices-browser-v1'; tree:Family; revision:number };
type StorageLike = Pick<Storage,'getItem'|'setItem'>;
export function loadFamily(storage:StorageLike):SavedFamily|null {
  const raw=storage.getItem(STORAGE_KEY);
  if(raw===null)return null;
  const saved=JSON.parse(raw) as SavedFamily;
  if(saved.format!=='raices-browser-v1'||!Number.isInteger(saved.revision)||saved.revision<1)throw new Error('La copia de este navegador no es válida. Conserva tus archivos de respaldo antes de modificarla.');
  validateFamily(saved.tree);
  return saved;
}
export function saveFamily(storage:StorageLike,tree:Family,expectedRevision:number):SavedFamily {
  validateFamily(tree);
  const current=loadFamily(storage);
  if((current?.revision??0)!==expectedRevision)throw new Error('El árbol cambió en otra pestaña. Cierra este formulario y vuelve a abrirlo para continuar con la versión actual.');
  const saved:SavedFamily={format:'raices-browser-v1',tree,revision:expectedRevision+1};
  try{storage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch{throw new Error('El navegador no ha podido guardar. Descarga una copia y comprueba el espacio y los permisos de almacenamiento.');}
  return saved;
}
